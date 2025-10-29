
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { Loader2, ArrowLeft } from 'lucide-react';
import type { LoanProduct, LoanDetails, CheckLoanEligibilityOutput, Tax } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { addDays, endOfDay } from 'date-fns';

function ApplyPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const borrowerId = searchParams.get('borrowerId');
    const providerId = searchParams.get('providerId');
    const productId = searchParams.get('product');
    const maxAmount = searchParams.get('max');

    const [product, setProduct] = useState<LoanProduct | null>(null);
    const [providerColor, setProviderColor] = useState<string>('#fdb913');
    const [taxConfig, setTaxConfig] = useState<Tax | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [eligibilityResult, setEligibilityResult] = useState<CheckLoanEligibilityOutput | null>(null);
    const [loanDisbursed, setLoanDisbursed] = useState<LoanDetails | null>(null);

    const fetchProductDetails = useCallback(async () => {
        if (!providerId || !productId) return;
        setIsLoading(true);
        try {
            const [providersRes, taxRes] = await Promise.all([
                fetch('/api/providers'),
                fetch('/api/tax')
            ]);
            
            if (!providersRes.ok) throw new Error('Failed to fetch providers.');
            if (!taxRes.ok) throw new Error('Failed to fetch tax configuration.');

            const providers = await providersRes.json();
            const taxData = await taxRes.json();
            setTaxConfig(taxData);

            const currentProvider = providers.find((p: any) => p.id === providerId);
            if (currentProvider) {
                setProviderColor(currentProvider.colorHex || '#fdb913');
                const currentProduct = currentProvider.products.find((p: any) => p.id === productId);
                if (currentProduct) {
                    setProduct(currentProduct);
                     const eligibility: CheckLoanEligibilityOutput = {
                        isEligible: true,
                        suggestedLoanAmountMax: Number(maxAmount),
                        reason: 'You are eligible to apply.',
                    };
                    setEligibilityResult(eligibility);
                } else {
                    throw new Error('Product not found.');
                }
            } else {
                 throw new Error('Provider not found.');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [providerId, productId, maxAmount, toast]);

    useEffect(() => {
        fetchProductDetails();
    }, [fetchProductDetails]);

    const handleAcceptLoan = async (details: Omit<LoanDetails, 'id' | 'providerName' | 'productName' | 'payments'>) => {
        if (!borrowerId || !productId) return;
        
        setIsLoading(true);
        try {
            const disbursedDate = new Date();
            const duration = product?.duration ?? 30;
            const dueDate = duration === 0 ? endOfDay(disbursedDate) : addDays(disbursedDate, duration);
            
            const payload = {
                borrowerId,
                productId,
                loanAmount: details.loanAmount,
                disbursedDate: disbursedDate.toISOString(),
                dueDate: dueDate.toISOString(),
            };
            
            const response = await fetch('/api/loans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to disburse loan.');
            }

            const newLoan = await response.json();

            setLoanDisbursed({
                ...newLoan,
                providerName: 'N/A', // These are not available on the returned loan object
                productName: product?.name || 'N/A',
                product: product!,
                payments: [],
            });
            
            toast({
                title: 'Success!',
                description: 'Your loan has been disbursed.',
            });

        } catch (error: any) {
             toast({
                title: 'Loan Disbursement Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
         const params = new URLSearchParams();
         if (borrowerId) params.set('borrowerId', borrowerId);
         if (providerId) params.set('providerId', providerId);
         router.push(`/loan?${params.toString()}`);
    }

    if (isLoading) {
        return (
             <div className="flex flex-col min-h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading loan details...</p>
            </div>
        );
    }
    
    if (loanDisbursed && product) {
        return <LoanDetailsView details={loanDisbursed} product={product} onReset={handleReset} providerColor={providerColor} />;
    }

    return (
        <div className="container py-8">
             <Button variant="ghost" onClick={handleReset} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
            </Button>
            {product && (
                 <LoanOfferAndCalculator
                    product={product}
                    taxConfig={taxConfig}
                    isLoading={isLoading}
                    eligibilityResult={eligibilityResult}
                    onAccept={handleAcceptLoan}
                    providerColor={providerColor}
                />
            )}
        </div>
    );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col min-h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    }>
      <ApplyPageContent />
    </Suspense>
  );
}
