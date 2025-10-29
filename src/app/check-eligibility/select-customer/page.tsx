
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SelectCustomerPage() {
    const [borrowerId, setBorrowerId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!borrowerId.trim()) {
            toast({
                title: "ID Required",
                description: "Please enter a borrower ID.",
                variant: "destructive",
            });
            return;
        }
        setIsLoading(true);
        // Redirect to the main loan dashboard with the borrower ID
        router.push(`/loan?borrowerId=${borrowerId.trim()}`);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Start Your Loan Application</CardTitle>
                    <CardDescription>
                        Please enter your Borrower ID to proceed. For testing, you can use 'borrower-123'.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="borrowerId">Borrower ID</Label>
                            <Input
                                id="borrowerId"
                                placeholder="e.g., borrower-123"
                                value={borrowerId}
                                onChange={(e) => setBorrowerId(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continue'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
