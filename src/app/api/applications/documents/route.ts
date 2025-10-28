
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit-log';

// This is a simplified version and does not handle file storage to a bucket.
// It reads the file and stores its content as a base64 string in the database.
// For production, you should store files in a service like S3 or GCS and save the URL.

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const applicationId = formData.get('applicationId') as string | null;
        const requiredDocId = formData.get('requiredDocId') as string | null;

        if (!file || !applicationId || !requiredDocId) {
            return NextResponse.json({ error: 'File, application ID, and required document ID are required' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Content = buffer.toString('base64');
        const dataUri = `data:${file.type};base64,${base64Content}`;

        const upsertData = {
            loanApplicationId: applicationId,
            requiredDocumentId: requiredDocId,
            fileName: file.name,
            fileType: file.type,
            fileContent: dataUri,
            status: 'PENDING', // Reset status on new upload
        };

        const newUpload = await prisma.uploadedDocument.upsert({
            where: {
                loanApplicationId_requiredDocumentId: {
                    loanApplicationId: applicationId,
                    requiredDocumentId: requiredDocId,
                }
            },
            update: upsertData,
            create: upsertData,
        });

        // After all documents are submitted, the status could be updated.
        // For now, we'll let the user manually submit for review.

        await createAuditLog({
            actorId: 'borrower', // In a real app, you'd get this from session
            action: 'DOCUMENT_UPLOADED',
            entity: 'LOAN_APPLICATION',
            entityId: applicationId,
            details: { documentName: file.name, requiredDocumentId: requiredDocId }
        });

        return NextResponse.json(newUpload, { status: 201 });

    } catch (error) {
        console.error('Error uploading document:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
