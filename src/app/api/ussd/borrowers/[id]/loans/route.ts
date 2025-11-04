
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import type { LoanDetails, LoanProduct } from '@/lib/types';


export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const customerId = params.id;

  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID is required.' }, { status: 400 });
  }

  try {
    const [installments, taxConfig] = await Promise.all([
        prisma.installmentPlan.findMany({
            where: { customerId: customerId },
            include: {
                product: true,
            },
            orderBy: {
                disbursedDate: 'desc',
            },
        }),
        prisma.tax.findFirst()
    ]);

    const formattedLoans = installments.map(installment => {
      // The installment.product from prisma might have fee/penalty rules as JSON strings.
      // The calculator expects them to be parsed objects.
      const parsedProduct: LoanProduct = {
          ...installment.product,
          serviceFee: typeof installment.product.serviceFee === 'string' ? JSON.parse(installment.product.serviceFee) : installment.product.serviceFee,
          dailyFee: typeof installment.product.dailyFee === 'string' ? JSON.parse(installment.product.dailyFee) : installment.product.dailyFee,
          penaltyRules: typeof installment.product.penaltyRules === 'string' ? JSON.parse(installment.product.penaltyRules) : installment.product.penaltyRules,
      } as LoanProduct;

      // Use the centralized calculator with the fully parsed product data
      const { total } = calculateTotalRepayable(installment as any, parsedProduct, taxConfig, new Date());
      const totalRepayable = total;

      return {
        id: installment.id,
        providerId: installment.product.providerId,
        productId: installment.paymentPlanProductId,
        productName: installment.product.name,
        loanAmount: installment.loanAmount,
        totalRepayableAmount: totalRepayable, // Add the calculated total
        repaidAmount: installment.repaidAmount || 0,
        penaltyAmount: installment.penaltyAmount,
        dueDate: installment.dueDate,
        repaymentStatus: installment.repaymentStatus,
      }
    });

    return NextResponse.json(formattedLoans);

  } catch (error) {
    console.error('Failed to fetch loans for customer:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
