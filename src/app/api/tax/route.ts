
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit-log';

// GET the global tax configuration
export async function GET(req: NextRequest) {
    try {
        let config = await prisma.tax.findFirst();
        
        // If no config exists, create a default one
        if (!config) {
            config = await prisma.tax.create({
                data: {
                    name: 'VAT',
                    rate: 0,
                    appliedTo: '[]'
                }
            });
        }
        
        return NextResponse.json(config);

    } catch (error) {
        console.error('Error fetching tax config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST (upsert) the global tax configuration
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const { name, rate, appliedTo } = body;
        
        const existingConfig = await prisma.tax.findFirst();
        
        const dataToSave = {
            name: name,
            rate: parseFloat(rate),
            appliedTo: appliedTo // expecting JSON string
        };

        const newConfig = await prisma.tax.upsert({
            where: { id: existingConfig?.id || '---' }, // Use a dummy ID if it doesn't exist
            update: dataToSave,
            create: dataToSave
        });
        
        await createAuditLog({
            actorId: session.userId,
            action: 'TAX_CONFIG_UPDATE',
            entity: 'SYSTEM',
            details: { newConfig: dataToSave }
        });

        return NextResponse.json(newConfig, { status: 200 });

    } catch (error) {
        console.error('Error saving tax config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
