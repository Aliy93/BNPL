
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Borrower {
    id: string;
    name: string;
}

export default function SelectCustomerPage() {
    const [borrowerId, setBorrowerId] = useState('');
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const fetchBorrowers = async () => {
            try {
                const response = await fetch('/api/borrowers');
                if (!response.ok) {
                    throw new Error('Failed to fetch borrowers');
                }
                const data = await response.json();
                setBorrowers(data);
            } catch (error) {
                toast({
                    title: "Error",
                    description: "Could not load borrower list.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchBorrowers();
    }, [toast]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!borrowerId.trim()) {
            toast({
                title: "Borrower Required",
                description: "Please select a borrower.",
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
                        Please select a borrower to proceed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="borrowerId">Borrower</Label>
                             {isLoading ? (
                                <div className="flex items-center justify-center h-10 border rounded-md">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </div>
                            ) : (
                                <Select onValueChange={setBorrowerId} value={borrowerId}>
                                    <SelectTrigger id="borrowerId">
                                        <SelectValue placeholder="Select a borrower" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {borrowers.map(borrower => (
                                            <SelectItem key={borrower.id} value={borrower.id}>
                                                {borrower.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading || !borrowerId}>
                            {isLoading && !borrowers.length ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continue'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
