
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

// GET all merchants
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const merchants = await prisma.merchant.findMany({
            include: {
                provider: true,
            },
            orderBy: {
                name: 'asc'
            }
        });
        return NextResponse.json(merchants);
    } catch (error) {
        console.error('Failed to fetch merchants:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST a new merchant
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { name, businessType, contactInfo, providerId, status } = body;

        if (!name || !businessType || !contactInfo || !providerId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newMerchant = await prisma.merchant.create({
            data: {
                name,
                businessType,
                contactInfo,
                providerId,
                status: status || 'Active',
            },
            include: {
                provider: true
            }
        });

        return NextResponse.json(newMerchant, { status: 201 });
    } catch (error) {
        console.error('Failed to create merchant:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT to update a merchant
export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, ...dataToUpdate } = body;

        if (!id) {
            return NextResponse.json({ error: 'Merchant ID is required for update' }, { status: 400 });
        }

        const updatedMerchant = await prisma.merchant.update({
            where: { id },
            data: dataToUpdate,
            include: {
                provider: true
            }
        });

        return NextResponse.json(updatedMerchant);
    } catch (error) {
        console.error('Failed to update merchant:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// DELETE a merchant
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
    }

    try {
        // Optional: Check if merchant has associated orders before deleting
        const orderCount = await prisma.order.count({ where: { merchantId: id } });
        if (orderCount > 0) {
            return NextResponse.json({ error: 'Cannot delete merchant with active orders.' }, { status: 409 });
        }

        await prisma.merchant.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Merchant deleted successfully' });
    } catch (error: any) {
        console.error('Failed to delete merchant:', error);
        if (error.code === 'P2025') {
            return NextResponse.json({ message: 'Merchant not found or already deleted.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
