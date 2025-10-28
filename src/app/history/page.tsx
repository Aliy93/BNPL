
import type { LoanDetails, LoanProvider, Tax } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HistoryClient } from '@/components/history/history-client';
import prisma from '@/lib/prisma';
import { calculateTotalRepayable } from '@/lib/loan-calculator';


async function getProviders(): Promise<LoanProvider[]> {
    const providers = await prisma.loanProvider.findMany({
        orderBy: { displayOrder: 'asc' }
    });
    return providers as LoanProvider[];
}


async function getLoanHistory(borrowerId: string): Promise<LoanDetails[]> {
    try {
        if (!borrowerId) return [];

        const [loans, taxConfig] = await Promise.all([
            prisma.loan.findMany({
                where: { borrowerId },
                include: {
                    product: {
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
            }),
            prisma.tax.findFirst()
        ]);

        return loans.map(loan => {
            const parsedProduct = {
                ...loan.product,
                serviceFee: JSON.parse(loan.product.serviceFee as string),
                dailyFee: JSON.parse(loan.product.dailyFee as string),
                penaltyRules: JSON.parse(loan.product.penaltyRules as string),
            };

            const { total: totalRepayable } = calculateTotalRepayable(loan as any, parsedProduct, taxConfig, new Date());

            return {
                id: loan.id,
                providerId: loan.product.providerId,
                providerName: loan.product.provider.name,
                productName: loan.product.name,
                loanAmount: loan.loanAmount,
                serviceFee: loan.serviceFee,
                disbursedDate: loan.disbursedDate,
                dueDate: loan.dueDate,
                repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
                repaidAmount: loan.repaidAmount || 0,
                penaltyAmount: loan.penaltyAmount,
                product: parsedProduct,
                totalRepayableAmount: totalRepayable,
                payments: loan.payments.map(p => ({
                    id: p.id,
                    amount: p.amount,
                    date: p.date,
                    outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
                }))
            } as LoanDetails;
        });
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getTaxConfig(): Promise<Tax | null> {
    return await prisma.tax.findFirst();
}


export default async function HistoryPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const borrowerId = searchParams['borrowerId'] as string;
    
    const [loanHistory, providers, taxConfig] = await Promise.all([
        getLoanHistory(borrowerId),
        getProviders(),
        getTaxConfig()
    ]);
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <HistoryClient initialLoanHistory={loanHistory} providers={providers} taxConfig={taxConfig} />
        </Suspense>
    );
}
