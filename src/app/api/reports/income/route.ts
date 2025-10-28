
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isValid } from 'date-fns';

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

async function getIncomeData(providerIdFilter: any, dateFilter: any) {
    const whereClause: any = {
        journalEntry: {
            ...providerIdFilter.journalEntry,
            ...dateFilter.journalEntry,
        },
        ledgerAccount: {
            type: { in: ['Income', 'Received'] },
            category: { in: ['Interest', 'ServiceFee', 'Penalty'] }
        }
    };
    
    const results = await prisma.ledgerEntry.groupBy({
        by: ['type', 'ledgerAccountId'],
        where: whereClause,
        _sum: {
            amount: true
        }
    });

    const accountIds = results.map(r => r.ledgerAccountId);
    const accounts = await prisma.ledgerAccount.findMany({ 
        where: { id: { in: accountIds } },
        select: { id: true, category: true, type: true, providerId: true }
    });
    const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

    const income = {
        accruedInterest: 0, collectedInterest: 0,
        accruedServiceFee: 0, collectedServiceFee: 0,
        accruedPenalty: 0, collectedPenalty: 0,
    };

    for (const res of results) {
        const account = accountMap.get(res.ledgerAccountId);
        if (!account) continue;

        const amount = res._sum.amount || 0;
        const category = account.category;
        
        // Income is a credit to the income account, but a debit to the received account
        if (category === 'Interest') {
            if (account.type === 'Income') income.accruedInterest += amount;
            else if (account.type === 'Received') income.collectedInterest += amount;
        } else if (category === 'ServiceFee') {
            if (account.type === 'Income') income.accruedServiceFee += amount;
            else if (account.type === 'Received') income.collectedServiceFee += amount;
        } else if (category === 'Penalty') {
            if (account.type === 'Income') income.accruedPenalty += amount;
            else if (account.type === 'Received') income.collectedPenalty += amount;
        }
    }
    return income;
}


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const timeframe = searchParams.get('timeframe') || 'overall';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const dateRange = getDates(timeframe, from ?? undefined, to ?? undefined);

    try {
        const allProviders = await prisma.loanProvider.findMany({
            where: providerId && providerId !== 'all' ? { id: providerId } : {}
        });

        const reportData = [];

        for (const provider of allProviders) {
            const providerIdFilter = { journalEntry: { providerId: provider.id } };
            const dateFilter = {
                journalEntry: {
                    ...(dateRange.gte && { date: { gte: dateRange.gte } }),
                    ...(dateRange.lte && { date: { lte: dateRange.lte } }),
                }
            };
            
            const income = await getIncomeData(providerIdFilter, dateFilter);
            reportData.push({
                provider: provider.name,
                ...income
            });
        }
        
        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Failed to fetch income report:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
