
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';

const updateBorrowerStatusSchema = z.object({
  borrowerId: z.string(),
  status: z.string(),
});

export async function GET(req: NextRequest) {
    try {
        const borrowers = await prisma.borrower.findMany({
            include: {
                provisionedData: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1 // Get the most recent provisioned data
                }
            },
            orderBy: {
                id: 'asc'
            }
        });

        const formattedBorrowers = borrowers.map(borrower => {
            let name = `Borrower ${borrower.id}`;
            if (borrower.provisionedData.length > 0) {
                const data = JSON.parse(borrower.provisionedData[0].data as string);
                const nameKey = Object.keys(data).find(k => k.toLowerCase() === 'fullname' || k.toLowerCase() === 'full name');
                if (nameKey && data[nameKey]) {
                    name = data[nameKey];
                }
            }
            return {
                id: borrower.id,
                name: name
            };
        });

        return NextResponse.json(formattedBorrowers);

    } catch (error) {
        console.error('Failed to fetch borrowers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { borrowerId, status } = updateBorrowerStatusSchema.parse(body);

        const updatedBorrower = await prisma.borrower.update({
            where: { id: borrowerId },
            data: { status },
        });

        return NextResponse.json(updatedBorrower);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error updating borrower status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
