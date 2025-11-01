'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Placeholder type
interface Merchant {
    id: string;
    name: string;
    businessType: string;
    status: 'Active' | 'Pending' | 'Inactive';
}

export default function MerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
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
        fetchMerchants();
    }, [toast]);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Merchants</h2>
                    <p className="text-muted-foreground">
                        Manage your partner merchants.
                    </p>
                </div>
                <Button>
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
                                <TableHead>Status</TableHead>
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
                            ) : merchants.length > 0 ? (
                                merchants.map((merchant) => (
                                    <TableRow key={merchant.id}>
                                        <TableCell className="font-medium">{merchant.name}</TableCell>
                                        <TableCell>{merchant.businessType}</TableCell>
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
                                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem>View Details</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No merchants found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
