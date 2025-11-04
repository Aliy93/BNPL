

import { DashboardClient } from '@/components/dashboard/dashboard-client';
import type { LoanDetails, LoanProvider, FeeRule, PenaltyRule, Tax } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import prisma from '@/lib/prisma';

// Helper function to safely parse JSON from DB
const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

async function getProviders(): Promise<LoanProvider[]> {
    try {
        const providers = await prisma.financingPartner.findMany({
            include: {
                paymentPlans: {
                    where: {
                        status: 'Active'
                    },
                    orderBy: {
                        name: 'asc'
                    }
                }
            },
            orderBy: {
                displayOrder: 'asc'
            }
        });

        return providers.map(p => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            colorHex: p.colorHex,
            displayOrder: p.displayOrder,
            accountNumber: p.accountNumber,
            startingCapital: p.startingCapital,
            initialBalance: p.initialBalance,
            allowCrossProviderLoans: p.allowCrossProviderLoans,
            nplThresholdDays: p.nplThresholdDays,
            products: p.paymentPlans.map(prod => ({
                id: prod.id,
                providerId: p.id,
                name: prod.name,
                description: prod.description,
                icon: prod.icon,
                minLoan: prod.minLoan,
                maxLoan: prod.maxLoan,
                duration: prod.duration,
                serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }) as FeeRule,
                dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }) as FeeRule,
                penaltyRules: safeJsonParse(prod.penaltyRules, []) as PenaltyRule[],
                status: prod.status as 'Active' | 'Disabled',
                allowConcurrentLoans: prod.allowConcurrentLoans,
            }))
        })) as LoanProvider[];
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getLoanHistory(customerId: string): Promise<LoanDetails[]> {
    try {
        if (!customerId) return [];

        const loans = await prisma.installmentPlan.findMany({
            where: { customerId },
            include: {
                paymentPlanProduct: {
                    include: {
                        provider: true
                    }
                },
                payments: {
                    orderBy: {
                        date: 'asc'
                    }
                }
            },
            orderBy: {
                disbursedDate: 'desc'
            }
        });

        return loans.map(loan => ({
            id: loan.id,
            borrowerId: loan.customerId,
            providerName: loan.paymentPlanProduct.provider.name,
            productName: loan.paymentPlanProduct.name,
            loanAmount: loan.loanAmount,
            serviceFee: loan.serviceFee,
            disbursedDate: loan.disbursedDate,
            dueDate: loan.dueDate,
            repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
            repaidAmount: loan.repaidAmount || 0,
            penaltyAmount: loan.penaltyAmount,
            product: {
              ...loan.paymentPlanProduct,
              id: loan.paymentPlanProduct.id,
              providerId: loan.paymentPlanProduct.providerId,
              serviceFee: safeJsonParse(loan.paymentPlanProduct.serviceFee, { type: 'percentage', value: 0 }),
              dailyFee: safeJsonParse(loan.paymentPlanProduct.dailyFee, { type: 'percentage', value: 0 }),
              penaltyRules: safeJsonParse(loan.paymentPlanProduct.penaltyRules, []),
            },
            payments: loan.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.date,
                outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
            }))
        })) as LoanDetails[];
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getTaxConfig(): Promise<Tax | null> {
    return await prisma.tax.findFirst();
}


export default async function LoanPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const customerId = searchParams['borrowerId'] as string;
    
    const [providers, loanHistory, taxConfig] = await Promise.all([
        getProviders(),
        getLoanHistory(customerId),
        getTaxConfig(),
    ]);
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <DashboardClient providers={providers} initialLoanHistory={loanHistory} taxConfig={taxConfig} />
        </Suspense>
    );
}
