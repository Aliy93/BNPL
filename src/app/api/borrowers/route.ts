
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { toCamelCase } from '@/lib/utils';


const updateBorrowerStatusSchema = z.object({
  borrowerId: z.string(),
  status: z.string(),
});

export async function GET(req: NextRequest) {
    try {
        const borrowers = await prisma.borrower.findMany({
            include: {
                provisionedData: { // Fetch all provisioned data for each borrower
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                id: 'asc'
            }
        });

        const formattedBorrowers = borrowers.map(borrower => {
            // Merge all provisioned data for a borrower into a single object
            const combinedData = borrower.provisionedData.reduce((acc, entry) => {
                try {
                    const parsedData = JSON.parse(entry.data as string);
                    // Standardize keys to camelCase for consistency
                    const standardizedData: Record<string, any> = {};
                    for (const key in parsedData) {
                        standardizedData[toCamelCase(key)] = parsedData[key];
                    }
                    return { ...acc, ...standardizedData };
                } catch {
                    return acc;
                }
            }, {});

            return {
                id: borrower.id,
                ...combinedData,
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
