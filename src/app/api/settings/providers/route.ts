
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit-log';

// Note: GET method is in /api/providers/route.ts to be public

const defaultLedgerAccounts = [
    // Assets (Receivables)
    { name: 'Principal Receivable', type: 'Receivable', category: 'Principal' },
    { name: 'Interest Receivable', type: 'Receivable', category: 'Interest' },
    { name: 'Service Fee Receivable', type: 'Receivable', category: 'ServiceFee' },
    { name: 'Penalty Receivable', type: 'Receivable', category: 'Penalty' },
    // Cash / Received
    { name: 'Principal Received', type: 'Received', category: 'Principal' },
    { name: 'Interest Received', type: 'Received', category: 'Interest' },
    { name: 'Service Fee Received', type: 'Received', category: 'ServiceFee' },
    { name: 'Penalty Received', type: 'Received', category: 'Penalty' },
    // Income
    { name: 'Interest Income', type: 'Income', category: 'Interest' },
    { name: 'Service Fee Income', type: 'Income', category: 'ServiceFee' },
    { name: 'Penalty Income', type: 'Income', category: 'Penalty' },
];


export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';

    try {
        const body = await req.json();
        const { startingCapital, ...restOfBody } = body;
        
        const logDetails = { providerName: restOfBody.name };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_CREATE_INITIATED', entity: 'PROVIDER', details: logDetails, ipAddress, userAgent });
        console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_CREATE_INITIATED', actorId: session.userId }));

        // Use a transaction to create the provider and its ledger accounts
        const newProvider = await prisma.$transaction(async (tx) => {
            const provider = await tx.loanProvider.create({
                data: {
                    ...restOfBody,
                    startingCapital: startingCapital,
                    initialBalance: startingCapital, // Both start with the same value
                },
            });

            const accountsToCreate = defaultLedgerAccounts.map(acc => ({
                ...acc,
                providerId: provider.id,
            }));

            await tx.ledgerAccount.createMany({
                data: accountsToCreate,
            });

            return provider;
        });

        const successLogDetails = { providerId: newProvider.id, providerName: newProvider.name };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_CREATE_SUCCESS', entity: 'PROVIDER', entityId: newProvider.id, details: successLogDetails, ipAddress, userAgent });
        console.log(JSON.stringify({ ...successLogDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_CREATE_SUCCESS', actorId: session.userId }));

        return NextResponse.json(newProvider, { status: 201 });
    } catch (error) {
        const errorMessage = (error as Error).message;
        const failureLogDetails = { error: errorMessage };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_CREATE_FAILED', entity: 'PROVIDER', details: failureLogDetails, ipAddress, userAgent });
        console.error(JSON.stringify({ ...failureLogDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_CREATE_FAILED', actorId: session.userId }));
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
     const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';

    try {
        const body = await req.json();
        const { id, ...dataToUpdate } = body;
        
        if (!id) {
            return NextResponse.json({ error: 'Provider ID is required for update.' }, { status: 400 });
        }
        
        const logDetails = { providerId: id, updatedFields: Object.keys(dataToUpdate) };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_UPDATE_INITIATED', entity: 'PROVIDER', entityId: id, details: logDetails, ipAddress, userAgent });
        console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_UPDATE_INITIATED', actorId: session.userId }));

        // Do not allow startingCapital to be changed on update
        if ('startingCapital' in dataToUpdate) {
            delete dataToUpdate.startingCapital;
        }


        const updatedProvider = await prisma.loanProvider.update({
            where: { id },
            data: dataToUpdate,
        });

        const successLogDetails = { providerId: updatedProvider.id, updatedFields: Object.keys(dataToUpdate) };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_UPDATE_SUCCESS', entity: 'PROVIDER', entityId: updatedProvider.id, details: successLogDetails, ipAddress, userAgent });
        console.log(JSON.stringify({ ...successLogDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_UPDATE_SUCCESS', actorId: session.userId }));

        return NextResponse.json(updatedProvider);
    } catch (error) {
        const errorMessage = (error as Error).message;
        const failureLogDetails = { error: errorMessage };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_UPDATE_FAILED', entity: 'PROVIDER', details: failureLogDetails, ipAddress, userAgent });
        console.error(JSON.stringify({ ...failureLogDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_UPDATE_FAILED', actorId: session.userId }));
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
     const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    try {
        if (!id) {
            throw new Error('Provider ID is required');
        }

        const logDetails = { providerId: id };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_DELETE_INITIATED', entity: 'PROVIDER', entityId: id, details: logDetails, ipAddress, userAgent });
        console.log(JSON.stringify({ ...logDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_DELETE_INITIATED', actorId: session.userId }));
        
        const productCount = await prisma.loanProduct.count({ where: { providerId: id } });
        if (productCount > 0) {
            throw new Error('Cannot delete provider with associated products.');
        }

        const providerToDelete = await prisma.loanProvider.findUnique({ where: { id }});
        
        await prisma.loanProvider.delete({
            where: { id: id },
        });

        const successLogDetails = { deletedProviderId: id, deletedProviderName: providerToDelete?.name };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_DELETE_SUCCESS', entity: 'PROVIDER', entityId: id, details: successLogDetails, ipAddress, userAgent });
        console.log(JSON.stringify({ ...successLogDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_DELETE_SUCCESS', actorId: session.userId }));

        return NextResponse.json({ message: 'Provider deleted successfully' });
    } catch (error) {
        const errorMessage = (error as Error).message;
        const failureLogDetails = { providerId: id, error: errorMessage };
        await createAuditLog({ actorId: session.userId, action: 'PROVIDER_DELETE_FAILED', entity: 'PROVIDER', entityId: id || undefined, details: failureLogDetails, ipAddress, userAgent });
         console.error(JSON.stringify({ ...failureLogDetails, timestamp: new Date().toISOString(), action: 'PROVIDER_DELETE_FAILED', actorId: session.userId }));
        return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
    }
}
