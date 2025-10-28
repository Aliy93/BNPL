
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// This route fetches all columns from all data provisioning configs for a given provider,
// and now also includes hardcoded behavioral metrics.
// These can be used as custom parameters in the credit scoring engine.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    try {
        const configs = await prisma.dataProvisioningConfig.findMany({
            where: { providerId },
        });

        // Flatten all columns from all configs into a single array
        let customParameters = configs.flatMap(config => {
            try {
                const columns = JSON.parse(config.columns as string);
                // Map to a more detailed object for the frontend
                return columns.map((col: { name: string, type: string, options?: string[] }) => ({
                    value: col.name, // The technical field name
                    label: col.name, // The display name
                    type: col.options && typeof col.options === 'object' && col.options.length > 0 ? 'select' : col.type,
                    options: col.options || []
                }));
            } catch (e) {
                return [];
            }
        });

        // --- NEW: Add hardcoded behavioral parameters ---
        const behavioralParameters = [
            { value: 'totalLoansCount', label: 'Total Loans Count', type: 'number', options: [] },
            { value: 'loansOnTime', label: 'Loans Paid On Time', type: 'number', options: [] },
            { value: 'loansLate', label: 'Loans Paid Late', type: 'number', options: [] },
            { value: 'loansEarly', label: 'Loans Paid Early', type: 'number', options: [] },
        ];
        
        customParameters = customParameters.concat(behavioralParameters);
        // --- END NEW ---

        // Remove duplicates in case multiple configs have the same column name
        const uniqueParameters = Array.from(new Map(customParameters.map(item => [item['value'], item])).values());


        return NextResponse.json(uniqueParameters);
    } catch (error) {
        console.error('Error fetching custom parameters:', error);
        return NextResponse.json({ error: 'Internal ServerError' }, { status: 500 });
    }
}
