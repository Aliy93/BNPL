
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { updateNplStatus } from '@/actions/npl';

interface NplBorrower {
    id: string;
    status: string;
    loans: {
        loanAmount: number;
        dueDate: string;
        repaymentStatus: string;
    }[];
}

async function getNplBorrowers(): Promise<NplBorrower[]> {
    const response = await fetch('/api/npl-borrowers');
    if (!response.ok) {
        throw new Error('Failed to fetch NPL borrowers');
    }
    return response.json();
}

export default function NplManagementPage() {
    const [borrowers, setBorrowers] = useState<NplBorrower[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const [selectedBorrower, setSelectedBorrower] = useState<NplBorrower | null>(null);
    const { toast } = useToast();

    const fetchBorrowers = async () => {
        setIsLoading(true);
        try {
            const data = await getNplBorrowers();
            setBorrowers(data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Could not load NPL borrowers.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBorrowers();
    }, []);

    const handleRunNplUpdate = async () => {
        setIsUpdating(true);
        try {
            const result = await updateNplStatus();
            if (result.success) {
                toast({
                    title: 'NPL Status Updated',
                    description: `${result.updatedCount} borrower(s) have been updated.`,
                });
                await fetchBorrowers(); // Refresh the list
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                title: 'Error Running NPL Update',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleRevertStatus = async () => {
        if (!selectedBorrower) return;
        setIsReverting(true);
        try {
             const response = await fetch('/api/borrowers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId: selectedBorrower.id, status: 'Active' }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to revert status.');
            }
            toast({
                title: 'Status Reverted',
                description: `Borrower ${selectedBorrower.id.slice(0, 8)} has been set to Active.`,
            });
            await fetchBorrowers();
        } catch (error: any) {
             toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsReverting(false);
            setSelectedBorrower(null);
        }
    };


    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">NPL</h2>
                        <p className="text-muted-foreground">
                            View and manage borrowers with Non-Performing Loans.
                        </p>
                    </div>
                     <Button onClick={handleRunNplUpdate} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Run NPL Status Update
                    </Button>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>NPL Borrowers</CardTitle>
                        <CardDescription>This list contains all borrowers who have been flagged due to overdue loans based on their provider's NPL threshold.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Borrower ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Overdue Loan Count</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                        </TableCell>
                                    </TableRow>
                                ) : borrowers.length > 0 ? (
                                    borrowers.map((borrower) => (
                                        <TableRow key={borrower.id}>
                                            <TableCell className="font-mono">{borrower.id}</TableCell>
                                            <TableCell>
                                                <Badge variant="destructive">{borrower.status}</Badge>
                                            </TableCell>
                                            <TableCell>{borrower.loans.length}</TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => setSelectedBorrower(borrower)}>
                                                    <UserCheck className="mr-2 h-4 w-4" />
                                                    Revert to Active
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No NPL borrowers found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <AlertDialog open={!!selectedBorrower} onOpenChange={(isOpen) => !isOpen && setSelectedBorrower(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revert Borrower Status?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will manually change the status of borrower <span className="font-mono">{selectedBorrower?.id}</span> from NPL back to Active. This should only be done if the loan has been settled or if an error was made.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevertStatus} disabled={isReverting}>
                             {isReverting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Revert
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
