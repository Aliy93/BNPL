
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const customers = await prisma.borrower.findMany({
            where: {
                status: 'NPL'
            },
            include: {
                loans: {
                    where: {
                        repaymentStatus: 'Unpaid'
                    },
                    select: {
                        loanAmount: true,
                        dueDate: true,
                        repaymentStatus: true,
                    }
                }
            }
        });
        return NextResponse.json(customers);

    } catch (error) {
        console.error('Failed to fetch NPL customers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
