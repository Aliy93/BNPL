
'use server';
/**
 * @fileOverview Implements the logic for loan repayments, including automated deductions.
 *
 * - processAutomatedRepayments - A service that finds overdue loans and attempts to deduct payment from customer accounts.
 */

import prisma from '@/lib/prisma';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { startOfDay } from 'date-fns';
import { createAuditLog } from '@/lib/audit-log';

async function getCustomerBalance(customerId: string): Promise<number> {
    const provisionedData = await prisma.provisionedData.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
    });

    if (provisionedData) {
        try {
            const data = JSON.parse(provisionedData.data as string);
            const balanceKey = Object.keys(data).find(k => k.toLowerCase() === 'accountbalance');
            if (balanceKey) {
                return parseFloat(data[balanceKey]) || 0;
            }
        } catch (e) {
            console.error(`Could not parse provisioned data for customer ${customerId}`, e);
            return 0;
        }
    }
    return 0;
}

export async function processAutomatedRepayments(): Promise<{ success: boolean; message: string; processedCount: number }> {
    console.log('Starting automated repayment process...');
    const today = startOfDay(new Date());

    const taxConfig = await prisma.tax.findFirst();

    // 1. Find all unpaid installments that are overdue
    const overdueInstallments = await prisma.installmentPlan.findMany({
        where: {
            repaymentStatus: 'Unpaid',
            dueDate: {
                lt: today,
            },
        },
        include: {
            product: {
                include: {
                    provider: {
                        include: {
                            ledgerAccounts: true,
                        }
                    }
                }
            }
        },
    });

    if (overdueInstallments.length === 0) {
        console.log('No overdue installments found.');
        return { success: true, message: 'No overdue installments to process.', processedCount: 0 };
    }

    let processedCount = 0;

    for (const installment of overdueInstallments) {
        const { total, principal, interest, penalty, serviceFee } = calculateTotalRepayable(installment as any, installment.product, taxConfig, today);
        const alreadyRepaid = installment.repaidAmount || 0;
        const totalDue = total - alreadyRepaid;

        if (totalDue <= 0) {
            continue; // Skip if already paid off
        }

        const customerBalance = await getCustomerBalance(installment.customerId);
        
        if (customerBalance >= totalDue) {
            try {
                await prisma.$transaction(async (tx) => {
                    const provider = installment.product.provider;
                    
                    // Ledger Accounts
                    const principalReceivable = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Receivable');
                    const interestReceivable = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Receivable');
                    const penaltyReceivable = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Receivable');
                    const serviceFeeReceivable = provider.ledgerAccounts.find(a => a.category === 'ServiceFee' && a.type === 'Receivable');

                    const principalReceived = provider.ledgerAccounts.find(a => a.category === 'Principal' && a.type === 'Received');
                    const interestReceived = provider.ledgerAccounts.find(a => a.category === 'Interest' && a.type === 'Received');
                    const penaltyReceived = provider.ledgerAccounts.find(a => a.category === 'Penalty' && a.type === 'Received');
                    const serviceFeeReceived = provider.ledgerAccounts.find(a => a.category === 'ServiceFee' && a.type === 'Received');
                    
                    
                    if (!principalReceivable || !interestReceivable || !penaltyReceivable || !serviceFeeReceivable ||
                        !principalReceived || !interestReceived || !penaltyReceived || !serviceFeeReceived) {
                        throw new Error(`One or more ledger accounts not found for provider ${provider.id}`);
                    }
                    
                     const journalEntry = await tx.journalEntry.create({
                        data: {
                            providerId: provider.id,
                            installmentPlanId: installment.id,
                            date: today,
                            description: `Automated repayment for installment ${installment.id}`,
                        }
                    });
                    
                    let paymentAmount = totalDue;

                    const penaltyDue = Math.max(0, penalty - (installment.repaidAmount || 0));
                    const serviceFeeDue = Math.max(0, serviceFee - Math.max(0, (installment.repaidAmount || 0) - penalty));
                    const interestDue = Math.max(0, interest - Math.max(0, (installment.repaidAmount || 0) - penalty - serviceFee));

                    const penaltyToPay = Math.min(paymentAmount, penaltyDue);
                    if (penaltyToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: penaltyReceivable.id }, data: { balance: { decrement: penaltyToPay } } });
                        await tx.ledgerAccount.update({ where: { id: penaltyReceived.id }, data: { balance: { increment: penaltyToPay } } });
                         await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceivable.id, type: 'Credit', amount: penaltyToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: penaltyReceived.id, type: 'Debit', amount: penaltyToPay }
                        ]});
                        paymentAmount -= penaltyToPay;
                    }
                    
                    const serviceFeeToPay = Math.min(paymentAmount, serviceFeeDue);
                    if (serviceFeeToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: serviceFeeReceivable.id }, data: { balance: { decrement: serviceFeeToPay } } });
                        await tx.ledgerAccount.update({ where: { id: serviceFeeReceived.id }, data: { balance: { increment: serviceFeeToPay } } });
                        await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceivable.id, type: 'Credit', amount: serviceFeeToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceived.id, type: 'Debit', amount: serviceFeeToPay }
                        ]});
                        paymentAmount -= serviceFeeToPay;
                    }

                    const interestToPay = Math.min(paymentAmount, interestDue);
                     if (interestToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: interestReceivable.id }, data: { balance: { decrement: interestToPay } } });
                        await tx.ledgerAccount.update({ where: { id: interestReceived.id }, data: { balance: { increment: interestToPay } } });
                         await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: interestReceivable.id, type: 'Credit', amount: interestToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: interestReceived.id, type: 'Debit', amount: interestToPay }
                        ]});
                        paymentAmount -= interestToPay;
                    }
                    
                    const principalToPay = paymentAmount;
                     if (principalToPay > 0) {
                        await tx.ledgerAccount.update({ where: { id: principalReceivable.id }, data: { balance: { decrement: principalToPay } } });
                        await tx.ledgerAccount.update({ where: { id: principalReceived.id }, data: { balance: { increment: principalToPay } } });
                        await tx.ledgerEntry.createMany({ data: [
                            { journalEntryId: journalEntry.id, ledgerAccountId: principalReceivable.id, type: 'Credit', amount: principalToPay },
                            { journalEntryId: journalEntry.id, ledgerAccountId: principalReceived.id, type: 'Debit', amount: principalToPay }
                        ]});
                    }
                    
                    await tx.payment.create({
                        data: {
                            installmentPlanId: installment.id,
                            amount: totalDue,
                            date: today,
                            outstandingBalanceBeforePayment: totalDue,
                            journalEntryId: journalEntry.id,
                        },
                    });

                    await tx.installmentPlan.update({
                        where: { id: installment.id },
                        data: {
                            repaidAmount: (installment.repaidAmount || 0) + totalDue,
                            repaymentStatus: 'Paid',
                        },
                    });
                });
                
                processedCount++;
                const logDetails = {
                    installmentPlanId: installment.id,
                    customerId: installment.customerId,
                    amount: totalDue
                };
                await createAuditLog({ actorId: 'system', action: 'AUTOMATED_REPAYMENT_SUCCESS', entity: 'INSTALLMENT_PLAN', entityId: installment.id, details: logDetails });
                console.log(JSON.stringify({
                    action: 'AUTOMATED_REPAYMENT_SUCCESS',
                    actorId: 'system',
                    details: logDetails
                }));

            } catch (error) {
                const failureDetails = {
                    installmentPlanId: installment.id,
                    customerId: installment.customerId,
                    error: (error as Error).message
                };
                await createAuditLog({ actorId: 'system', action: 'AUTOMATED_REPAYMENT_FAILURE', entity: 'INSTALLMENT_PLAN', entityId: installment.id, details: failureDetails });
                 console.error(JSON.stringify({
                    action: 'AUTOMATED_REPAYMENT_FAILURE',
                    actorId: 'system',
                    details: failureDetails
                }));
            }
        } else {
            const skipDetails = {
                installmentPlanId: installment.id,
                customerId: installment.customerId,
                balance: customerBalance,
                amountDue: totalDue
            };
            await createAuditLog({ actorId: 'system', action: 'AUTOMATED_REPAYMENT_SKIPPED', entity: 'INSTALLMENT_PLAN', entityId: installment.id, details: { reason: 'Insufficient funds', ...skipDetails } });
             console.log(JSON.stringify({
                action: 'AUTOMATED_REPAYMENT_SKIPPED',
                actorId: 'system',
                reason: 'Insufficient funds',
                details: skipDetails
            }));
        }
    }
    
    console.log(`Automated repayment process finished. Processed ${processedCount} installments.`);
    return { success: true, message: `Processed ${overdueInstallments.length} overdue installments, successfully repaid ${processedCount}.`, processedCount };
}
