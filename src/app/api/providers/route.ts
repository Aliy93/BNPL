
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

export async function GET() {
  try {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: {
                orderBy: {
                    name: 'asc'
                }
            }
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });
    
    const formattedProviders = providers.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        colorHex: p.colorHex,
        displayOrder: p.displayOrder,
        accountNumber: p.accountNumber,
        products: p.products.map(prod => ({
            id: prod.id,
            providerId: p.id,
            name: prod.name,
            description: prod.description,
            icon: prod.icon,
            minLoan: prod.minLoan,
            maxLoan: prod.maxLoan,
            serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }),
            dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }),
            penaltyRules: safeJsonParse(prod.penaltyRules, []),
            status: prod.status,
            serviceFeeEnabled: prod.serviceFeeEnabled,
            dailyFeeEnabled: prod.dailyFeeEnabled,
            penaltyRulesEnabled: prod.penaltyRulesEnabled,
        }))
    }));

    return NextResponse.json(formattedProviders);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
