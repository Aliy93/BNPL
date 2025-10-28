'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LoanProvider, LoanProduct, LoanDetails, Tax } from '@/lib/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { LoanOfferAndCalculator } from '@/components/loan/loan-offer-and-calculator';
import { LoanDetailsView } from '@/components/loan/loan-details-view';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';


type Step = 'calculator' | 'details';

export function ApplyClient({ provider, taxConfig }: { provider: LoanProvider, taxConfig: Tax | null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const productId = searchParams.get('product');
    const borrowerId = searchParams.get('borrowerId');

    const selectedProduct = useMemo(() => {
        if (!provider || !productId) return null;
        return provider.products.find(p => p.id === productId) || null;
    }, [provider, productId]);

    const initialStep: Step = searchParams.get('step') as Step || 'calculator';
    
    const [step, setStep] = useState<Step>(initialStep);
    const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);

    const eligibilityResult = useMemo(() => {
        const min = searchParams.get('min');
        const max = searchParams.get('max');

        return {
            isEligible: true,
            suggestedLoanAmountMin: min ? parseFloat(min) : selectedProduct?.minLoan ?? 0,
            suggestedLoanAmountMax: max ? parseFloat(max) : selectedProduct?.maxLoan ?? 0,
            reason: 'You are eligible for a loan.',
        };
    }, [searchParams, selectedProduct]);

    const handleLoanAccept = async (details: Omit<LoanDetails, 'id' | 'providerName' | 'productName' | 'payments' >) => {
        if (!selectedProduct || !borrowerId) {
            toast({ title: 'Error', description: 'Missing required information.', variant: 'destructive'});
            return;
        }

        try {
            // Personal Loan Flow: Disburse the loan directly
            const finalDetails = {
                borrowerId,
                productId: selectedProduct.id,
                loanAmount: details.loanAmount,
                disbursedDate: details.disbursedDate,
                dueDate: details.dueDate,
            };

            const response = await fetch('/api/loans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalDetails),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save the loan.');
            }
            
            const savedLoan = await response.json();

            const displayLoan: LoanDetails = {
                ...savedLoan,
                providerName: provider.name,
                productName: selectedProduct.name,
                disbursedDate: new Date(savedLoan.disbursedDate),
                dueDate: new Date(savedLoan.dueDate),
                payments: [],
            }
            setLoanDetails(displayLoan);
            setStep('details');
                toast({
                title: 'Success!',
                description: 'Your loan has been successfully disbursed.',
            });

        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleBack = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('product');
        params.delete('step');
        router.push(`/loan?${params.toString()}`);
    };

    const handleReset = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('product');
        params.delete('step');
        router.push(`/loan?${params.toString()}`);
    };

    const renderStep = () => {
        switch (step) {
            case 'calculator':
                if (selectedProduct) {
                    return <LoanOfferAndCalculator product={selectedProduct} taxConfig={taxConfig} isLoading={false} eligibilityResult={eligibilityResult} onAccept={handleLoanAccept} providerColor={provider.colorHex} />;
                }
                if (productId && !selectedProduct) {
                        return <div className="text-center">Product not found. Please <button onClick={() => router.push('/loan')} className="underline" style={{color: 'hsl(var(--primary))'}}>start over</button>.</div>;
                }
                return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;

            case 'details':
                if (loanDetails && selectedProduct) {
                    return <LoanDetailsView details={loanDetails} product={selectedProduct} onReset={handleReset} providerColor={provider.colorHex} />;
                }
                return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
            default:
                return <div className="text-center">Invalid step.</div>;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: provider?.colorHex || 'hsl(var(--primary))' }}>
                <div className="container flex h-16 items-center">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 text-primary-foreground hover:bg-white/20">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <h1 className="text-lg font-semibold tracking-tight text-primary-foreground">Loan Application</h1>
                    </div>
                </div>
            </header>
            <main className="flex-1">
                <div className="container py-8 md:py-12">
                    {renderStep()}
                </div>
            </main>
        </div>
    );
}
