

import { SettingsClient } from '@/components/admin/settings-client';
import type { LoanProvider as LoanProviderType, Tax } from '@/lib/types';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

async function getProviders(userId: string): Promise<LoanProviderType[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { loanProvider: true }
    });

    const whereClause = (user?.role === 'Super Admin' || user?.role === 'Admin')
        ? {}
        : { id: user?.loanProvider?.id };

    const providers = await prisma.loanProvider.findMany({
        where: whereClause,
        include: {
            products: {
                include: {
                    loanAmountTiers: true,
                    eligibilityUpload: true, // <-- This is the critical addition
                },
                orderBy: { name: 'asc' }
            },
            dataProvisioningConfigs: {
                include: {
                    uploads: {
                        orderBy: { uploadedAt: 'desc' }
                    }
                }
            }
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });

    const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
        if (!jsonString) return defaultValue;
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            return defaultValue;
        }
    };
    
    return providers.map(p => ({
        ...p,
        products: p.products.map(prod => ({
            ...prod,
            serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }),
            dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }),
            penaltyRules: safeJsonParse(prod.penaltyRules, []),
        }))
    })) as LoanProviderType[];
}

async function getTaxConfig(): Promise<Tax> {
    let config = await prisma.tax.findFirst();
    if (!config) {
        config = { id: 'default', rate: 0, appliedTo: '[]' };
    }
    return config as Tax;
}


export default async function AdminSettingsPage() {
    const user = await getUserFromSession();
    if (!user) {
        return <div>Not authenticated</div>;
    }
    const providers = await getProviders(user.id);
    const taxConfig = await getTaxConfig();

    return <SettingsClient initialProviders={providers} initialTaxConfig={taxConfig} />;
}




