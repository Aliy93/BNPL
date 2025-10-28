
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (!productId) {
        return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    try {
        const product = await prisma.loanProduct.findUnique({
            where: { id: productId }
        });

        if (!product || !product.eligibilityUploadId) {
            return NextResponse.json({ message: 'No filter to delete.' }, { status: 200 });
        }

        await prisma.$transaction(async (tx) => {
            // First, nullify the link on the product
            await tx.loanProduct.update({
                where: { id: productId },
                data: {
                    eligibilityFilter: null,
                    eligibilityUploadId: null
                }
            });

            // Then, delete the now-orphaned upload record
            await tx.dataProvisioningUpload.delete({
                where: { id: product.eligibilityUploadId! }
            });
        });

        return NextResponse.json({ message: 'Eligibility filter and list deleted successfully.' });

    } catch (error: any) {
        console.error(`Error deleting eligibility filter for product ${productId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
