
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Borrower {
    id: string;
    [key: string]: any; // Allow for dynamic properties from provisioned data
}

export default function SelectCustomerPage() {
    const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | undefined>(undefined);
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [headers, setHeaders] = useState<string[]>([]);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const fetchBorrowers = async () => {
            try {
                const response = await fetch('/api/borrowers');
                if (!response.ok) {
                    throw new Error('Failed to fetch borrowers');
                }
                const data: Borrower[] = await response.json();
                setBorrowers(data);

                // Dynamically create headers from all keys found in the data, excluding 'id'
                if (data.length > 0) {
                    const allKeys = new Set<string>();
                    data.forEach(borrower => {
                        Object.keys(borrower).forEach(key => {
                            if (key !== 'id') {
                                allKeys.add(key);
                            }
                        });
                    });
                     // Prioritize 'fullName' if it exists
                    const sortedKeys = Array.from(allKeys).sort((a, b) => {
                        if (a === 'fullName') return -1;
                        if (b === 'fullName') return 1;
                        if (a.toLowerCase().includes('name')) return -1;
                        if (b.toLowerCase().includes('name')) return 1;
                        return a.localeCompare(b);
                    });
                    setHeaders(sortedKeys);
                }
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
        if (!selectedBorrowerId) {
            toast({
                title: "Borrower Required",
                description: "Please select a borrower from the table.",
                variant: "destructive",
            });
            return;
        }
        setIsLoading(true);
        // Redirect to the main loan dashboard with the borrower ID
        router.push(`/loan?borrowerId=${selectedBorrowerId}`);
    };
    
    // Function to format header titles (e.g., camelCase to Title Case)
    const formatHeader = (header: string) => {
        const result = header.replace(/([A-Z])/g, ' $1');
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Card className="w-full max-w-4xl">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Start Your Loan Application</CardTitle>
                    <CardDescription>
                        Please select a borrower from the list to proceed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <ScrollArea className="h-96 w-full rounded-md border">
                             <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Borrower ID</TableHead>
                                        {headers.map(header => (
                                            <TableHead key={header}>{formatHeader(header)}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <RadioGroup value={selectedBorrowerId} onValueChange={setSelectedBorrowerId} asChild>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={headers.length + 2} className="h-24 text-center">
                                                    <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                                </TableCell>
                                            </TableRow>
                                        ) : borrowers.length > 0 ? (
                                            borrowers.map((borrower) => (
                                                <TableRow key={borrower.id}>
                                                    <TableCell className="text-center">
                                                        <RadioGroupItem value={borrower.id} id={borrower.id} />
                                                    </TableCell>
                                                    <TableCell>{borrower.id}</TableCell>
                                                    {headers.map(header => (
                                                        <TableCell key={`${borrower.id}-${header}`}>
                                                            {borrower[header] !== undefined ? String(borrower[header]) : 'N/A'}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={headers.length + 2} className="h-24 text-center">
                                                    No borrowers found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </RadioGroup>
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
