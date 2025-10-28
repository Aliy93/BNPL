
'use server';
/**
 * @fileOverview Implements logic to identify and flag Non-Performing Loans (NPL).
 *
 * - updateNplStatus: A service to find loans overdue by a certain threshold and flag the borrower as NPL.
 */

import prisma from '@/lib/prisma';
import { subDays } from 'date-fns';

export async function updateNplStatus(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    console.log('Starting NPL status update process...');
    
    // Get all providers and their NPL thresholds
    const providers = await prisma.loanProvider.findMany({
        select: {
            id: true,
            nplThresholdDays: true,
            products: {
                select: {
                    id: true
                }
            }
        }
    });

    if (providers.length === 0) {
        console.log('No providers found to process for NPL.');
        return { success: true, message: 'No providers to process.', updatedCount: 0 };
    }

    let totalUpdatedCount = 0;
    
    for (const provider of providers) {
        const nplThresholdDate = subDays(new Date(), provider.nplThresholdDays);
        const productIds = provider.products.map(p => p.id);

        if (productIds.length === 0) continue;

        // Find all unpaid loans for this provider where the due date has passed the NPL threshold
        const overdueLoans = await prisma.loan.findMany({
            where: {
                productId: { in: productIds },
                repaymentStatus: 'Unpaid',
                disbursedDate: {
                    lt: nplThresholdDate,
                },
            },
            select: {
                borrowerId: true,
            },
        });

        if (overdueLoans.length === 0) {
            continue; // No NPL loans for this provider
        }
        
        const borrowerIdsToFlag = [...new Set(overdueLoans.map(loan => loan.borrowerId))];
        
        try {
            const { count } = await prisma.borrower.updateMany({
                where: {
                    id: {
                        in: borrowerIdsToFlag,
                    },
                    status: {
                        not: 'NPL',
                    },
                },
                data: {
                    status: 'NPL',
                },
            });
            
            totalUpdatedCount += count;
            console.log(`For provider ${provider.id}, updated ${count} borrowers to NPL status.`);

        } catch (error) {
            console.error(`Failed to update NPL statuses for provider ${provider.id}:`, error);
            // We continue to the next provider even if one fails
        }
    }

    console.log(`NPL status update process finished. Updated a total of ${totalUpdatedCount} borrowers.`);
    return { success: true, message: `Successfully updated a total of ${totalUpdatedCount} borrowers to NPL status.`, updatedCount: totalUpdatedCount };
}
