
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import { loanCreationSchema } from '@/lib/schemas';
import { checkLoanEligibility } from '@/actions/eligibility';
import { createAuditLog } from '@/lib/audit-log';

async function handleInstallmentPlanCreation(data: z.infer<typeof loanCreationSchema>) {
    return await prisma.$transaction(async (tx) => {
        // This is now effectively creating the financing record (OrderId) and the InstallmentPlan (Loan)
        const financingApplication = await tx.loanApplication.create({
            data: {
                borrowerId: data.borrowerId,
                productId: data.productId,
                loanAmount: data.loanAmount,
                status: 'DISBURSED', // BNPL implies instant disbursement to merchant
            }
        });

        const product = await tx.loanProduct.findUnique({
            where: { id: data.productId },
            include: {
                provider: {
                    include: {
                        ledgerAccounts: true
                    }
                }
            }
        });

        if (!product) {
            throw new Error('Installment plan product not found.');
        }
        
        if (product.provider.initialBalance < data.loanAmount) {
            throw new Error(`Insufficient provider funds. Available: ${product.provider.initialBalance}, Requested: ${data.loanAmount}`);
        }

        const provider = product.provider;
        
        const tempPlanForCalc = {
            id: 'temp',
            loanAmount: data.loanAmount,
            disbursedDate: new Date(data.disbursedDate),
            dueDate: new Date(data.dueDate),
            serviceFee: 0,
            repaymentStatus: 'Unpaid' as 'Unpaid' | 'Paid',
            payments: [],
            productName: product.name,
            providerName: product.provider.name,
            repaidAmount: 0,
            penaltyAmount: 0,
            product: product as any,
        };
        const { serviceFee: calculatedServiceFee } = calculateTotalRepayable(tempPlanForCalc, product, new Date(data.disbursedDate));

        const principalReceivableAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'Principal' && acc.type === 'Receivable');
        const serviceFeeReceivableAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'ServiceFee' && acc.type === 'Receivable');
        const serviceFeeIncomeAccount = provider.ledgerAccounts.find((acc: any) => acc.category === 'ServiceFee' && acc.type === 'Income');
        if (!principalReceivableAccount) throw new Error('Principal Receivable ledger account not found.');
        if (calculatedServiceFee > 0 && (!serviceFeeReceivableAccount || !serviceFeeIncomeAccount)) throw new Error('Service Fee ledger accounts not configured.');


        const createdInstallmentPlan = await tx.loan.create({
            data: {
                borrowerId: data.borrowerId,
                productId: data.productId,
                loanApplicationId: financingApplication.id, // This is the OrderId
                loanAmount: data.loanAmount,
                disbursedDate: data.disbursedDate,
                dueDate: data.dueDate,
                serviceFee: calculatedServiceFee,
                penaltyAmount: 0,
                repaymentStatus: 'Unpaid',
                repaidAmount: 0,
            }
        });
        
        const journalEntry = await tx.journalEntry.create({
            data: {
                providerId: provider.id,
                loanId: createdInstallmentPlan.id,
                date: new Date(data.disbursedDate),
                description: `Financing for Order ${financingApplication.id} to customer ${data.borrowerId}`,
            }
        });
        
        await tx.ledgerEntry.createMany({
            data: [{
                journalEntryId: journalEntry.id,
                ledgerAccountId: principalReceivableAccount.id,
                type: 'Debit',
                amount: data.loanAmount
            }]
        });
        
        if (calculatedServiceFee > 0 && serviceFeeReceivableAccount && serviceFeeIncomeAccount) {
            await tx.ledgerEntry.createMany({
                data: [
                    { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeReceivableAccount.id, type: 'Debit', amount: calculatedServiceFee },
                    { journalEntryId: journalEntry.id, ledgerAccountId: serviceFeeIncomeAccount.id, type: 'Credit', amount: calculatedServiceFee }
                ]
            });
            await tx.ledgerAccount.update({ where: { id: serviceFeeReceivableAccount.id }, data: { balance: { increment: calculatedServiceFee } } });
            await tx.ledgerAccount.update({ where: { id: serviceFeeIncomeAccount.id }, data: { balance: { increment: calculatedServiceFee } } });
        }

        await tx.ledgerAccount.update({ where: { id: principalReceivableAccount.id }, data: { balance: { increment: data.loanAmount } } });
        // This now represents the settlement to the merchant
        await tx.loanProvider.update({ where: { id: provider.id }, data: { initialBalance: { decrement: data.loanAmount } } });
        
        return createdInstallmentPlan;
    });
}

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return new NextResponse(null, { status: 405, statusText: "Method Not Allowed" });
    }
    let planDetailsForLogging: any = {};
    try {
        const body = await req.json();
        const data = loanCreationSchema.parse(body);
        planDetailsForLogging = { ...data };

        const product = await prisma.loanProduct.findUnique({
            where: { id: data.productId },
        });
        
        if (!product) {
            throw new Error('Installment plan product not found.');
        }

        const logDetails = { customerId: data.borrowerId, productId: data.productId, amount: data.loanAmount };
        await createAuditLog({ actorId: 'system', action: 'FINANCING_INITIATED', entity: 'ORDER', details: logDetails });

        const { isEligible, maxLoanAmount, reason } = await checkLoanEligibility(data.borrowerId, product.providerId, product.id);

        if (!isEligible) {
            throw new Error(`Financing denied: ${reason}`);
        }

        if (data.loanAmount > maxLoanAmount) {
            throw new Error(`Purchase amount of ${data.loanAmount} exceeds the maximum allowed spending limit of ${maxLoanAmount}.`);
        }

        const newInstallmentPlan = await handleInstallmentPlanCreation(data);

        const successLogDetails = {
            installmentPlanId: newInstallmentPlan.id,
            customerId: newInstallmentPlan.borrowerId,
            productId: newInstallmentPlan.productId,
            amount: newInstallmentPlan.loanAmount,
            serviceFee: newInstallmentPlan.serviceFee,
        };
        await createAuditLog({ actorId: 'system', action: 'FINANCING_SUCCESS', entity: 'ORDER', entityId: newInstallmentPlan.loanApplicationId!, details: successLogDetails });

        return NextResponse.json(newInstallmentPlan, { status: 201 });

    } catch (error) {
        const errorMessage = (error instanceof z.ZodError) ? error.errors : (error as Error).message;
        const failureLogDetails = {
            ...planDetailsForLogging,
            error: errorMessage,
        };
        await createAuditLog({ actorId: 'system', action: 'FINANCING_FAILED', entity: 'ORDER', details: failureLogDetails });

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error("Error in POST /api/loans:", error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}
