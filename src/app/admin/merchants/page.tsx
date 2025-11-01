'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddMerchantDialog } from '@/components/merchant/add-merchant-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// Updated type to include more fields
interface Merchant {
    id: string;
    name: string;
    businessType: string;
    contactInfo: string;
    bankAccount: string;
    status: 'Active' | 'Pending' | 'Inactive';
}

export default function MerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
    const [deletingMerchantId, setDeletingMerchantId] = useState<string | null>(null);

    const fetchMerchants = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/merchants');
            if (!response.ok) {
                throw new Error('Failed to fetch merchants');
            }
            const data = await response.json();
            setMerchants(data);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMerchants();
    }, [toast]);

    const handleOpenDialog = (merchant: Merchant | null = null) => {
        setEditingMerchant(merchant);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setEditingMerchant(null);
        setIsDialogOpen(false);
    };

    const handleSaveMerchant = async (merchantData: Partial<Merchant>) => {
        const isEditing = !!editingMerchant;
        const method = isEditing ? 'PUT' : 'POST';
        const endpoint = '/api/merchants';
        const body = JSON.stringify(isEditing ? { ...merchantData, id: editingMerchant.id } : merchantData);

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save merchant.');
            }
            
            toast({
                title: `Merchant ${isEditing ? 'Updated' : 'Added'}`,
                description: `${merchantData.name} has been successfully saved.`,
            });
            await fetchMerchants(); // Refetch data
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

     const handleDeleteMerchant = async () => {
        if (!deletingMerchantId) return;

        try {
            const response = await fetch(`/api/merchants?id=${deletingMerchantId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete merchant.');
            }
            
            toast({
                title: 'Merchant Deleted',
                description: 'The merchant has been successfully deleted.',
            });
            await fetchMerchants(); // Refetch data
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setDeletingMerchantId(null);
        }
    };

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Merchants</h2>
                        <p className="text-muted-foreground">
                            Manage your partner merchants.
                        </p>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Merchant
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Merchant List</CardTitle>
                        <CardDescription>A list of all onboarded merchants in the system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Business Type</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                        </TableCell>
                                    </TableRow>
                                ) : merchants.length > 0 ? (
                                    merchants.map((merchant) => (
                                        <TableRow key={merchant.id}>
                                            <TableCell className="font-medium">{merchant.name}</TableCell>
                                            <TableCell>{merchant.businessType}</TableCell>
                                            <TableCell>{merchant.contactInfo}</TableCell>
                                            <TableCell>
                                                <Badge variant={merchant.status === 'Active' ? 'secondary' : 'destructive'} style={merchant.status === 'Active' ? { backgroundColor: '#16a34a', color: 'white' } : {}}>
                                                    {merchant.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleOpenDialog(merchant)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-500" onClick={() => setDeletingMerchantId(merchant.id)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No merchants found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
             <AddMerchantDialog
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSaveMerchant}
                merchant={editingMerchant}
            />
            <AlertDialog open={!!deletingMerchantId} onOpenChange={() => setDeletingMerchantId(null)}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the merchant. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMerchant} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
