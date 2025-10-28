

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, isValid } from 'date-fns';

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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const timeframe = searchParams.get('timeframe') || 'overall';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const dateRange = getDates(timeframe, from ?? undefined, to ?? undefined);

    const whereClause: any = {
        type: 'Debit',
        ledgerAccount: {
            type: 'Received'
        },
        journalEntry: {
            ...(dateRange.gte && { date: { gte: dateRange.gte } }),
            ...(dateRange.lte && { date: { lte: dateRange.lte } }),
        }
    };
    
    if (providerId && providerId !== 'all') {
        whereClause.journalEntry.providerId = providerId;
    }

    try {
        const ledgerEntries = await prisma.ledgerEntry.findMany({
            where: whereClause,
            select: {
                amount: true,
                journalEntry: {
                    select: {
                        date: true,
                        provider: {
                            select: { name: true }
                        }
                    }
                },
                ledgerAccount: {
                    select: { category: true }
                }
            }
        });

        const aggregatedData: Record<string, {
            provider: string;
            principal: number;
            interest: number;
            serviceFee: number;
            penalty: number;
            tax: number;
        }> = {};
        
        for (const entry of ledgerEntries) {
            const dateStr = format(new Date(entry.journalEntry.date), 'yyyy-MM-dd');
            const providerName = entry.journalEntry.provider.name;
            const key = `${providerName}-${dateStr}`;

            if (!aggregatedData[key]) {
                aggregatedData[key] = {
                    provider: providerName,
                    principal: 0,
                    interest: 0,
                    serviceFee: 0,
                    penalty: 0,
                    tax: 0,
                };
            }

            const category = entry.ledgerAccount.category.toLowerCase();
            if (category === 'principal') aggregatedData[key].principal += entry.amount;
            else if (category === 'interest') aggregatedData[key].interest += entry.amount;
            else if (category === 'servicefee') aggregatedData[key].serviceFee += entry.amount;
            else if (category === 'penalty') aggregatedData[key].penalty += entry.amount;
            else if (category === 'tax') aggregatedData[key].tax += entry.amount;
        }
        
        const reportData = Object.entries(aggregatedData).map(([key, value]) => {
             const [provider, date] = key.split(/-(?=\d{4})/); // Split on hyphen only if followed by 4 digits (a year)
             return {
                provider,
                date,
                ...value,
                total: value.principal + value.interest + value.serviceFee + value.penalty + value.tax,
            }
        });
        
        reportData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Failed to fetch collections report:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
