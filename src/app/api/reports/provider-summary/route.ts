
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, differenceInDays, isValid } from 'date-fns';

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
}

async function getAggregatedLedgerEntries(providerId: string, timeframe: string, from: string | null, to: string | null, entryType: 'Debit' | 'Credit', accountTypes: string[], categories: string[]) {
     const dateRange = getDates(timeframe, from ?? undefined, to ?? undefined);
     const result = await prisma.ledgerEntry.groupBy({
        by: ['ledgerAccountId'],
        where: {
            journalEntry: {
                providerId: providerId,
                ...(dateRange.gte && { date: { gte: dateRange.gte } }),
                ...(dateRange.lte && { date: { lte: dateRange.lte } }),
            },
            type: entryType,
            ledgerAccount: {
                type: { in: accountTypes },
                category: { in: categories }
            }
        },
        _sum: {
            amount: true
        }
    });

    const accountIds = result.map(r => r.ledgerAccountId);
    const accounts = await prisma.ledgerAccount.findMany({ where: { id: { in: accountIds } } });
    const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

    const aggregated = categories.reduce((acc, cat) => ({...acc, [cat.toLowerCase()]: 0}), {} as Record<string, number>);

    for (const item of result) {
        const account = accountMap.get(item.ledgerAccountId);
        if (account) {
            const key = account.category.toLowerCase();
            if (aggregated.hasOwnProperty(key)) {
                aggregated[key] += item._sum.amount || 0;
            }
        }
    }
    return aggregated;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const timeframe = searchParams.get('timeframe') || 'daily';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!providerId) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    try {
        const dateRange = getDates(timeframe, from ?? undefined, to ?? undefined);

        // 1. Portfolio Summary
        const disbursedResult = await prisma.loan.aggregate({
            _sum: { loanAmount: true },
            where: {
                product: { providerId },
                ...(dateRange.gte && { disbursedDate: { gte: dateRange.gte } }),
                ...(dateRange.lte && { disbursedDate: { lte: dateRange.lte } }),
            },
        });

        const repaidResult = await prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
                loan: { product: { providerId } },
                ...(dateRange.gte && { date: { gte: dateRange.gte } }),
                ...(dateRange.lte && { date: { lte: dateRange.lte } }),
            },
        });
        
        const outstandingLoans = await prisma.loan.aggregate({
            _sum: { loanAmount: true },
            where: {
                product: { providerId },
                repaymentStatus: 'Unpaid'
            }
        });
        
        const portfolioSummary = {
            disbursed: disbursedResult._sum.loanAmount || 0,
            repaid: repaidResult._sum.amount || 0,
            outstanding: outstandingLoans._sum.loanAmount || 0,
        };
        
        // 2. Collections Report
        const collections = await getAggregatedLedgerEntries(providerId, timeframe, from, to, 'Debit', ['Received'], ['Principal', 'Interest', 'ServiceFee', 'Penalty']);
        const totalCollected = Object.values(collections).reduce((sum, val) => sum + val, 0);

        // 3. Income Statement
        const accruedIncome = await getAggregatedLedgerEntries(providerId, timeframe, from, to, 'Credit', ['Income'], ['Interest', 'ServiceFee', 'Penalty']);
        const collectedIncome = await getAggregatedLedgerEntries(providerId, timeframe, from, to, 'Debit', ['Received'], ['Interest', 'ServiceFee', 'Penalty']);
        const netRealizedIncome = (collectedIncome.interest || 0) + (collectedIncome.servicefee || 0) + (collectedIncome.penalty || 0);

        // 4. Fund Utilization
        const provider = await prisma.loanProvider.findUnique({ where: { id: providerId } });
        const totalDisbursedEver = (await prisma.loan.aggregate({ _sum: { loanAmount: true }, where: { product: { providerId } } }))._sum.loanAmount || 0;
        const fundUtilization = provider && provider.startingCapital > 0 ? (totalDisbursedEver / provider.startingCapital) * 100 : 0;

        // 5. Aging Report (snapshot as of today)
        const today = startOfDay(new Date());
        const overdueLoans = await prisma.loan.findMany({
            where: {
                product: { providerId },
                repaymentStatus: 'Unpaid',
                dueDate: { lt: today }
            }
        });

        const agingBuckets = { '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0 };
        overdueLoans.forEach(loan => {
            const daysOverdue = differenceInDays(today, loan.dueDate);
            if (daysOverdue <= 30) agingBuckets['1-30']++;
            else if (daysOverdue <= 60) agingBuckets['31-60']++;
            else if (daysOverdue <= 90) agingBuckets['61-90']++;
            else agingBuckets['91+']++;
        });


        return NextResponse.json({
            portfolioSummary,
            collectionsReport: { ...collections, total: totalCollected },
            incomeStatement: { accrued: accruedIncome, collected: collectedIncome, net: netRealizedIncome },
            fundUtilization,
            agingReport: {
                buckets: agingBuckets,
                totalOverdue: overdueLoans.length
            }
        });
    } catch (error) {
        console.error('Failed to fetch provider report data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
