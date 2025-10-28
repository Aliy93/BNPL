'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import type { Tax as TaxConfig } from '@prisma/client';

const TAX_COMPONENTS = [
    { id: 'serviceFee', label: 'Service Fee' },
    { id: 'interest', label: 'Daily Fee (Interest)' },
    { id: 'penalty', label: 'Penalty' },
];

export default function TaxSettingsPage() {
    const [name, setName] = useState<string>('');
    const [rate, setRate] = useState<number | string>('');
    const [appliedTo, setAppliedTo] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchTaxConfig = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/tax');
                if (response.ok) {
                    const config: TaxConfig = await response.json();
                    setName(config.name || '');
                    setRate(config.rate);
                    setAppliedTo(JSON.parse(config.appliedTo));
                }
            } catch (error) {
                toast({
                    title: 'Error',
                    description: 'Could not load tax configuration.',
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTaxConfig();
    }, [toast]);

    const handleComponentChange = (componentId: string, checked: boolean) => {
        setAppliedTo(prev => 
            checked ? [...prev, componentId] : prev.filter(c => c !== componentId)
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const numericRate = Number(rate);
            if (isNaN(numericRate) || numericRate < 0) {
                toast({ title: 'Invalid Rate', description: 'Tax rate must be a positive number.', variant: 'destructive'});
                return;
            }

            const response = await fetch('/api/tax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, rate: numericRate, appliedTo: JSON.stringify(appliedTo) }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save configuration.');
            }

            toast({ title: 'Success', description: 'Tax configuration has been saved.' });
        } catch (error: any) {
             toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Tax Configuration</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Global Tax Settings</CardTitle>
                    <CardDescription>Define a universal tax rate and apply it to specific loan components. This will affect all providers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="tax-name">Tax Name</Label>
                                <Input 
                                    id="tax-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., VAT"
                                    className="max-w-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                                <Input 
                                    id="tax-rate"
                                    type="number"
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    placeholder="e.g., 15"
                                    className="max-w-xs"
                                />
                            </div>
                             <div className="space-y-4">
                                <Label>Apply Tax On</Label>
                                <div className="space-y-2 rounded-md border p-4">
                                    {TAX_COMPONENTS.map(component => (
                                        <div key={component.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`tax-on-${component.id}`}
                                                checked={appliedTo.includes(component.id)}
                                                onCheckedChange={(checked) => handleComponentChange(component.id, !!checked)}
                                            />
                                            <Label htmlFor={`tax-on-${component.id}`} className="font-normal">{component.label}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
