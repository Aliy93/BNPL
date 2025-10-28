

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, File as FileIcon, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoanProvider, type LoanReportData, type CollectionsReportData, type IncomeReportData, ProviderReportData } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { DateRange } from 'react-day-picker';


const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};


const TIMEFRAMES = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'This Week' },
    { value: 'monthly', label: 'This Month' },
    { value: 'yearly', label: 'This Year' },
    { value: 'overall', label: 'Overall' },
];

export function ReportsClient({ providers }: { providers: LoanProvider[] }) {
    const { toast } = useToast();
    const { currentUser, isLoading: isAuthLoading } = useAuth();

    const [timeframe, setTimeframe] = useState('overall');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [providerId, setProviderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('providerReport');
    
    const [loansData, setLoansData] = useState<LoanReportData[]>([]);
    const [collectionsData, setCollectionsData] = useState<CollectionsReportData[]>([]);
    const [incomeData, setIncomeData] = useState<IncomeReportData[]>([]);
    const [providerSummaryData, setProviderSummaryData] = useState<Record<string, ProviderReportData>>({});
    
    const isSuperAdminOrRecon = currentUser?.role === 'Super Admin' || currentUser?.role === 'Reconciliation';


    const fetchAllReportData = useCallback(async (currentProviderId: string, currentTimeframe: string, currentDateRange?: DateRange) => {
        setIsLoading(true);
        try {
            const fetchDataForTab = async (url: string) => {
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch data.`);
                }
                return response.json();
            };

            const buildUrl = (baseUrl: string) => {
                const params = new URLSearchParams({
                    providerId: currentProviderId,
                    timeframe: currentTimeframe,
                });
                if (currentDateRange?.from) {
                    params.set('from', currentDateRange.from.toISOString());
                }
                if (currentDateRange?.to) {
                    params.set('to', currentDateRange.to.toISOString());
                }
                return `${baseUrl}?${params.toString()}`;
            }

            const loansPromise = fetchDataForTab(buildUrl('/api/reports/loans'));
            const collectionsPromise = fetchDataForTab(buildUrl('/api/reports/collections'));
            const incomePromise = fetchDataForTab(buildUrl('/api/reports/income'));
            
            const summaryProviders = (currentProviderId === 'all' && providers.length > 1 && isSuperAdminOrRecon) 
              ? providers 
              : [providers.find(p => p.id === currentProviderId)!].filter(Boolean);

            const summaryPromises = summaryProviders
                .map(p => 
                    fetchDataForTab(buildUrl(`/api/reports/provider-summary`).replace(`providerId=${currentProviderId}`, `providerId=${p.id}`))
                        .then(data => ({ [p.id]: data }))
                        .catch(err => {
                            console.error(`Failed to fetch summary for provider ${p.id}:`, err.message);
                            return { [p.id]: null }; // Return null on error for this provider
                        })
                );
            
            const [loans, collections, income, ...summaryResults] = await Promise.all([
                loansPromise,
                collectionsPromise,
                incomePromise,
                ...summaryPromises
            ]);

            setLoansData(loans);
            setCollectionsData(collections);
            setIncomeData(income);
            
            const newSummaryData = summaryResults.reduce((acc, current) => ({ ...acc, ...current }), {});
            setProviderSummaryData(newSummaryData);

        } catch (error: any) {
            toast({ title: "Error fetching report data", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, providers, isSuperAdminOrRecon]);
    
    // Effect to set the initial providerId and fetch data ONCE
    useEffect(() => {
        if (isAuthLoading) return; // Wait for user data to be available

        let initialProviderId: string | null = null;
        if (isSuperAdminOrRecon) {
            initialProviderId = 'all';
        } else if (currentUser?.providerId) {
            initialProviderId = currentUser.providerId;
        } else if (providers.length > 0) {
            // This case might be for other roles that see reports but aren't super admin
            initialProviderId = 'all';
        } else {
            initialProviderId = 'none'; // No providers available
        }
        
        setProviderId(initialProviderId);

        if (initialProviderId && initialProviderId !== 'none') {
            fetchAllReportData(initialProviderId, 'overall', undefined);
        } else {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthLoading, currentUser?.providerId, isSuperAdminOrRecon]);
    
    // Effect to refetch data when filters change, but not on initial load
    useEffect(() => {
        // This check prevents refetching on the initial render where providerId is still null
        if (providerId !== null) { 
            fetchAllReportData(providerId, timeframe, dateRange);
        }
    }, [providerId, timeframe, dateRange, fetchAllReportData]);

    
    const handleExcelExport = () => {
        const wb = XLSX.utils.book_new();
        const providerList = (providerId === 'all' ? providers : [providers.find(p => p.id === providerId)!]).filter(Boolean);

        // 1. Provider Loans
        if (loansData.length > 0) {
            const providerLoanData = loansData.map(d => ({
                'Provider': d.provider,
                'Loan ID': d.loanId,
                'Borrower': d.borrowerName,
                'Principal Disbursed': d.principalDisbursed,
                'Principal Outstanding': d.principalOutstanding,
                'Interest (Daily Fee) Outstanding': d.interestOutstanding,
                'Service Fee Outstanding': d.serviceFeeOutstanding,
                'Penalty Outstanding': d.penaltyOutstanding,
                'Total Outstanding': d.totalOutstanding,
                'Status': d.status,
            }));
            const wsProvider = XLSX.utils.json_to_sheet(providerLoanData);
            XLSX.utils.book_append_sheet(wb, wsProvider, "Provider Loans");
        }

        // 2. Collections
        if (collectionsData.length > 0) {
            const collectionsExportData = collectionsData.map(d => ({
                'Provider': d.provider,
                'Date': format(new Date(d.date), 'yyyy-MM-dd'),
                'Principal Received': d.principal,
                'Interest Received': d.interest,
                'Service Fee Received': d.serviceFee,
                'Penalty Received': d.penalty,
                'Tax Received': d.tax,
                'Total Collected': d.total,
            }));
            const ws = XLSX.utils.json_to_sheet(collectionsExportData);
            XLSX.utils.book_append_sheet(wb, ws, "Collections");
        }
        
        // 3. Income
        if (incomeData.length > 0) {
            const incomeExportData = incomeData.map(d => ({
                'Provider': d.provider,
                'Accrued Interest': d.accruedInterest,
                'Collected Interest': d.collectedInterest,
                'Accrued Service Fee': d.accruedServiceFee,
                'Collected Service Fee': d.collectedServiceFee,
                'Accrued Penalty': d.accruedPenalty,
                'Collected Penalty': d.collectedPenalty,
                'Total Accrued': d.accruedInterest + d.accruedServiceFee + d.accruedPenalty,
                'Total Collected': d.collectedInterest + d.collectedServiceFee + d.collectedPenalty,
            }));
            const ws = XLSX.utils.json_to_sheet(incomeExportData);
            XLSX.utils.book_append_sheet(wb, ws, "Income");
        }
        
        // 4. Fund Utilization
        const utilizationExportData = providerList.map(p => {
            const data = providerSummaryData[p.id];
            if (!data) return null;
            const availableFund = p.initialBalance - data.portfolioSummary.outstanding;
            return {
                'Provider': p.name,
                'Provider Fund': p.initialBalance,
                'Loans Disbursed': data.portfolioSummary.disbursed,
                'Outstanding Principal': data.portfolioSummary.outstanding,
                'Available Fund': availableFund,
                'Utilization %': data.fundUtilization,
            };
        }).filter(Boolean);
        if (utilizationExportData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(utilizationExportData as any[]);
            XLSX.utils.book_append_sheet(wb, ws, "Fund Utilization");
        }
        
        // 5. Aging Report
        const agingExportData = providerList.map(p => {
            const data = providerSummaryData[p.id];
            if (!data) return null;
            const aging = data.agingReport;
            return {
                'Provider': p.name,
                '0-30 Days': aging.buckets['1-30'],
                '31-60 Days': aging.buckets['31-60'],
                '61-90 Days': aging.buckets['61-90'],
                '90+ Days': aging.buckets['91+'],
                'Total Overdue': aging.totalOverdue,
            };
        }).filter(Boolean);
        if (agingExportData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(agingExportData as any[]);
            XLSX.utils.book_append_sheet(wb, ws, "Aging Report");
        }
        
        // 6. Borrower Performance
        if (loansData.length > 0) {
            const borrowerPerfData = loansData.map(d => ({
                 'Borrower ID': d.borrowerId,
                 'Borrower Name': d.borrowerName,
                 'Loan ID': d.loanId,
                 'Principal Disbursed': d.principalDisbursed,
                 'Principal Outstanding': d.principalOutstanding,
                 'Interest Outstanding': d.interestOutstanding,
                 'Service Fee Outstanding': d.serviceFeeOutstanding,
                 'Penalty Outstanding': d.penaltyOutstanding,
                 'Days in Arrears': d.daysInArrears,
                 'Status': d.status,
            }));
            const wsBorrower = XLSX.utils.json_to_sheet(borrowerPerfData);
            XLSX.utils.book_append_sheet(wb, wsBorrower, "Borrower Performance");
        }

        if (wb.SheetNames.length === 0) {
            toast({ description: "No data available to export.", variant: "destructive" });
            return;
        }

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: "application/octet-stream" }), `LoanFlow_Report_${timeframe}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
    
    if (isLoading || isAuthLoading || providerId === null) {
        return (
             <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                    <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                </div>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        )
    }

    if (providerId === 'none') {
         return (
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Access Restricted</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">You are not currently associated with a loan provider. Please contact an administrator to get access to reports.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
                <div className="flex items-center space-x-2">
                    <Select onValueChange={(value) => { setTimeframe(value); setDateRange(undefined); }} value={timeframe}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEFRAMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[300px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                </>
                                ) : (
                                format(dateRange.from, "LLL dd, y")
                                )
                            ) : (
                                <span>Pick a date</span>
                            )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={(range) => { setDateRange(range); if (range?.from) setTimeframe('custom'); }}
                            numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                     {isSuperAdminOrRecon && (
                        <Select onValueChange={setProviderId} value={providerId || ''}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select Provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Providers</SelectItem>
                                {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                     )}
                    <Button variant="outline" onClick={handleExcelExport}><Download className="mr-2 h-4 w-4"/>Excel</Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="providerReport">Provider Loans</TabsTrigger>
                    <TabsTrigger value="collectionsReport">Collections</TabsTrigger>
                    <TabsTrigger value="incomeReport">Income</TabsTrigger>
                    <TabsTrigger value="utilizationReport">Fund Utilization</TabsTrigger>
                    <TabsTrigger value="agingReport">Aging</TabsTrigger>
                    <TabsTrigger value="borrowerReport">Borrower Performance</TabsTrigger>
                </TabsList>
                <div className="overflow-auto rounded-md border h-[60vh]">
                    <TabsContent value="providerReport" className="space-y-4 m-0">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Loan ID</TableHead>
                                    <TableHead>Borrower</TableHead>
                                    <TableHead className="text-right">Principal Disbursed</TableHead>
                                    <TableHead className="text-right">Principal Outstanding</TableHead>
                                    <TableHead className="text-right">Interest Outstanding</TableHead>
                                    <TableHead className="text-right">Service Fee Outstanding</TableHead>
                                    <TableHead className="text-right">Penalty Outstanding</TableHead>
                                    <TableHead className="text-right">Total Outstanding</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                        </TableCell>
                                    </TableRow>
                                ) : loansData.length > 0 ? (
                                    loansData.map((row) => (
                                        <TableRow key={row.loanId}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell>{row.loanId.slice(-8)}</TableCell>
                                            <TableCell>{row.borrowerName}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalDisbursed)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interestOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFeeOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penaltyOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(row.totalOutstanding)}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    row.status === 'Overdue' || row.status === 'Defaulted' ? 'destructive' :
                                                    row.status === 'Paid' ? 'default' : 'secondary'
                                                }
                                                className={cn(row.status === 'Paid' && 'bg-green-600 text-white')}
                                                >
                                                    {row.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            No results found for the selected filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="collectionsReport">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Principal Received</TableHead>
                                    <TableHead className="text-right">Interest Received</TableHead>
                                    <TableHead className="text-right">Service Fee Received</TableHead>
                                    <TableHead className="text-right">Penalty Received</TableHead>
                                    <TableHead className="text-right">Tax Received</TableHead>
                                    <TableHead className="text-right font-bold">Total Collected</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : collectionsData.length > 0 ? (
                                    collectionsData.map((row) => (
                                        <TableRow key={`${row.provider}-${row.date}`}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell>{format(new Date(row.date), 'yyyy-MM-dd')}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principal)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penalty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.tax)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(row.total)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="incomeReport">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">Accrued Interest</TableHead>
                                    <TableHead className="text-right">Collected Interest</TableHead>
                                    <TableHead className="text-right">Accrued Service Fee</TableHead>
                                    <TableHead className="text-right">Collected Service Fee</TableHead>
                                    <TableHead className="text-right">Accrued Penalty</TableHead>
                                    <TableHead className="text-right">Collected Penalty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : incomeData.length > 0 ? (
                                    incomeData.map((row) => (
                                        <TableRow key={row.provider}>
                                            <TableCell>{row.provider}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.accruedInterest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.collectedInterest)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.accruedServiceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.collectedServiceFee)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.accruedPenalty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.collectedPenalty)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="utilizationReport">
                        <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">Provider Fund</TableHead>
                                    <TableHead className="text-right">Loans Disbursed</TableHead>
                                    <TableHead className="text-right">Available Fund</TableHead>
                                    <TableHead className="text-right">Utilization %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : providers.filter(p => providerId === 'all' || p.id === providerId).length > 0 ? (
                                    providers.filter(p => providerId === 'all' || p.id === providerId).map(provider => {
                                        const data = providerSummaryData[provider.id];
                                        if (!data) return <TableRow key={provider.id}><TableCell colSpan={5} className="text-center h-12">No data for {provider.name}</TableCell></TableRow>;
                                        const availableFund = provider.initialBalance - data.portfolioSummary.outstanding;
                                        return (
                                        <TableRow key={provider.id}>
                                            <TableCell>{provider.name}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(provider.initialBalance)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(data?.portfolioSummary.disbursed || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(availableFund)}</TableCell>
                                            <TableCell className="text-right font-mono">{data?.fundUtilization.toFixed(2) || '0.00'}%</TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="agingReport">
                        <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Provider</TableHead>
                                    <TableHead className="text-right">0-30 Days</TableHead>
                                    <TableHead className="text-right">31-60 Days</TableHead>
                                    <TableHead className="text-right">61-90 Days</TableHead>
                                    <TableHead className="text-right">90+ Days</TableHead>
                                    <TableHead className="text-right">Total Overdue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : providers.filter(p => providerId === 'all' || p.id === providerId).length > 0 ? (
                                    providers.filter(p => providerId === 'all' || p.id === providerId).map(provider => {
                                        const data = providerSummaryData[provider.id];
                                        if (!data) return <TableRow key={provider.id}><TableCell colSpan={6} className="text-center h-12">No data for {provider.name}</TableCell></TableRow>;
                                        const aging = data?.agingReport;
                                        return (
                                        <TableRow key={provider.id}>
                                            <TableCell>{provider.name}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets['1-30'] || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets['31-60'] || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets['61-90'] || 0}</TableCell>
                                            <TableCell className="text-right font-mono">{aging?.buckets['91+'] || 0}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{aging?.totalOverdue || 0}</TableCell>
                                        </TableRow>
                                    )})
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="borrowerReport">
                        <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                <TableRow>
                                    <TableHead>Borrower ID</TableHead>
                                    <TableHead>Borrower Name</TableHead>
                                    <TableHead>Loan ID</TableHead>
                                    <TableHead className="text-right">Principal Disbursed</TableHead>
                                    <TableHead className="text-right">Principal Outstanding</TableHead>
                                    <TableHead className="text-right">Interest Outstanding</TableHead>
                                    <TableHead className="text-right">Service Fee Outstanding</TableHead>
                                    <TableHead className="text-right">Penalty Outstanding</TableHead>
                                    <TableHead className="text-right">Days in Arrears</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                                <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : loansData.length > 0 ? (
                                    loansData.map((row) => (
                                        <TableRow key={row.loanId}>
                                            <TableCell>{row.borrowerId.slice(-8)}</TableCell>
                                            <TableCell>{row.borrowerName}</TableCell>
                                            <TableCell>{row.loanId.slice(-8)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalDisbursed)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.principalOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.interestOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.serviceFeeOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.penaltyOutstanding)}</TableCell>
                                            <TableCell className="text-right font-mono">{row.daysInArrears}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    row.status === 'Overdue' || row.status === 'Defaulted' ? 'destructive' :
                                                    row.status === 'Paid' ? 'default' : 'secondary'
                                                }
                                                className={cn(row.status === 'Paid' && 'bg-green-600 text-white')}
                                                >
                                                    {row.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">No results found.</TableCell>
                                    </TableRow>
                                )}
                                </TableBody>
                        </Table>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
