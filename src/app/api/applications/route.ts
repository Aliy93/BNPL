import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getSession } from '@/lib/session';

const applicationSchema = z.object({
  borrowerId: z.string(),
  productId: z.string(),
  loanAmount: z.number().optional(), // This represents the order amount
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { borrowerId, productId, loanAmount } = applicationSchema.parse(body);

        const product = await prisma.loanProduct.findUnique({
            where: { id: productId },
        });

        if (!product) {
            return NextResponse.json({ error: 'Payment plan product not found' }, { status: 404 });
        }
        
        // Ensure the customer exists before creating an application
        const borrower = await prisma.borrower.findUnique({
            where: { id: borrowerId }
        });
        
        if (!borrower) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Create a new application representing the financing request for an order
        const newApplication = await prisma.loanApplication.create({
            data: {
                borrower: { connect: { id: borrowerId } },
                product: { connect: { id: productId } },
                loanAmount: loanAmount, // Represents the total order amount to be financed
                status: 'APPROVED', // For instant BNPL approval
            }
        });

        return NextResponse.json(newApplication, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error("Error in POST /api/applications:", error);
        const errorMessage = (error as Error).message || 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
