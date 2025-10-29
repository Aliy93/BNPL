
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Borrower {
    id: string;
    name: string;
}

export default function SelectCustomerPage() {
    const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
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
        if (!selectedBorrowerId.trim()) {
            toast({
                title: "Borrower Required",
                description: "Please select a borrower from the table.",
                variant: "destructive",
            });
            return;
        }
        setIsLoading(true);
        // Redirect to the main loan dashboard with the borrower ID
        router.push(`/loan?borrowerId=${selectedBorrowerId.trim()}`);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Start Your Loan Application</CardTitle>
                    <CardDescription>
                        Please select a borrower from the list to proceed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <ScrollArea className="h-72 w-full rounded-md border">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Borrower Name</TableHead>
                                        <TableHead>Borrower ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                            </TableCell>
                                        </TableRow>
                                    ) : borrowers.length > 0 ? (
                                        borrowers.map((borrower) => (
                                            <TableRow 
                                                key={borrower.id}
                                                onClick={() => setSelectedBorrowerId(borrower.id)}
                                                className={cn("cursor-pointer", selectedBorrowerId === borrower.id && "bg-muted")}
                                            >
                                                <TableCell className="font-medium">{borrower.name}</TableCell>
                                                <TableCell>{borrower.id}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">
                                                No borrowers found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                        <Button type="submit" className="w-full" disabled={isLoading || !selectedBorrowerId}>
                            {isLoading && !borrowers.length ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continue'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
