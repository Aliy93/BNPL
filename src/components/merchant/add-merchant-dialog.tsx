'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Merchant {
    id: string;
    name: string;
    businessType: string;
    contactInfo: string;
    bankAccount: string;
    status: 'Active' | 'Pending' | 'Inactive';
}

interface AddMerchantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (merchant: Partial<Merchant>) => void;
  merchant: Merchant | null;
}

export function AddMerchantDialog({ isOpen, onClose, onSave, merchant }: AddMerchantDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    businessType: '',
    contactInfo: '',
    bankAccount: '',
    status: 'Pending' as 'Active' | 'Pending' | 'Inactive',
  });

  useEffect(() => {
    if (merchant) {
      setFormData(merchant);
    } else {
      setFormData({
        name: '',
        businessType: '',
        contactInfo: '',
        bankAccount: '',
        status: 'Pending',
      });
    }
  }, [merchant, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: 'status') => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{merchant ? 'Edit Merchant' : 'Add New Merchant'}</DialogTitle>
          <DialogDescription>
            {merchant ? 'Update the details of the existing merchant.' : 'Onboard a new merchant to the platform.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={formData.name} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="businessType" className="text-right">Business Type</Label>
            <Input id="businessType" value={formData.businessType} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="contactInfo" className="text-right">Contact</Label>
            <Input id="contactInfo" value={formData.contactInfo} onChange={handleChange} className="col-span-3" required />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bankAccount" className="text-right">Bank Account</Label>
            <Input id="bankAccount" value={formData.bankAccount} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">Status</Label>
            <Select onValueChange={handleSelectChange('status')} value={formData.status}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">
              {merchant ? 'Save Changes' : 'Add Merchant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
