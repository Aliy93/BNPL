
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import { toCamelCase } from '@/lib/utils';


const updateCustomerStatusSchema = z.object({
  customerId: z.string(),
  status: z.string(),
});

export async function GET(req: NextRequest) {
    try {
        const customers = await prisma.customer.findMany({
            include: {
                provisionedData: { // Fetch all provisioned data for each customer
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                id: 'asc'
            }
        });

        const formattedCustomers = customers.map(customer => {
            // Merge all provisioned data for a customer into a single object
            const combinedData = customer.provisionedData.reduce((acc, entry) => {
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
                id: customer.id,
                ...combinedData,
            };
        });

        return NextResponse.json(formattedCustomers);

    } catch (error) {
        console.error('Failed to fetch customers:', error);
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
        const { customerId, status } = updateCustomerStatusSchema.parse(body);

        const updatedCustomer = await prisma.customer.update({
            where: { id: customerId },
            data: { status },
        });

        return NextResponse.json(updatedCustomer);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error updating customer status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
