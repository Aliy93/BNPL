import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const merchantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessType: z.string().min(1, 'Business type is required'),
  contactInfo: z.string().min(1, 'Contact info is required'),
  bankAccount: z.string().min(1, 'Bank account is required'),
  status: z.enum(['Active', 'Pending', 'Inactive']),
});

// GET all merchants
export async function GET() {
  try {
    const merchants = await prisma.merchant.findMany({
        orderBy: { name: 'asc' }
    });
    return NextResponse.json(merchants);
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST a new merchant
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = merchantSchema.parse(body);

        const newMerchant = await prisma.merchant.create({ data });
        return NextResponse.json(newMerchant, { status: 201 });
    } catch (error) {
         if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error creating merchant:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT to update a merchant
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...data } = merchantSchema.extend({ id: z.string() }).parse(body);

        const updatedMerchant = await prisma.merchant.update({
            where: { id },
            data,
        });

        return NextResponse.json(updatedMerchant);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        console.error('Error updating merchant:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE a merchant
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
    }

    try {
        await prisma.merchant.delete({
            where: { id },
        });
        return NextResponse.json({ message: 'Merchant deleted successfully' });
    } catch (error) {
        console.error('Error deleting merchant:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
