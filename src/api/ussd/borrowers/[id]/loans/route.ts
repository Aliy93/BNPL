
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateTotalRepayable } from '@/lib/loan-calculator';
import type { LoanDetails, PaymentPlanProduct } from '@/lib/types';


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
                paymentPlanProduct: true,
            },
            orderBy: {
                disbursedDate: 'desc',
            },
        }),
        prisma.tax.findFirst()
    ]);

    const formattedLoans = installments.map(installment => {
      // The installment.paymentPlanProduct from prisma might have fee/penalty rules as JSON strings.
      // The calculator expects them to be parsed objects.
      const parsedProduct: PaymentPlanProduct = {
          ...installment.paymentPlanProduct,
          serviceFee: typeof installment.paymentPlanProduct.serviceFee === 'string' ? JSON.parse(installment.paymentPlanProduct.serviceFee) : installment.paymentPlanProduct.serviceFee,
          dailyFee: typeof installment.paymentPlanProduct.dailyFee === 'string' ? JSON.parse(installment.paymentPlanProduct.dailyFee) : installment.paymentPlanProduct.dailyFee,
          penaltyRules: typeof installment.paymentPlanProduct.penaltyRules === 'string' ? JSON.parse(installment.paymentPlanProduct.penaltyRules) : installment.paymentPlanProduct.penaltyRules,
      } as PaymentPlanProduct;

      // Use the centralized calculator with the fully parsed product data
      const { total } = calculateTotalRepayable(installment as any, parsedProduct, taxConfig, new Date());
      const totalRepayable = total;

      return {
        id: installment.id,
        providerId: installment.paymentPlanProduct.providerId,
        productId: installment.paymentPlanProductId,
        productName: installment.paymentPlanProduct.name,
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
