
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, MoreHorizontal, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import type { LoanProvider } from '@/lib/types';

// This will be replaced by a proper Merchant type from types.ts later
interface Merchant {
    id: string;
    name: string;
    businessType: string;
    status: 'Active' | 'Pending' | 'Disabled';
    contact: string;
}


export default function MerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingMerchant, setDeletingMerchant] = useState<Merchant | null>(null);
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const [providers, setProviders] = useState<LoanProvider[]>([]);

    const themeColor = React.useMemo(() => {
        if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
            return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
        }
        return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
    }, [currentUser, providers]);

    const fetchMerchants = async () => {
        setIsLoading(true);
        try {
            // This API doesn't exist yet, so we'll use placeholder data for now.
            // const response = await fetch('/api/merchants');
            // if (!response.ok) throw new Error('Failed to fetch merchants');
            // const data = await response.json();
            // setMerchants(data);
             setMerchants([
                { id: 'merch-001', name: 'SuperMart', businessType: 'Retail', status: 'Active', contact: 'contact@supermart.com' },
                { id: 'merch-002', name: 'GadgetZone', businessType: 'Electronics', status: 'Active', contact: 'sales@gadgetzone.com' },
                { id: 'merch-003', name: 'FashionFiesta', businessType: 'Apparel', status: 'Pending', contact: 'info@fashionfiesta.com' },
            ]);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const fetchProviders = async () => {
        try {
            const providersResponse = await fetch('/api/providers');
             if (!providersResponse.ok) throw new Error('Failed to fetch providers');
            const providersData = await providersResponse.json();
            setProviders(providersData);
        } catch (error) {
             toast({
                title: 'Error',
                description: 'Could not load provider data.',
                variant: 'destructive',
            });
        }
    };

    useEffect(() => {
        fetchMerchants();
        fetchProviders();
    }, []);

    const handleAddOrEditMerchant = () => {
        // This will open a dialog in the future
        toast({ title: 'Feature Coming Soon', description: 'Adding and editing merchants will be implemented next.' });
    };

    const handleDelete = async () => {
        if (!deletingMerchant) return;
        // API call to delete would go here
        toast({ title: `Simulated Delete`, description: `${deletingMerchant.name} would be deleted.` });
        setMerchants(merchants.filter(m => m.id !== deletingMerchant.id));
        setDeletingMerchant(null);
    }
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Merchant Management</h2>
                        <p className="text-muted-foreground">Onboard, view, and manage your partner merchants.</p>
                    </div>
                    <Button onClick={handleAddOrEditMerchant} style={{ backgroundColor: themeColor }} className="text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Merchant
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Partner Merchants</CardTitle>
                        <CardDescription>The following merchants are registered on the platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Merchant Name</TableHead>
                                    <TableHead>Business Type</TableHead>
                                    <TableHead>Contact Info</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {merchants.map((merchant) => (
                                    <TableRow key={merchant.id}>
                                        <TableCell className="font-medium flex items-center gap-2"><Store className="h-4 w-4 text-muted-foreground"/>{merchant.name}</TableCell>
                                        <TableCell>{merchant.businessType}</TableCell>
                                        <TableCell>{merchant.contact}</TableCell>
                                        <TableCell>
                                            <Badge variant={merchant.status === 'Active' ? 'secondary' : 'outline'} style={merchant.status === 'Active' ? { backgroundColor: '#16a34a', color: 'white' } : {}}>
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
                                                    <DropdownMenuItem onClick={handleAddOrEditMerchant}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem>View Details</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => setDeletingMerchant(merchant)}>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={!!deletingMerchant} onOpenChange={() => setDeletingMerchant(null)}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the merchant and all their associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
