
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

interface NplCustomer {
    id: string;
    status: string;
    loans: {
        loanAmount: number;
        dueDate: string;
        repaymentStatus: string;
    }[];
}

async function getNplCustomers(): Promise<NplCustomer[]> {
    const response = await fetch('/api/npl-borrowers');
    if (!response.ok) {
        throw new Error('Failed to fetch NPL customers');
    }
    return response.json();
}

export default function NplManagementPage() {
    const [customers, setCustomers] = useState<NplCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<NplCustomer | null>(null);
    const { toast } = useToast();

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const data = await getNplCustomers();
            setCustomers(data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Could not load NPL customers.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleRunNplUpdate = async () => {
        setIsUpdating(true);
        try {
            const result = await updateNplStatus();
            if (result.success) {
                toast({
                    title: 'NPL Status Updated',
                    description: `${result.updatedCount} customer(s) have been updated.`,
                });
                await fetchCustomers(); // Refresh the list
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
        if (!selectedCustomer) return;
        setIsReverting(true);
        try {
             const response = await fetch('/api/borrowers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId: selectedCustomer.id, status: 'Active' }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to revert status.');
            }
            toast({
                title: 'Status Reverted',
                description: `Customer ${selectedCustomer.id.slice(0, 8)} has been set to Active.`,
            });
            await fetchCustomers();
        } catch (error: any) {
             toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsReverting(false);
            setSelectedCustomer(null);
        }
    };


    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">NPL Management</h2>
                        <p className="text-muted-foreground">
                            View and manage customers with Non-Performing Loans.
                        </p>
                    </div>
                     <Button onClick={handleRunNplUpdate} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Run NPL Status Update
                    </Button>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>NPL Customers</CardTitle>
                        <CardDescription>This list contains all customers who have been flagged due to overdue installment plans based on their provider's NPL threshold.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Overdue Plan Count</TableHead>
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
                                ) : customers.length > 0 ? (
                                    customers.map((customer) => (
                                        <TableRow key={customer.id}>
                                            <TableCell className="font-mono">{customer.id}</TableCell>
                                            <TableCell>
                                                <Badge variant="destructive">{customer.status}</Badge>
                                            </TableCell>
                                            <TableCell>{customer.loans.length}</TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => setSelectedCustomer(customer)}>
                                                    <UserCheck className="mr-2 h-4 w-4" />
                                                    Revert to Active
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No NPL customers found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <AlertDialog open={!!selectedCustomer} onOpenChange={(isOpen) => !isOpen && setSelectedCustomer(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revert Customer Status?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will manually change the status of customer <span className="font-mono">{selectedCustomer?.id}</span> from NPL back to Active. This should only be done if their account has been settled or if an error was made.
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
