
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays, isValid } from 'date-fns';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import type { InstallmentPlan, PaymentPlanProduct, Payment, ProvisionedData } from '@prisma/client';

const getDates = (timeframe: string, from?: string, to?: string) => {
    if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if(isValid(fromDate) && isValid(toDate)) {
            return { gte: startOfDay(fromDate), lte: endOfDay(toDate) };
        }
    }
    const now = new Date();
    switch (timeframe) {
        case 'daily':
            return { gte: startOfDay(now), lte: endOfDay(now) };
        case 'weekly':
            return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'monthly':
            return { gte: startOfMonth(now), lte: endOfMonth(now) };
        case 'yearly':
            return { gte: startOfYear(now), lte: endOfYear(now) };
        case 'overall':
        default:
            return { gte: undefined, lte: undefined };
    }
};

type InstallmentPlanWithRelations = InstallmentPlan & {
    paymentPlanProduct: PaymentPlanProduct & { provider: { name: string } };
    payments: Payment[];
    customer: {
        id: string;
        provisionedData: ProvisionedData[];
     };
};

const getCustomerName = (customer: { provisionedData: ProvisionedData[] }): string => {
    if (!customer || !customer.provisionedData || customer.provisionedData.length === 0) {
        return 'N/A';
    }
    // Find the latest provisioned data that might have a name
    for (const entry of customer.provisionedData) {
         try {
            const data = JSON.parse(entry.data as string);
            const fullNameKey = Object.keys(data).find(k => k.toLowerCase() === 'fullname' || k.toLowerCase() === 'full name');
            if (fullNameKey && data[fullNameKey]) {
                return data[fullNameKey];
            }
        } catch (e) {
            // Ignore parsing errors
        }
    }
    return 'N/A';
};


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const timeframe = searchParams.get('timeframe') || 'overall';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const dateRange = getDates(timeframe, from ?? undefined, to ?? undefined);

    const whereClause: any = {};

    if (dateRange.gte && dateRange.lte) {
        whereClause.disbursedDate = {
            gte: dateRange.gte,
            lte: dateRange.lte,
        };
    }

    if (providerId && providerId !== 'all') {
        whereClause.paymentPlanProduct = { providerId };
    }

    try {
        const [installments, taxConfig] = await Promise.all([
            prisma.installmentPlan.findMany({
                where: whereClause,
                include: {
                    paymentPlanProduct: {
                        include: {
                            provider: true,
                        },
                    },
                    payments: true,
                    customer: {
                       include: {
                            provisionedData: {
                                orderBy: {
                                    createdAt: 'desc'
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    disbursedDate: 'desc',
                },
            }),
            prisma.tax.findFirst()
        ]);
        
        const today = new Date();
        const reportData = installments.map(installment => {
            const { total, principal, interest, penalty, serviceFee } = calculateTotalRepayable(installment as any, installment.paymentPlanProduct, taxConfig, today);
            
            const totalRepaid = (installment.repaidAmount || 0);

            const penaltyPaid = Math.min(totalRepaid, penalty);
            const penaltyOutstanding = penalty - penaltyPaid;

            const serviceFeePaid = Math.min(Math.max(0, totalRepaid - penalty), serviceFee);
            const serviceFeeOutstanding = serviceFee - serviceFeePaid;
            
            const interestPaid = Math.min(Math.max(0, totalRepaid - penalty - serviceFee), interest);
            const interestOutstanding = interest - interestPaid;

            const principalPaid = Math.max(0, totalRepaid - penalty - serviceFee - interest);
            const principalOutstanding = principal - principalPaid;

            const totalOutstanding = Math.max(0, total - totalRepaid);


            let status = 'Current';
            const daysInArrears = differenceInDays(today, installment.dueDate);
            if (installment.repaymentStatus === 'Unpaid' && daysInArrears > 0) {
                status = 'Overdue';
                if (daysInArrears > 60) {
                    status = 'Defaulted';
                }
            } else if (installment.repaymentStatus === 'Paid') {
                status = 'Paid';
            }
            
            const customerName = getCustomerName(installment.customer);
            
            return {
                provider: installment.paymentPlanProduct.provider.name,
                loanId: installment.id,
                borrowerId: installment.customerId,
                borrowerName: customerName !== 'N/A' ? customerName : `C-${installment.customerId.slice(0, 4)}`,
                principalDisbursed: installment.loanAmount,
                principalOutstanding,
                interestOutstanding,
                serviceFeeOutstanding,
                penaltyOutstanding,
                totalOutstanding,
                status,
                daysInArrears: status === 'Overdue' ? daysInArrears : 0,
            };
        });

        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Failed to fetch loans report:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
