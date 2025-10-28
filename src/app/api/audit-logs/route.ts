
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // You might want to add role-based access control here
    // For example, only allow 'Super Admin' or 'Auditor' to see logs.

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    try {
        const [logs, totalCount] = await prisma.$transaction([
            prisma.auditLog.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
                skip: skip,
            }),
            prisma.auditLog.count(),
        ]);

        return NextResponse.json({
            logs,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
        });
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
