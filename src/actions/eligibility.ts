
'use server';
/**
 * @fileOverview Implements a loan eligibility check and credit scoring.
 *
 * - checkLoanEligibility - First checks for basic eligibility, then calculates a credit score to determine the maximum loan amount.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max loan amount.
 */

import prisma from '@/lib/prisma';
import { evaluateCondition } from '@/lib/utils';
import type { ScoringParameter as ScoringParameterType } from '@/lib/types';
import { InstallmentPlan, PaymentPlanProduct, Prisma, RepaymentBehavior } from '@prisma/client';


// Helper to convert strings to camelCase
const toCamelCase = (str: string) => {
    if (!str) return '';
    // This regex handles various separators (space, underscore, hyphen) and capitalizes the next letter.
    return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toLowerCase());
};

async function getCustomerDataForScoring(
    customerId: string, 
    providerId: string, 
): Promise<Record<string, any>> {

    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { 
            customerId,
            config: {
                providerId: providerId,
            }
        },
        orderBy: { createdAt: 'desc' },
    });


    const combinedData: Record<string, any> = { id: customerId };
    
    for (const entry of provisionedDataEntries) {
        try {
            const data = JSON.parse(entry.data as string);
            const standardizedData: Record<string, any> = {};
            for (const key in data) {
                standardizedData[toCamelCase(key)] = data[key];
            }

            for (const key in standardizedData) {
                if (!Object.prototype.hasOwnProperty.call(combinedData, key)) {
                    combinedData[key] = standardizedData[key];
                }
            }
        } catch (e) {
            console.error(`Failed to parse data for entry ${entry.id}:`, e);
        }
    }
    
    const previousInstallments = await prisma.installmentPlan.findMany({
        where: { customerId },
        select: { repaymentBehavior: true },
    });

    combinedData['totalLoansCount'] = previousInstallments.length;
    combinedData['loansOnTime'] = previousInstallments.filter(l => l.repaymentBehavior === 'ON_TIME').length;
    combinedData['loansLate'] = previousInstallments.filter(l => l.repaymentBehavior === 'LATE').length;
    combinedData['loansEarly'] = previousInstallments.filter(l => l.repaymentBehavior === 'EARLY').length;
    
    return combinedData;
}


async function calculateScoreForProvider(
    customerId: string,
    providerId: string,
): Promise<number> {
    
    const customerDataForScoring = await getCustomerDataForScoring(customerId, providerId);
    
    const parameters: ScoringParameterType[] = await prisma.scoringParameter.findMany({
        where: { providerId },
        include: {
            rules: true,
        },
    });
    
    if (parameters.length === 0) {
        return 0;
    }
    
    let totalScore = 0;

    parameters.forEach(param => {
        let maxScoreForParam = 0;
        const relevantRules = param.rules || [];
        
        relevantRules.forEach(rule => {
            const fieldNameInCamelCase = toCamelCase(rule.field);
            const inputValue = customerDataForScoring[fieldNameInCamelCase];
            
            if (evaluateCondition(inputValue, rule.condition, rule.value)) {
                if (rule.score > maxScoreForParam) {
                    maxScoreForParam = rule.score;
                }
            }
        });
        
        const scoreForThisParam = Math.min(maxScoreForParam, param.weight);
        totalScore += scoreForThisParam;
    });

    return Math.round(totalScore);
}


export async function checkLoanEligibility(customerId: string, providerId: string, productId: string): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const customer = await prisma.customer.findUnique({
        where: { id: customerId }
    });

    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }

    if (customer.status === 'NPL') {
        return { isEligible: false, reason: 'Your account is currently restricted due to a non-performing loan. Please contact support.', score: 0, maxLoanAmount: 0 };
    }
    
    const product = await prisma.paymentPlanProduct.findUnique({ 
        where: { id: productId },
    });

    if (!product) {
        return { isEligible: false, reason: 'Loan product not found.', score: 0, maxLoanAmount: 0 };
    }
    
    type InstallmentPlanWithProduct = InstallmentPlan & { product: PaymentPlanProduct };
    
    const allActiveInstallments: InstallmentPlanWithProduct[] = await prisma.installmentPlan.findMany({
        where: {
            customerId: customerId,
            repaymentStatus: 'Unpaid'
        },
        include: { product: true }
    });

    const hasActiveLoanOfSameType = allActiveInstallments.some((plan: InstallmentPlanWithProduct) => plan.paymentPlanProductId === productId);
    if (hasActiveLoanOfSameType) {
        return { isEligible: false, reason: `You already have an active installment plan for the "${product.name}" product.`, score: 0, maxLoanAmount: 0 };
    }
    
    if (!product.allowConcurrentLoans && allActiveInstallments.length > 0) {
        const otherProductNames = allActiveInstallments.map(l => `"${l.product.name}"`).join(', ');
        return { isEligible: false, reason: `This is an exclusive loan product. You must repay your active installments (${otherProductNames}) before applying.`, score: 0, maxLoanAmount: 0 };
    }
    
    const customerDataForScoring = await getCustomerDataForScoring(customerId, providerId);
    
    if (product.dataProvisioningEnabled && product.eligibilityFilter) {
        const filter = JSON.parse(product.eligibilityFilter as string);
        const filterKeys = Object.keys(filter);

        const isMatch = filterKeys.every(key => {
            const filterValue = String(filter[key]).toLowerCase();
            const customerValue = String(customerDataForScoring[toCamelCase(key)] || '').toLowerCase();
            return filterValue.split(',').map(s => s.trim()).includes(customerValue);
        });

        if (!isMatch) {
            return { isEligible: false, reason: 'This loan product is not available for your profile.', score: 0, maxLoanAmount: 0 };
        }
    }


    const scoringParameterCount = await prisma.scoringParameter.count({ where: { providerId } });
    if (scoringParameterCount === 0) {
        return { isEligible: false, reason: 'This provider has not configured their credit scoring rules.', score: 0, maxLoanAmount: 0 };
    }
    
    const score = await calculateScoreForProvider(customerId, providerId);

    const applicableTier = await prisma.loanAmountTier.findFirst({
        where: {
            productId: productId,
            fromScore: { lte: score },
            toScore: { gte: score },
        }
    });
        
    const productMaxLoan = applicableTier?.loanAmount || 0;

    if (productMaxLoan <= 0) {
        return { isEligible: false, reason: 'Your credit score does not meet the minimum requirement for a loan with this provider.', score, maxLoanAmount: 0 };
    }
    
    const totalOutstandingPrincipal = allActiveInstallments.reduce((sum, plan) => sum + plan.loanAmount - (plan.repaidAmount || 0), 0);
    
    const maxLoanAmount = productMaxLoan;
    
    const availableToBorrow = Math.max(0, maxLoanAmount - totalOutstandingPrincipal);
    
    if (availableToBorrow <= 0 && allActiveInstallments.length > 0) {
         return { isEligible: true, reason: `You have reached your credit limit with this provider. Your current outstanding balance is ${totalOutstandingPrincipal}. Please repay your active installments to be eligible for more.`, score, maxLoanAmount: 0 };
    }
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for a loan.', score, maxLoanAmount: availableToBorrow };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}
