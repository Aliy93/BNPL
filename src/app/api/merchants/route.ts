import { NextResponse } from 'next/server';

// Placeholder for fetching merchants
export async function GET() {
  try {
    // In the future, this will fetch data from Prisma
    const merchants = [
        { id: 'mer-1', name: 'K-Sue Supermarket', businessType: 'Retail', status: 'Active' },
        { id: 'mer-2', name: 'Bole Electronics', businessType: 'Electronics', status: 'Pending' },
    ];
    return NextResponse.json(merchants);
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
