
'use server';
/**
 * @fileOverview Implements a financing eligibility check and credit scoring for BNPL.
 *
 * - checkLoanEligibility - First checks for basic eligibility, then calculates a credit score to determine the maximum spending limit.
 * - recalculateScoreAndLoanLimit - Calculates a credit score for a given provider and returns the max spending limit.
 */

import prisma from '@/lib/prisma';
import { evaluateCondition } from '@/lib/utils';
import type { ScoringParameter as ScoringParameterType } from '@/lib/types';
import { Loan, LoanProduct, Prisma, RepaymentBehavior } from '@prisma/client';


// Helper to convert strings to camelCase
const toCamelCase = (str: string) => {
    if (!str) return '';
    // This regex handles various separators (space, underscore, hyphen) and capitalizes the next letter.
    return str.replace(/[^a-zA-Z0-9]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '').replace(/^./, (match) => match.toLowerCase());
};

async function getCustomerDataForScoring(
    borrowerId: string, 
    providerId: string, 
): Promise<Record<string, any>> {

    const provisionedDataEntries = await prisma.provisionedData.findMany({
        where: { 
            borrowerId,
            config: {
                providerId: providerId,
            }
        },
        orderBy: { createdAt: 'desc' },
    });


    const combinedData: Record<string, any> = { id: borrowerId };
    
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
    
    const previousInstallmentPlans = await prisma.loan.findMany({
        where: { borrowerId },
        select: { repaymentBehavior: true },
    });

    combinedData['totalLoansCount'] = previousInstallmentPlans.length;
    combinedData['loansOnTime'] = previousInstallmentPlans.filter(l => l.repaymentBehavior === 'ON_TIME').length;
    combinedData['loansLate'] = previousInstallmentPlans.filter(l => l.repaymentBehavior === 'LATE').length;
    combinedData['loansEarly'] = previousInstallmentPlans.filter(l => l.repaymentBehavior === 'EARLY').length;
    
    return combinedData;
}


async function calculateScoreForProvider(
    borrowerId: string,
    providerId: string,
): Promise<number> {
    
    const borrowerDataForScoring = await getCustomerDataForScoring(borrowerId, providerId);
    
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
            const inputValue = borrowerDataForScoring[fieldNameInCamelCase];
            
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


export async function checkLoanEligibility(borrowerId: string, providerId: string, productId: string): Promise<{isEligible: boolean; reason: string; score: number, maxLoanAmount: number}> {
  try {
    const customer = await prisma.borrower.findUnique({
        where: { id: borrowerId }
    });

    if (!customer) {
      return { isEligible: false, reason: 'Customer profile not found.', score: 0, maxLoanAmount: 0 };
    }

    if (customer.status === 'NPL') {
        return { isEligible: false, reason: 'Your account is currently restricted due to a non-performing plan. Please contact support.', score: 0, maxLoanAmount: 0 };
    }
    
    const product = await prisma.loanProduct.findUnique({ 
        where: { id: productId },
    });

    if (!product) {
        return { isEligible: false, reason: 'Payment plan product not found.', score: 0, maxLoanAmount: 0 };
    }
    
    type LoanWithProduct = Loan & { product: LoanProduct };
    
    const allActiveInstallmentPlans: LoanWithProduct[] = await prisma.loan.findMany({
        where: {
            borrowerId: borrowerId,
            repaymentStatus: 'Unpaid'
        },
        include: { product: true }
    });

    const hasActivePlanOfSameType = allActiveInstallmentPlans.some((plan: LoanWithProduct) => plan.productId === productId);
    if (hasActivePlanOfSameType) {
        return { isEligible: false, reason: `You already have an active installment plan for the "${product.name}" product.`, score: 0, maxLoanAmount: 0 };
    }
    
    if (!product.allowConcurrentLoans && allActiveInstallmentPlans.length > 0) {
        const otherProductNames = allActiveInstallmentPlans.map(l => `"${l.product.name}"`).join(', ');
        return { isEligible: false, reason: `This is an exclusive plan. You must complete your active plans (${otherProductNames}) before starting a new one.`, score: 0, maxLoanAmount: 0 };
    }
    
    const borrowerDataForScoring = await getCustomerDataForScoring(borrowerId, providerId);
    
    if (product.dataProvisioningEnabled && product.eligibilityFilter) {
        const filter = JSON.parse(product.eligibilityFilter as string);
        const filterKeys = Object.keys(filter);

        const isMatch = filterKeys.every(key => {
            const filterValue = String(filter[key]).toLowerCase();
            const borrowerValue = String(borrowerDataForScoring[toCamelCase(key)] || '').toLowerCase();
            return filterValue.split(',').map(s => s.trim()).includes(borrowerValue);
        });

        if (!isMatch) {
            return { isEligible: false, reason: 'This payment plan is not available for your profile.', score: 0, maxLoanAmount: 0 };
        }
    }


    const scoringParameterCount = await prisma.scoringParameter.count({ where: { providerId } });
    if (scoringParameterCount === 0) {
        return { isEligible: false, reason: 'This provider has not configured their credit scoring rules.', score: 0, maxLoanAmount: 0 };
    }
    
    const score = await calculateScoreForProvider(borrowerId, providerId);

    const applicableTier = await prisma.loanAmountTier.findFirst({
        where: {
            productId: productId,
            fromScore: { lte: score },
            toScore: { gte: score },
        }
    });
        
    const productMaxSpendingLimit = applicableTier?.loanAmount || 0;

    if (productMaxSpendingLimit <= 0) {
        return { isEligible: false, reason: 'Your credit score does not meet the minimum requirement for a plan with this provider.', score, maxLoanAmount: 0 };
    }
    
    const totalOutstandingPrincipal = allActiveInstallmentPlans.reduce((sum, loan) => sum + loan.loanAmount - (loan.repaidAmount || 0), 0);
    
    const maxSpendingLimit = productMaxSpendingLimit;
    
    const availableToSpend = Math.max(0, maxSpendingLimit - totalOutstandingPrincipal);
    
    if (availableToSpend <= 0 && allActiveInstallmentPlans.length > 0) {
         return { isEligible: true, reason: `You have reached your spending limit with this provider. Your current outstanding balance is ${totalOutstandingPrincipal}. Please repay your active plans to be eligible for more.`, score, maxLoanAmount: 0 };
    }
        
    return { isEligible: true, reason: 'Congratulations! You are eligible for financing.', score, maxLoanAmount: availableToSpend };

  } catch (error) {
    console.error('Error in checkLoanEligibility:', error);
    return { isEligible: false, reason: 'An unexpected server error occurred.', score: 0, maxLoanAmount: 0 };
  }
}
