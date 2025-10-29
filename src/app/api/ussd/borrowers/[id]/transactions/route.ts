
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const borrowerId = params.id;

  if (!borrowerId) {
    return NextResponse.json({ error: 'Customer ID is required.' }, { status: 400 });
  }

  try {
    const installmentPlans = await prisma.loan.findMany({
      where: { borrowerId: borrowerId },
      include: {
        product: true,
        payments: {
          orderBy: {
            date: 'asc'
          }
        },
      },
      orderBy: {
        disbursedDate: 'asc',
      },
    });

    const transactions = [];

    for (const plan of installmentPlans) {
      // Order Financing
      transactions.push({
        date: format(new Date(plan.disbursedDate), 'yyyy-MM-dd'),
        description: `Financed purchase with ${plan.product.name}`,
        amount: plan.loanAmount,
      });

      // Repayments for that plan
      for (const payment of plan.payments) {
        transactions.push({
          date: format(new Date(payment.date), 'yyyy-MM-dd'),
          description: 'Repayment',
          amount: -payment.amount, // Repayments are negative
        });
      }
    }
    
    // Sort all transactions by date
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    return NextResponse.json(transactions);

  } catch (error) {
    console.error('Failed to fetch transactions for customer:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
