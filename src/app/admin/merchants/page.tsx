
'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, MoreHorizontal, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Placeholder data - this will be replaced with API data
const sampleMerchants = [
    { id: 'merch-001', name: 'SuperMart', businessType: 'Retail', status: 'Active', contact: 'contact@supermart.com' },
    { id: 'merch-002', name: 'GadgetZone', businessType: 'Electronics', status: 'Active', contact: 'sales@gadgetzone.com' },
    { id: 'merch-003', name: 'FashionFiesta', businessType: 'Apparel', status: 'Pending', contact: 'info@fashionfiesta.com' },
];


export default function MerchantsPage() {
    const [merchants, setMerchants] = useState(sampleMerchants);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // The useEffect to fetch data will be added once the API is ready
    // useEffect(() => {
    //     const fetchMerchants = async () => {
    //         setIsLoading(true);
    //         // ... fetch logic here ...
    //         setIsLoading(false);
    //     };
    //     fetchMerchants();
    // }, []);

    const handleAddMerchant = () => {
        // This will open a dialog in the future
        toast({ title: 'Feature Coming Soon', description: 'Adding and editing merchants will be implemented next.' });
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Merchant Management</h2>
                    <p className="text-muted-foreground">Onboard, view, and manage your partner merchants.</p>
                </div>
                <Button onClick={handleAddMerchant}>
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
                                                <DropdownMenuItem onClick={handleAddMerchant}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600">Disable</DropdownMenuItem>
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
    );
}
