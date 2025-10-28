

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2, Loader2, Edit, ChevronDown, Settings2, Save, FilePlus2, Upload, FileClock, Pencil, Link as LinkIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import type { LoanProvider, LoanProduct, FeeRule, PenaltyRule, DataProvisioningConfig, LoanAmountTier, TermsAndConditions, DataColumn, DataProvisioningUpload, Tax } from '@/lib/types';
import { AddProviderDialog } from '@/components/loan/add-provider-dialog';
import { AddProductDialog } from '@/components/loan/add-product-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog as UIDialog,
  DialogContent as UIDialogContent,
  DialogHeader as UIDialogHeader,
  DialogTitle as UIDialogTitle,
  DialogFooter as UIDialogFooter,
  DialogClose as UIDialogClose,
  DialogDescription as UIDialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { produce } from 'immer';
import { IconDisplay } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { Checkbox } from '../ui/checkbox';
import Link from 'next/link';


// Helper to safely parse JSON fields that might be strings
const safeParseJson = (data: any, field: string, defaultValue: any) => {
    if (data && typeof data[field] === 'string') {
        try {
            return JSON.parse(data[field]);
        } catch (e) {
            return defaultValue;
        }
    }
    return data?.[field] ?? defaultValue;
};

const ProductSettingsForm = ({ provider, product, providerColor, onSave, onDelete, onUpdate, allDataConfigs }: {
    provider: LoanProvider;
    product: LoanProduct;
    providerColor?: string;
    onSave: (product: LoanProduct) => void;
    onDelete: () => void;
    onUpdate: (updatedProduct: Partial<LoanProduct>) => void;
    allDataConfigs: DataProvisioningConfig[];
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [viewingUpload, setViewingUpload] = useState<DataProvisioningUpload | null>(null);
    
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const formData = useMemo(() => {
        return {
            ...product,
            serviceFee: safeParseJson(product, 'serviceFee', { type: 'percentage', value: 0 }),
            dailyFee: safeParseJson(product, 'dailyFee', { type: 'percentage', value: 0, calculationBase: 'principal' }),
            penaltyRules: safeParseJson(product, 'penaltyRules', []),
            eligibilityFilter: product.eligibilityFilter
        };
    }, [product]);
    
    const linkedConfig = useMemo(() => {
        if (!product.dataProvisioningConfigId) return null;
        return allDataConfigs.find(c => c.id === product.dataProvisioningConfigId);
    }, [product.dataProvisioningConfigId, allDataConfigs]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        onUpdate({ [name]: value === '' ? null : value });
    };

    const handleSwitchChange = (name: keyof LoanProduct, checked: boolean) => {
        if (name === 'status') {
            onUpdate({ status: checked ? 'Active' : 'Disabled' });
        } else {
            onUpdate({ [name]: checked });
        }
    }
    
    const handleFilterFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !product.dataProvisioningConfigId) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('configId', product.dataProvisioningConfigId);
            formData.append('productFilter', 'true');
            formData.append('productId', product.id);
            
            const response = await fetch('/api/settings/data-provisioning-uploads', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload file.');
            }

            const newUpload: DataProvisioningUpload = await response.json();
            
            // Create the filter object from the file headers
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length === 0) {
                throw new Error("File is empty.");
            }
            
            const headers = Object.keys(json[0] as object);
            const filterObject = headers.reduce((acc, header) => {
                const values = json.map(row => (row as any)[header]).filter(Boolean);
                acc[header] = values.join(', ');
                return acc;
            }, {} as Record<string, string>);
            
            const updatedProductData: Partial<LoanProduct> = {
                eligibilityFilter: JSON.stringify(filterObject, null, 2),
                eligibilityUploadId: newUpload.id,
                eligibilityUpload: newUpload,
            };
            onUpdate(updatedProductData);

            toast({ title: "Filter Generated", description: `The eligibility list has been generated from ${file.name}. Remember to save changes.` });

        } catch (error: any) {
            toast({ title: "Error reading file", description: error.message, variant: 'destructive'});
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const parsedDuration = parseInt(String(formData.duration));
            const payload: any = {
                ...formData,
                minLoan: parseFloat(String(formData.minLoan)) || 0,
                maxLoan: parseFloat(String(formData.maxLoan)) || 0,
                duration: isNaN(parsedDuration) ? 30 : parsedDuration,
            };

            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Failed to save product settings.');
            }
            const savedProduct = await response.json();
            onSave(savedProduct); // This will update the parent state with the full saved product
            toast({ title: "Settings Saved", description: `Settings for ${product.name} have been updated.` });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleDeleteFilter = async () => {
        if (!product.eligibilityUploadId) return;
        setIsSaving(true);
        try {
            // Call an API to delete the upload record and nullify the fields on the product
            const response = await fetch(`/api/settings/products/eligibility-filter?productId=${product.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete filter.');
            }
            onUpdate({ eligibilityFilter: null, eligibilityUploadId: null, eligibilityUpload: undefined });
            toast({ title: "Filter Deleted", description: "Eligibility list has been removed." });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };


    return (
       <>
       <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full space-x-4 px-4 py-2 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{product.name}</h4>
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                 <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-background space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id={`status-${product.id}`}
                                checked={formData.status === 'Active'} 
                                onCheckedChange={(checked) => handleSwitchChange('status', checked)}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                            <Label htmlFor={`status-${product.id}`}>{formData.status}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`allowConcurrentLoans-${product.id}`}
                                checked={!!formData.allowConcurrentLoans}
                                onCheckedChange={(checked) => handleSwitchChange('allowConcurrentLoans', checked)}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                            <Label htmlFor={`allowConcurrentLoans-${product.id}`}>Combinable with Other Loans</Label>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`minLoan-${product.id}`}>Min Loan Amount</Label>
                            <Input
                                id={`minLoan-${product.id}`}
                                name="minLoan"
                                type="number"
                                value={formData.minLoan ?? ''}
                                onChange={handleChange}
                                placeholder="e.g., 500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`maxLoan-${product.id}`}>Max Loan Amount</Label>
                            <Input
                                id={`maxLoan-${product.id}`}
                                name="maxLoan"
                                type="number"
                                value={formData.maxLoan ?? ''}
                                onChange={handleChange}
                                placeholder="e.g., 2500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`duration-${product.id}`}>Loan Duration (days)</Label>
                            <Input
                                id={`duration-${product.id}`}
                                name="duration"
                                type="number"
                                value={formData.duration ?? ''}
                                onChange={handleChange}
                                placeholder="e.g., 30"
                            />
                        </div>
                    </div>
                    
                     <div className="space-y-4 border-t pt-6">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`dataProvisioningEnabled-${product.id}`}
                                checked={!!formData.dataProvisioningEnabled}
                                onCheckedChange={(checked) => handleSwitchChange('dataProvisioningEnabled', checked)}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                            <Label htmlFor={`dataProvisioningEnabled-${product.id}`}>Eligibility Allow-List</Label>
                        </div>
                        {formData.dataProvisioningEnabled && (
                            <div className="pl-8 space-y-4">
                               <div className="space-y-2">
                                    <Label>Link Data Source</Label>
                                    <Select 
                                        value={product.dataProvisioningConfigId || ''}
                                        onValueChange={(value) => onUpdate({ dataProvisioningConfigId: value })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a data source to link..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allDataConfigs.map(config => (
                                                <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Select the data source this product's eligibility list will be based on.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Upload List</Label>
                                    <div className="flex items-center gap-4">
                                        <Button asChild variant="outline" size="sm">
                                             <label htmlFor={`filter-upload-${product.id}`} className={cn("cursor-pointer", !product.dataProvisioningConfigId && 'cursor-not-allowed opacity-50')}>
                                                <Upload className="h-4 w-4 mr-2"/>
                                                {isUploading ? "Uploading..." : "Upload Excel File"}
                                                <input
                                                    ref={fileInputRef}
                                                    id={`filter-upload-${product.id}`}
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    onChange={handleFilterFileUpload}
                                                    className="hidden"
                                                    disabled={isUploading || !product.dataProvisioningConfigId}
                                                />
                                            </label>
                                        </Button>
                                         <p className="text-xs text-muted-foreground">Upload a file to generate the filter. The headers must match the linked data source.</p>
                                    </div>
                                    {!product.dataProvisioningConfigId && <p className="text-xs text-destructive">A data source must be linked before uploading.</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Uploaded List</Label>
                                    {product.eligibilityUpload ? (
                                         <div className="border rounded-lg p-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-medium">{product.eligibilityUpload.fileName}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        By {product.eligibilityUpload.uploadedBy} on {format(new Date(product.eligibilityUpload.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setViewingUpload(product.eligibilityUpload)}>View</Button>
                                                    <Button variant="destructive" size="sm" onClick={handleDeleteFilter}>Delete List</Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No eligibility list has been uploaded for this product.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 justify-end">
                        <Button variant="destructive" type="button" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                        <Button type="submit" style={{ backgroundColor: providerColor }} className="text-white" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </CollapsibleContent>
        </Collapsible>
        {viewingUpload && (
             <UploadDataViewerDialog
                upload={viewingUpload}
                onClose={() => setViewingUpload(null)}
            />
        )}
       </>
    )
}

function ProvidersTab({ providers, onProvidersChange }: { 
    providers: LoanProvider[],
    onProvidersChange: (updater: React.SetStateAction<LoanProvider[]>) => void;
}) {
    const { currentUser } = useAuth();
    const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<LoanProvider | null>(null);
    const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<{ type: 'provider' | 'product'; providerId: string; productId?: string } | null>(null);
    const [dataConfigs, setDataConfigs] = useState<DataProvisioningConfig[]>(providers.flatMap(p => p.dataProvisioningConfigs || []));

    const { toast } = useToast();
    
    useEffect(() => {
        setDataConfigs(providers.flatMap(p => p.dataProvisioningConfigs || []));
    }, [providers]);
    
    const themeColor = useMemo(() => {
        if (currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') {
            return providers.find(p => p.name === 'NIb Bank')?.colorHex || '#fdb913';
        }
        return providers.find(p => p.name === currentUser?.providerName)?.colorHex || '#fdb913';
    }, [currentUser, providers]);
    
    const handleOpenProviderDialog = (provider: LoanProvider | null = null) => {
        setEditingProvider(provider);
        setIsProviderDialogOpen(true);
    };

    const handleSaveProvider = async (providerData: Partial<Omit<LoanProvider, 'products' | 'dataProvisioningConfigs' | 'id' | 'initialBalance'>>) => {
        const isEditing = !!providerData.id;
        const method = isEditing ? 'PUT' : 'POST';
        const endpoint = '/api/settings/providers';
        const body = JSON.stringify(providerData);
        
        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error?.message || `Failed to ${isEditing ? 'update' : 'add'} provider`);
            }
            
            const savedProviderResponse = await response.json();
            
            onProvidersChange(produce(draft => {
                if (isEditing) {
                    const index = draft.findIndex(p => p.id === savedProviderResponse.id);
                    if (index !== -1) {
                        const originalProvider = draft[index];
                        draft[index] = {
                            ...originalProvider,
                            ...savedProviderResponse,
                        };
                    }
                } else {
                     draft.push({
                        ...savedProviderResponse,
                        products: [],
                        dataProvisioningConfigs: [],
                    });
                }
            }));

            toast({ title: `Provider ${isEditing ? 'Updated' : 'Added'}`, description: `${isEditing ? providerData.name : savedProviderResponse.name} has been successfully saved.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };
    
    const handleOpenAddProductDialog = (providerId: string) => {
        setSelectedProviderId(providerId);
        setIsAddProductDialogOpen(true);
    };

    const handleAddProduct = async (newProductData: Omit<LoanProduct, 'id' | 'status' | 'serviceFee' | 'dailyFee' | 'penaltyRules' | 'providerId' > & { icon?: string }) => {
        if (!selectedProviderId) return;

        try {
             const response = await fetch('/api/settings/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newProductData, providerId: selectedProviderId })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add product');
            }
            const newProduct = await response.json();

            onProvidersChange(produce(draft => {
                const provider = draft.find(p => p.id === selectedProviderId);
                if (provider) {
                    if (!provider.products) provider.products = [];
                    provider.products.push(newProduct);
                }
            }));
            toast({ title: "Product Added", description: `${newProduct.name} has been added successfully.` });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };

    const handleUpdateProduct = (providerId: string, updatedProduct: LoanProduct) => {
        onProvidersChange(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                     provider.products[productIndex] = { ...provider.products[productIndex], ...updatedProduct };
                }
            }
        }));
    }

    
    const confirmDelete = () => {
        if (!deletingId) return;

        if (deletingId.type === 'provider') {
            handleDeleteProvider(deletingId.providerId);
        } else if (deletingId.type === 'product' && deletingId.productId) {
            handleDeleteProduct(deletingId.providerId, deletingId.productId);
        }
        setDeletingId(null);
    }
    
    const handleDeleteProvider = async (providerId: string) => {
        try {
            const response = await fetch(`/api/settings/providers?id=${providerId}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not delete provider.');
            }
            onProvidersChange(prev => prev.filter(p => p.id !== providerId));
            toast({ title: "Provider Deleted" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    }
    
    const handleDeleteProduct = async (providerId: string, productId: string) => {
        try {
             const response = await fetch('/api/settings/products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId }),
             });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Could not delete product.');
            }
             onProvidersChange(produce(draft => {
                const provider = draft.find(p => p.id === providerId);
                if (provider) {
                    provider.products = provider.products.filter(p => p.id !== productId);
                }
            }));
            toast({ title: "Product Deleted" });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    }

    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return providers;
        }
        return providers.filter(p => p.id === currentUser.providerId);
    }, [providers, currentUser]);


    return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div></div>
        {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
          <Button onClick={() => handleOpenProviderDialog(null)} style={{ backgroundColor: themeColor }} className="text-white">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
          </Button>
        )}
      </div>
      <Accordion type="multiple" className="w-full space-y-4">
        {visibleProviders.map((provider) => (
          <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
            <div className="flex items-center w-full p-4">
              <AccordionTrigger className="flex-1 p-0 hover:no-underline text-left" hideChevron>
                <div className="flex items-center gap-4">
                  <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                  <div>
                    <div className="text-lg font-semibold">{provider.name}</div>
                    <p className="text-sm text-muted-foreground">{(provider.products || []).length} products</p>
                  </div>
                </div>
              </AccordionTrigger>
              <div className="flex items-center gap-2 ml-auto pl-4">
                {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                  <>
                    <Button variant="ghost" size="icon" className="hover:bg-muted h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenProviderDialog(provider); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeletingId({ type: 'provider', providerId: provider.id }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <AccordionTrigger className="p-2">
                  <span className="sr-only">Toggle</span>
                </AccordionTrigger>
              </div>
            </div>
            <AccordionContent className="p-4 border-t">
              <div className="space-y-6">
                {(provider.products || []).map(product => (
                  <ProductSettingsForm 
                    key={product.id}
                    provider={provider}
                    product={{...product, icon: product.icon || 'PersonStanding'}} 
                    providerColor={provider.colorHex} 
                    onSave={(savedProduct) => handleUpdateProduct(provider.id, savedProduct)}
                    onDelete={() => setDeletingId({ type: 'product', providerId: provider.id, productId: product.id })}
                    onUpdate={(updatedFields) => handleUpdateProduct(provider.id, { id: product.id, ...updatedFields })}
                    allDataConfigs={dataConfigs.filter(c => c.providerId === provider.id)}
                  />
                ))}
                <Button 
                  variant="outline" 
                  className="w-full hover:text-white"
                  onClick={() => handleOpenAddProductDialog(provider.id)}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = provider.colorHex || themeColor; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <AddProviderDialog
        isOpen={isProviderDialogOpen}
        onClose={() => setIsProviderDialogOpen(false)}
        onSave={handleSaveProvider}
        provider={editingProvider}
        primaryColor={themeColor}
      />
      <AddProductDialog
        isOpen={isAddProductDialogOpen}
        onClose={() => setIsAddProductDialogOpen(false)}
        onAddProduct={handleAddProduct}
      />
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected item. If it has associated data (like products or loans), this action might be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
    );
}

type DailyFeeRule = FeeRule & { calculationBase?: 'principal' | 'compound' };

const FeeInput = ({ label, fee, onChange, isEnabled }: { label: string; fee: FeeRule; onChange: (fee: FeeRule) => void; isEnabled: boolean; }) => {
    return (
        <div className="flex items-center gap-2">
            <Label className={cn("w-28", !isEnabled && "text-muted-foreground/50")}>{label}</Label>
            <Select value={fee.type} onValueChange={(type: 'fixed' | 'percentage') => onChange({ ...fee, type })} disabled={!isEnabled}>
                <SelectTrigger className="w-32" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
            </Select>
            <div className="relative flex-1">
                <Input
                    type="number"
                    value={fee.value ?? ''}
                    onChange={(e) => onChange({ ...fee, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    placeholder="Enter value"
                    className={cn(fee.type === 'percentage' ? "pr-8" : "")}
                    disabled={!isEnabled}
                />
                {fee.type === 'percentage' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
            </div>
        </div>
    );
};

const DailyFeeInput = ({ label, fee, onChange, isEnabled }: { label: string; fee: DailyFeeRule; onChange: (fee: DailyFeeRule) => void; isEnabled: boolean; }) => {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Label className={cn("w-28", !isEnabled && "text-muted-foreground/50")}>{label}</Label>
                <Select value={fee.type} onValueChange={(type: 'fixed' | 'percentage') => onChange({ ...fee, type, calculationBase: type === 'fixed' ? undefined : fee.calculationBase || 'principal' })} disabled={!isEnabled}>
                    <SelectTrigger className="w-32" disabled={!isEnabled}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                </Select>
                <div className="relative flex-1">
                    <Input
                        type="number"
                        value={fee.value ?? ''}
                        onChange={(e) => onChange({ ...fee, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        placeholder="Enter value"
                        className={cn(fee.type === 'percentage' ? "pr-8" : "")}
                        disabled={!isEnabled}
                    />
                    {fee.type === 'percentage' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
                </div>
            </div>
            {isEnabled && fee.type === 'percentage' && (
                <div className="flex items-center gap-2 pl-[124px]">
                    <Label className="w-32 text-sm text-muted-foreground">Calculation Base</Label>
                    <Select value={fee.calculationBase || 'principal'} onValueChange={(base: 'principal' | 'compound') => onChange({ ...fee, calculationBase: base })}>
                        <SelectTrigger className="flex-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="principal">Principal</SelectItem>
                            <SelectItem value="compound">Compound (Principal + Accrued)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
};

const PenaltyRuleRow = ({ rule, onChange, onRemove, color, isEnabled }: { rule: PenaltyRule, onChange: (rule: PenaltyRule) => void, onRemove: () => void, color?: string, isEnabled: boolean }) => {
    return (
        <div className="flex items-center gap-2">
            <Input 
                type="number" 
                value={rule.fromDay ?? ''}
                onChange={(e) => onChange({...rule, fromDay: e.target.value === '' ? '' : parseInt(e.target.value)})}
                placeholder="From"
                className="w-20"
                disabled={!isEnabled}
            />
            <Input 
                type="number" 
                value={rule.toDay === Infinity ? '' : (rule.toDay ?? '')}
                onChange={(e) => onChange({...rule, toDay: e.target.value === '' ? null : parseInt(e.target.value)})}
                placeholder="To"
                className="w-20"
                disabled={!isEnabled}
            />
            <Select value={rule.type} onValueChange={(type: 'fixed' | 'percentageOfPrincipal' | 'percentageOfCompound') => onChange({ ...rule, type })} disabled={!isEnabled}>
                <SelectTrigger className="w-48" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentageOfPrincipal">Percentage of Principal</SelectItem>
                    <SelectItem value="percentageOfCompound">Percentage of Compound</SelectItem>
                </SelectContent>
            </Select>
             <Select value={rule.frequency || 'daily'} onValueChange={(freq: 'daily' | 'one-time') => onChange({ ...rule, frequency: freq })} disabled={!isEnabled}>
                <SelectTrigger className="w-36" disabled={!isEnabled}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="one-time">One Time</SelectItem>
                </SelectContent>
            </Select>
             <div className="relative flex-1">
                <Input
                    type="number"
                    value={rule.value ?? ''}
                    onChange={(e) => onChange({ ...rule, value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    placeholder="Value"
                    className={cn(rule.type !== 'fixed' ? "pr-8" : "")}
                    disabled={!isEnabled}
                />
                 {rule.type !== 'fixed' && <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground", !isEnabled && "text-muted-foreground/50")}>%</span>}
            </div>
             <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive" disabled={!isEnabled}><Trash2 className="h-4 w-4" /></Button>
        </div>
    );
};

function LoanTiersForm({ product, onUpdate, color }: {
    product: LoanProduct;
    onUpdate: (updatedProduct: Partial<LoanProduct>) => void;
    color?: string;
}) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const tiers = product.loanAmountTiers || [];

    const handleTierChange = (index: number, field: keyof Omit<LoanAmountTier, 'id' | 'productId'>, value: string) => {
        const newTiers = produce(tiers, draft => {
            const newTier = { ...draft[index], [field]: value === '' ? '' : value };
            draft[index] = newTier;

            if (field === 'toScore' && index < draft.length - 1) {
                const nextTier = { ...draft[index + 1] };
                nextTier.fromScore = (Number(value) || 0) + 1;
                draft[index + 1] = nextTier;
            }
        });
        onUpdate({ loanAmountTiers: newTiers });
    };

    const handleAddTier = () => {
        const lastTier = tiers[tiers.length - 1];
        const newFromScore = lastTier ? (Number(lastTier.toScore) || 0) + 1 : 0;
        
        const newTier: LoanAmountTier = {
            id: `tier-${Date.now()}`,
            productId: product.id,
            fromScore: newFromScore,
            toScore: newFromScore + 9,
            loanAmount: 0
        };

        onUpdate({ loanAmountTiers: [...tiers, newTier]});
    };

    const handleRemoveTier = (index: number) => {
        const newTiers = tiers.filter((_, i) => i !== index);
        onUpdate({ loanAmountTiers: newTiers });
    };
    
    const handleSaveTiers = async () => {
        setIsLoading(true);
        try {
            const tiersToSend = tiers.map((tier, i) => {
                const fromScore = Number(tier.fromScore);
                const toScore = Number(tier.toScore);
                const loanAmount = Number(tier.loanAmount);

                if (isNaN(fromScore) || isNaN(toScore) || isNaN(loanAmount)) {
                    toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, all fields must be valid numbers.`, variant: 'destructive'});
                    throw new Error("Invalid tier data");
                }
                if (loanAmount <= 0) {
                    toast({ title: 'Invalid Loan Amount', description: `In tier #${i + 1}, the loan amount must be positive.`, variant: 'destructive'});
                    throw new Error("Invalid loan amount");
                }
                 if (product.maxLoan != null && loanAmount > product.maxLoan) {
                    toast({ title: 'Invalid Loan Amount', description: `In tier #${i + 1}, the loan amount cannot exceed the product's maximum of ${product.maxLoan}.`, variant: 'destructive'});
                    throw new Error("Invalid loan amount");
                }
                if (fromScore > toScore) {
                    toast({ title: 'Invalid Tier', description: `In tier #${i + 1}, the "From Score" cannot be greater than the "To Score".`, variant: 'destructive'});
                    throw new Error("Invalid tier data");
                }
                if (i > 0) {
                    const prevToScore = Number(tiers[i-1].toScore);
                    if (fromScore <= prevToScore) {
                        toast({ title: 'Overlapping Tiers', description: `Tier #${i + 1} overlaps with the previous tier. "From Score" must be greater than the previous "To Score".`, variant: 'destructive'});
                        throw new Error("Overlapping Tiers");
                    }
                }
                return {
                    ...tier,
                    fromScore,
                    toScore,
                    loanAmount,
                    id: String(tier.id).startsWith('tier-') ? undefined : tier.id
                }
            });

            const response = await fetch('/api/settings/loan-amount-tiers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: product.id, tiers: tiersToSend }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save loan tiers.');
            }

            const savedTiers = await response.json();
            onUpdate({ loanAmountTiers: savedTiers });
            
            toast({ title: 'Success', description: 'Loan amount tiers have been saved successfully.' });
        } catch (error: any) {
            // Validation errors are already toasted. Only toast for server/network errors.
            if (!["Invalid tier data", "Invalid loan amount", "Overlapping Tiers"].includes(error.message)) {
                toast({ title: 'Error Saving Tiers', description: error.message, variant: 'destructive' });
            }
        } finally {
            setIsLoading(false);
        }
    };


    return (
         <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <Card>
                <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Loan Amount Tiers</CardTitle>
                                <CardDescription>Define loan amounts based on credit scores for this product.</CardDescription>
                            </div>
                            <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                         {tiers.map((tier, index) => (
                            <div key={tier.id} className="flex items-center gap-4 p-2 rounded-md bg-muted/50">
                                <Label className="w-20">From Score</Label>
                                <Input
                                    type="number"
                                    value={tier.fromScore ?? ''}
                                    onChange={(e) => handleTierChange(index, 'fromScore', e.target.value)}
                                    className="w-28"
                                    disabled={index > 0} // Only first "from" is editable
                                />
                                <Label className="w-16">To Score</Label>
                                 <Input
                                    type="number"
                                    value={tier.toScore ?? ''}
                                    onChange={(e) => handleTierChange(index, 'toScore', e.target.value)}
                                    className="w-28"
                                />
                                <Label className="w-24">Loan Amount</Label>
                                 <Input
                                    type="number"
                                    value={tier.loanAmount ?? ''}
                                    onChange={(e) => handleTierChange(index, 'loanAmount', e.target.value)}
                                    className="flex-1"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveTier(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                         <Button variant="outline" onClick={handleAddTier} className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Tier
                        </Button>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSaveTiers} style={{ backgroundColor: color }} className="text-white ml-auto" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Tiers for {product.name}
                        </Button>
                    </CardFooter>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

function ProductConfiguration({ product, providerColor, onProductUpdate, taxConfig }: { 
    product: LoanProduct; 
    providerColor?: string;
    onProductUpdate: (updatedProduct: LoanProduct) => void;
    taxConfig: Tax;
}) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    
    const taxAppliedTo = useMemo(() => safeParseJson({appliedTo: taxConfig.appliedTo}, 'appliedTo', []), [taxConfig.appliedTo]);

    // Ensure JSON fields are parsed on initialization or when product prop changes
    const parsedProduct = useMemo(() => {
        const serviceFee = safeParseJson(product, 'serviceFee', { type: 'percentage', value: 0 });
        const dailyFee = safeParseJson(product, 'dailyFee', { type: 'percentage', value: 0, calculationBase: 'principal' });
        const penaltyRules = safeParseJson(product, 'penaltyRules', []).map((r: any) => ({ ...r, frequency: r.frequency || 'daily' }));
        return {
            ...product,
            serviceFee,
            dailyFee,
            penaltyRules,
        };
    }, [product]);
    
    const [config, setConfig] = useState(parsedProduct);

    useEffect(() => {
        setConfig(parsedProduct);
    }, [parsedProduct]);

    const handleUpdate = (update: Partial<LoanProduct>) => {
        setConfig(prev => ({...prev, ...update}));
    };

    const handleAddPenaltyRule = () => {
        const newRule: PenaltyRule = {
            id: `penalty-${Date.now()}`,
            fromDay: 1,
            toDay: null,
            type: 'fixed',
            value: 0,
            frequency: 'daily'
        };
        setConfig(prev => ({...prev, penaltyRules: [...prev.penaltyRules, newRule]}));
    };

    const handleRemovePenaltyRule = (ruleId: string) => {
        setConfig(prev => ({...prev, penaltyRules: prev.penaltyRules.filter(r => r.id !== ruleId)}));
    };
    
    const handleUpdatePenaltyRule = (ruleId: string, updatedRule: PenaltyRule) => {
         setConfig(prev => ({
            ...prev,
            penaltyRules: prev.penaltyRules.map(r => r.id === ruleId ? updatedRule : r)
        }));
    };

    const handleSave = async () => {
        try {
            const response = await fetch('/api/settings/products', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save configuration');
            }
            const savedProduct = await response.json();
            onProductUpdate(savedProduct);
            toast({ title: 'Configuration Saved', description: `Configuration for ${product.name} has been updated.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
                 <button className="flex items-center justify-between w-full space-x-4 px-4 py-2 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                    <h4 className="text-sm font-semibold">{product.name}</h4>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                 <Card className="border-t-0 rounded-t-none">
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`serviceFeeEnabled-${config.id}`} className="font-medium">Service Fee</Label>
                                {taxAppliedTo.includes('serviceFee') && <Badge variant="outline" className="text-xs">Taxable ({taxConfig.rate}%)</Badge>}
                            </div>
                            <Switch
                                id={`serviceFeeEnabled-${config.id}`}
                                checked={config.serviceFeeEnabled}
                                onCheckedChange={(checked) => handleUpdate({ serviceFeeEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                        </div>
                    <FeeInput 
                            label="Fee Details"
                            fee={config.serviceFee}
                            onChange={(fee) => handleUpdate({ serviceFee: fee })}
                            isEnabled={!!config.serviceFeeEnabled}
                        />
                        
                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                             <div className="flex items-center gap-2">
                                <Label htmlFor={`dailyFeeEnabled-${config.id}`} className="font-medium">Daily Fee</Label>
                                {taxAppliedTo.includes('interest') && <Badge variant="outline" className="text-xs">Taxable ({taxConfig.rate}%)</Badge>}
                            </div>
                            <Switch
                                id={`dailyFeeEnabled-${config.id}`}
                                checked={config.dailyFeeEnabled}
                                onCheckedChange={(checked) => handleUpdate({ dailyFeeEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                        </div>
                        <DailyFeeInput 
                            label="Fee Details"
                            fee={config.dailyFee}
                            onChange={(fee) => handleUpdate({ dailyFee: fee })}
                            isEnabled={!!config.dailyFeeEnabled}
                        />
                        
                        <div className="flex items-center justify-between border-b pb-4 pt-4">
                             <div className="flex items-center gap-2">
                                <Label htmlFor={`penaltyRulesEnabled-${config.id}`} className="font-medium">Penalty Rules</Label>
                                 {taxAppliedTo.includes('penalty') && <Badge variant="outline" className="text-xs">Taxable ({taxConfig.rate}%)</Badge>}
                            </div>
                            <Switch
                                id={`penaltyRulesEnabled-${config.id}`}
                                checked={config.penaltyRulesEnabled}
                                onCheckedChange={(checked) => handleUpdate({ penaltyRulesEnabled: checked })}
                                className="data-[state=checked]:bg-[--provider-color]"
                                style={{'--provider-color': providerColor} as React.CSSProperties}
                            />
                        </div>
                        <div>
                            <div className="space-y-2 p-4 border rounded-md bg-muted/50">
                                {config.penaltyRules.map((rule) => (
                                    <PenaltyRuleRow
                                        key={rule.id}
                                        rule={rule}
                                        onChange={(updatedRule) => handleUpdatePenaltyRule(rule.id, updatedRule)}
                                        onRemove={() => handleRemovePenaltyRule(rule.id)}
                                        color={providerColor}
                                        isEnabled={!!config.penaltyRulesEnabled}
                                    />
                                ))}
                                <Button variant="outline" size="sm" onClick={handleAddPenaltyRule} disabled={!config.penaltyRulesEnabled}>
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add Penalty Rule
                                </Button>
                            </div>
                        </div>
                        
                        <div className="pt-4">
                            <LoanTiersForm
                                product={config}
                                onUpdate={(updatedProductData) => handleUpdate(updatedProductData)}
                                color={providerColor}
                            />
                        </div>

                </CardContent>
                <CardFooter>
                        <Button 
                            onClick={handleSave} 
                            size="sm"
                            style={{ backgroundColor: providerColor }}
                            className="text-white ml-auto"
                        >
                            Save Configuration for {config.name}
                        </Button>
                </CardFooter>
            </Card>
            </CollapsibleContent>
        </Collapsible>
    );
}

function ConfigurationTab({ providers, onProductUpdate, taxConfig }: { 
    providers: LoanProvider[],
    onProductUpdate: (providerId: string, updatedProduct: LoanProduct) => void;
    taxConfig: Tax;
}) {
    const { currentUser } = useAuth();
    
    const visibleProviders = useMemo(() => {
        if (!currentUser || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') {
            return providers;
        }
        return providers.filter(p => p.id === currentUser.providerId);
    }, [providers, currentUser]);
    
    if (visibleProviders.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Product Fee Configuration</CardTitle>
                    <CardDescription>
                        No providers available to configure.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    return (
        <Accordion type="multiple" className="w-full space-y-4">
            {visibleProviders.map((provider) => (
                <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                    <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                        <div className="flex items-center gap-4">
                            <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                            <div>
                                <div className="text-lg font-semibold">{provider.name}</div>
                                <p className="text-sm text-muted-foreground">{(provider.products || []).length} products to configure</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t space-y-6">
                       {(provider.products || []).map(product => (
                            <ProductConfiguration
                                key={product.id}
                                product={product}
                                providerColor={provider.colorHex}
                                onProductUpdate={(updatedProduct) => onProductUpdate(provider.id, updatedProduct)}
                                taxConfig={taxConfig}
                            />
                       ))}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

const TAX_COMPONENTS = [
    { id: 'serviceFee', label: 'Service Fee' },
    { id: 'interest', label: 'Daily Fee (Interest)' },
    { id: 'penalty', label: 'Penalty' },
];

function TaxTab({ initialTaxConfig }: { initialTaxConfig: Tax }) {
    const [taxConfig, setTaxConfig] = useState(initialTaxConfig);

    useEffect(() => {
        setTaxConfig(initialTaxConfig);
    }, [initialTaxConfig]);
    
    const appliedTo = useMemo(() => safeParseJson({appliedTo: taxConfig.appliedTo}, 'appliedTo', []), [taxConfig.appliedTo]);

    return (
        <Card>
            <CardHeader className='flex-row items-start justify-between'>
                <div>
                    <CardTitle>Global Tax Configuration</CardTitle>
                    <CardDescription>This is a read-only view of the current system-wide tax settings.</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/admin/tax">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Configuration
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input 
                        value={`${taxConfig.rate}%`}
                        readOnly
                        className="max-w-xs bg-muted"
                    />
                </div>
                <div className="space-y-4">
                    <Label>Tax is Applied On</Label>
                    <div className="space-y-2 rounded-md border p-4 bg-muted">
                        {TAX_COMPONENTS.map(component => (
                            <div key={component.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`tax-on-${component.id}-readonly`}
                                    checked={appliedTo.includes(component.id)}
                                    disabled
                                />
                                <Label htmlFor={`tax-on-${component.id}-readonly`} className="font-normal">{component.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function SettingsClient({ initialProviders, initialTaxConfig }: { initialProviders: LoanProvider[], initialTaxConfig: Tax }) {
    const [providers, setProviders] = useState(initialProviders);

    const onProductUpdate = useCallback((providerId: string, updatedProduct: LoanProduct) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
                if (productIndex !== -1) {
                    // Make sure to preserve the existing loanAmountTiers if they are not in the update
                    const existingTiers = provider.products[productIndex].loanAmountTiers;
                    provider.products[productIndex] = {
                        ...updatedProduct,
                        loanAmountTiers: updatedProduct.loanAmountTiers || existingTiers,
                    };
                }
            }
        }));
    }, []);

    const handleProvidersChange = useCallback((updater: React.SetStateAction<LoanProvider[]>) => {
        setProviders(updater);
    }, []);
    
    const handleProviderUpdate = useCallback((update: Partial<LoanProvider>) => {
        setProviders(produce(draft => {
            const provider = draft.find(p => p.id === update.id);
            if (provider) {
                Object.assign(provider, update);
            }
        }));
    }, []);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <Tabs defaultValue="providers" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providers">Providers & Products</TabsTrigger>
                    <TabsTrigger value="configuration">Fee & Tier Configuration</TabsTrigger>
                    <TabsTrigger value="agreement">Borrower Agreement</TabsTrigger>
                    <TabsTrigger value="tax">Tax</TabsTrigger>
                </TabsList>
                <TabsContent value="providers">
                    <ProvidersTab providers={providers} onProvidersChange={handleProvidersChange} />
                </TabsContent>
                <TabsContent value="configuration">
                     <ConfigurationTab providers={providers} onProductUpdate={onProductUpdate} taxConfig={initialTaxConfig} />
                </TabsContent>
                 <TabsContent value="agreement">
                    <Accordion type="multiple" className="w-full space-y-4">
                        {providers.map((provider) => (
                             <AccordionItem value={provider.id} key={provider.id} className="border rounded-lg bg-card">
                                 <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                                    <div className="flex items-center gap-4">
                                        <IconDisplay iconName={provider.icon} className="h-6 w-6" />
                                        <div className="text-lg font-semibold">{provider.name}</div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                    <AgreementTab provider={provider} onProviderUpdate={handleProviderUpdate} />
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                    </Accordion>
                </TabsContent>
                <TabsContent value="tax">
                    <TaxTab initialTaxConfig={initialTaxConfig} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AgreementTab({ provider, onProviderUpdate }: { provider: LoanProvider, onProviderUpdate: (update: Partial<LoanProvider>) => void }) {
    const { toast } = useToast();
    const [terms, setTerms] = useState<TermsAndConditions | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchTerms = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/settings/terms?providerId=${provider.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setTerms(data);
                }
            } catch (error) {
                 toast({ title: "Error", description: "Failed to load terms and conditions.", variant: "destructive"});
            } finally {
                setIsLoading(false);
            }
        };
        fetchTerms();
    }, [provider.id, toast]);
    
    const handleSave = async () => {
        if (!terms || !terms.content.trim()) {
            toast({ title: "Error", description: "Terms and conditions content cannot be empty.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerId: provider.id, content: terms.content })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save new terms.");
            }
            
            const newTerms = await response.json();
            setTerms(newTerms);
            onProviderUpdate({ id: provider.id, termsAndConditions: [newTerms] });
            toast({ title: "Published", description: `Version ${newTerms.version} of the terms has been published.` });

        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-32" />
        </div>
    }

    return (
        <div className="space-y-4">
            <Label htmlFor={`terms-content-${provider.id}`}>Terms and Conditions Content</Label>
             <Textarea
                id={`terms-content-${provider.id}`}
                value={terms?.content || ''}
                onChange={(e) => setTerms(prev => ({ ...(prev || { version: 0, content: '' }), content: e.target.value }) as TermsAndConditions)}
                placeholder="Enter the terms and conditions for your loan products here."
                rows={15}
            />
            <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                    Current Version: {terms?.version || 0}
                </p>
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                    Save & Publish New Version
                </Button>
            </div>
        </div>
    );
}

// --------------------------------------------------
// DATA PROVISIONING MANAGER (NEW COMPONENT)
// --------------------------------------------------
function DataProvisioningManager({ providerId, config, onConfigChange, allProviderProducts }: {
    providerId: string;
    config: DataProvisioningConfig | undefined;
    onConfigChange: (newConfig: DataProvisioningConfig) => void;
    allProviderProducts: LoanProduct[];
}) {
    const { toast } = useToast();
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [viewingUpload, setViewingUpload] = useState<DataProvisioningUpload | null>(null);

    const handleSaveConfig = async (newConfigData: Omit<DataProvisioningConfig, 'providerId' | 'id' | 'uploads'> & { id?: string }) => {
        const isEditing = !!newConfigData.id;
        const method = isEditing ? 'PUT' : 'POST';
        const endpoint = '/api/settings/data-provisioning';
        const body = { ...newConfigData, providerId: providerId };

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save config.');
            }
            const savedConfig = await response.json();
            
            onConfigChange(savedConfig);
            toast({ title: "Success", description: `Data type "${savedConfig.name}" saved successfully.` });
        } catch(error: any) {
            toast({ title: "Error", description: error.message, variant: 'destructive' });
        }
    };
    
    const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!config) return;

        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('configId', config.id);

            const response = await fetch('/api/settings/data-provisioning-uploads', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload file.');
            }
            
            const newUpload = await response.json();
            
            const updatedConfig = produce(config, draft => {
                if (!draft.uploads) draft.uploads = [];
                draft.uploads.unshift(newUpload);
            });
            onConfigChange(updatedConfig);

            toast({
                title: 'Upload Successful',
                description: `File "${file.name}" uploaded and recorded successfully.`,
            });

        } catch (error: any) {
             toast({
                title: 'Upload Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    if (!config) {
        return (
            <>
                <Button onClick={() => setIsConfigDialogOpen(true)}>
                    <FilePlus2 className="h-4 w-4 mr-2" /> Create Data Source
                </Button>
                <DataProvisioningDialog
                    isOpen={isConfigDialogOpen}
                    onClose={() => setIsConfigDialogOpen(false)}
                    onSave={handleSaveConfig}
                    config={null}
                />
            </>
        )
    }

    const generalUploads = useMemo(() => {
        const eligibilityUploadIds = new Set(allProviderProducts.map(p => p.eligibilityUploadId).filter(Boolean));
        return (config.uploads || []).filter(upload => !eligibilityUploadIds.has(upload.id));
    }, [config.uploads, allProviderProducts]);


    return (
        <>
            <Card className="bg-muted/50">
                <CardHeader className="flex flex-row justify-between items-center">
                     <div>
                        <CardTitle className="text-lg">{config.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsConfigDialogOpen(true)}><Edit className="h-4 w-4" /></Button>
                    </div>
                </CardHeader>
                <CardContent>
                   <h4 className="font-medium mb-2">Columns</h4>
                   <ul className="list-disc pl-5 text-sm text-muted-foreground mb-4">
                        {(config.columns || []).map(col => <li key={col.id}>{col.name} <span className="text-xs opacity-70">({col.type})</span> {col.isIdentifier && <Badge variant="outline" className="ml-2">ID</Badge>}</li>)}
                   </ul>
                   <Separator />
                   <div className="mt-4">
                       <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium">Upload History</h4>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isUploading}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Upload className="h-4 w-4 mr-2"/>}
                                Upload File
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={handleExcelUpload}
                            />
                       </div>
                       <div className="border rounded-md">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>File Name</TableHead>
                                       <TableHead>Rows</TableHead>
                                       <TableHead>Uploaded By</TableHead>
                                       <TableHead>Date</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {generalUploads.length > 0 ? (
                                       generalUploads.map(upload => (
                                            <TableRow key={upload.id} onClick={() => setViewingUpload(upload)} className="cursor-pointer hover:bg-muted">
                                                <TableCell className="font-medium flex items-center gap-2"><FileClock className="h-4 w-4 text-muted-foreground"/>{upload.fileName}</TableCell>
                                                <TableCell>{upload.rowCount}</TableCell>
                                                <TableCell>{upload.uploadedBy}</TableCell>
                                                <TableCell>{format(new Date(upload.uploadedAt), "yyyy-MM-dd HH:mm")}</TableCell>
                                            </TableRow>
                                       ))
                                   ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No files uploaded yet.</TableCell>
                                        </TableRow>
                                   )}
                               </TableBody>
                           </Table>
                       </div>
                   </div>
                </CardContent>
            </Card>

             <DataProvisioningDialog
                isOpen={isConfigDialogOpen}
                onClose={() => setIsConfigDialogOpen(false)}
                onSave={handleSaveConfig}
                config={config}
            />
            <UploadDataViewerDialog
                upload={viewingUpload}
                onClose={() => setViewingUpload(null)}
            />
        </>
    );
}

// --------------------------------------------------
// DATA PROVISIONING DIALOG (NEW COMPONENT)
// --------------------------------------------------
type EditableDataColumn = DataColumn & { optionsString?: string };

function DataProvisioningDialog({ isOpen, onClose, onSave, config }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: Omit<DataProvisioningConfig, 'providerId' | 'id' | 'uploads'> & { id?: string }) => void;
    config: DataProvisioningConfig | null;
}) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [columns, setColumns] = useState<EditableDataColumn[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (config) {
                setName(config.name);
                setColumns(config.columns.map(c => ({...c, optionsString: (c.options || []).join(', ') })) || []);
            } else {
                setName('');
                setColumns([]);
            }
        }
    }, [config, isOpen]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
            
            setColumns(headers.map((header, index) => ({
                id: `col-${Date.now()}-${index}`,
                name: header,
                type: 'string', // default type
                isIdentifier: index === 0, // default first column as identifier
                options: [],
                optionsString: '',
            })));
        };
        reader.readAsArrayBuffer(file);
    };

    const handleColumnChange = (index: number, field: keyof EditableDataColumn, value: string | boolean) => {
        setColumns(produce(draft => {
            if (field === 'isIdentifier' && typeof value === 'boolean') {
                // Ensure only one column can be the identifier
                draft.forEach((col, i) => {
                    col.isIdentifier = i === index ? value : false;
                });
            } else {
                 (draft[index] as any)[field] = value;
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!columns.some(c => c.isIdentifier)) {
            toast({ title: 'Error', description: 'Please mark one column as the customer identifier.', variant: 'destructive' });
            return;
        }

        // Process the final columns array before saving
        const finalColumns = columns.map(col => {
            const { optionsString, ...rest } = col;
            const finalOptions = optionsString ? optionsString.split(',').map(s => s.trim()).filter(Boolean) : [];
            return { ...rest, options: finalOptions };
        });

        onSave({ id: config?.id, name, columns: finalColumns });
        onClose();
    };

    return (
         <UIDialog open={isOpen} onOpenChange={onClose}>
            <UIDialogContent className="sm:max-w-2xl">
                <UIDialogHeader>
                    <UIDialogTitle>{config ? 'Edit' : 'Create'} Data Type</UIDialogTitle>
                     <UIDialogDescription>Define a new data schema by uploading a sample file.</UIDialogDescription>
                </UIDialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="data-type-name">Data Type Name</Label>
                        <Input id="data-type-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Credit Bureau Data" required />
                    </div>

                    <div>
                        <Label htmlFor="file-upload">Upload Sample File (.xlsx, .xls)</Label>
                        <Input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
                         <p className="text-xs text-muted-foreground mt-1">Upload a file to automatically detect columns.</p>
                    </div>

                    {columns.length > 0 && (
                        <div>
                            <Label>Configure Columns</Label>
                            <div className="space-y-4 mt-2 border p-4 rounded-md max-h-[50vh] overflow-y-auto">
                                {columns.map((col, index) => (
                                    <div key={col.id} className="space-y-2 p-2 rounded-md bg-muted/50">
                                        <div className="grid grid-cols-12 items-center gap-2">
                                            <Input
                                                className="col-span-5"
                                                value={col.name}
                                                onChange={e => handleColumnChange(index, 'name', e.target.value)}
                                                required
                                            />
                                            <Select value={col.type} onValueChange={(value: 'string' | 'number' | 'date') => handleColumnChange(index, 'type', value)}>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">Text</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="date">Date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                             <div className="col-span-4 flex items-center justify-end space-x-2">
                                                <Checkbox
                                                    id={`is-identifier-${col.id}`}
                                                    checked={col.isIdentifier}
                                                    onCheckedChange={(checked) => handleColumnChange(index, 'isIdentifier', !!checked)}
                                                />
                                                <Label htmlFor={`is-identifier-${col.id}`} className="text-sm text-muted-foreground whitespace-nowrap">Is Identifier?</Label>
                                            </div>
                                        </div>
                                         {col.type === 'string' && (
                                            <div className="space-y-1">
                                                <Label htmlFor={`options-${col.id}`} className="text-xs text-muted-foreground">Dropdown Options (optional)</Label>
                                                <Textarea
                                                    id={`options-${col.id}`}
                                                    placeholder="e.g., Male, Female, Other"
                                                    className="text-xs"
                                                    value={col.optionsString || ''}
                                                    onChange={e => handleColumnChange(index, 'optionsString', e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">Comma-separated values for dropdown select.</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <UIDialogFooter>
                        <UIDialogClose asChild><Button type="button" variant="outline">Cancel</Button></UIDialogClose>
                        <Button type="submit">Save</Button>
                    </UIDialogFooter>
                </form>
            </UIDialogContent>
        </UIDialog>
    )
}

function UploadDataViewerDialog({ upload, onClose }: {
    upload: DataProvisioningUpload | null;
    onClose: () => void;
}) {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const rowsPerPage = 100;

    useEffect(() => {
        if (upload && !upload.id.startsWith('temp-')) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch(`/api/settings/data-provisioning-uploads/view?uploadId=${upload.id}&page=${page}&limit=${rowsPerPage}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch uploaded data');
                    }
                    const result = await response.json();
                    setData(result.data);
                    setTotalPages(result.totalPages);
                    setTotalRows(result.totalRows);
                } catch (error) {
                    console.error(error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [upload, page]);

    if (!upload) return null;
    
    // Special handling for temporary filter preview
    if (upload.id.startsWith('temp-')) {
        const filterData = JSON.parse(upload.fileName); // Storing JSON in fileName for temp
        const headers = Object.keys(filterData);
        const maxRows = Math.max(0, ...Object.values(filterData).map((v: any) => v.split(',').length));
        const rows = Array.from({ length: maxRows }).map((_, rowIndex) => {
            return headers.map(header => {
                const values = filterData[header].split(',').map((s:string) => s.trim());
                return values[rowIndex] || '';
            });
        });

        return (
             <UIDialog open={!!upload} onOpenChange={onClose}>
                <UIDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <UIDialogHeader>
                        <UIDialogTitle>Viewing Eligibility Criteria</UIDialogTitle>
                        <UIDialogDescription>
                            This is the list of criteria generated from your uploaded file.
                        </UIDialogDescription>
                    </UIDialogHeader>
                    <div className="flex-grow overflow-auto border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {row.map((cell, cellIndex) => (
                                            <TableCell key={`${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <UIDialogFooter className="pt-4">
                        <UIDialogClose asChild><Button type="button">Close</Button></UIDialogClose>
                    </UIDialogFooter>
                </UIDialogContent>
            </UIDialog>
        );
    }


    const headers = data.length > 0 ? Object.keys(data[0]) : [];

    return (
        <UIDialog open={!!upload} onOpenChange={onClose}>
            <UIDialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <UIDialogHeader>
                    <UIDialogTitle>Viewing Upload: {upload.fileName}</UIDialogTitle>
                    <UIDialogDescription>
                        Displaying {data.length} of {totalRows} rows from the uploaded file.
                    </UIDialogDescription>
                </UIDialogHeader>
                <div className="flex-grow overflow-auto border rounded-md">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    {headers.map(header => <TableHead key={header} className="capitalize">{header.replace(/([A-Z])/g, ' $1')}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {headers.map(header => <TableCell key={`${rowIndex}-${header}`}>{row[header]}</TableCell>)}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                <UIDialogFooter className="justify-between items-center pt-4">
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                        </Button>
                        <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                            Next <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </UIDialogFooter>
            </UIDialogContent>
        </UIDialog>
    );
}
