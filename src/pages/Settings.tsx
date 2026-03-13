import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Download, MapPin, Package, Package2 } from 'lucide-react';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { KPICard } from '@/components/analytics/KPICard';
import { OrdersTimelineChart } from '@/components/analytics/OrdersTimelineChart';
import { PrintStatusPieChart } from '@/components/analytics/PrintStatusPieChart';
import { StatusStackedBarChart } from '@/components/analytics/StatusStackedBarChart';
import { DailyActivityChart } from '@/components/analytics/DailyActivityChart';
import { BundleBreakdownChart } from '@/components/analytics/BundleBreakdownChart';
import { PrinterPerformanceChart } from '@/components/analytics/PrinterPerformanceChart';
import { HourlyPrintRateChart } from '@/components/analytics/HourlyPrintRateChart';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { exportSummaryReport } from '@/lib/analyticsExport';
import { DateRange } from 'react-day-picker';
import { subDays, differenceInDays } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BundleLocationsTab } from '@/components/BundleLocationsTab';
import { KitDevicesTab } from '@/components/KitDevicesTab';
import { PackStationsTab } from '@/components/PackStationsTab';

interface ProcessResult {
  successful: string[];
  alreadyPrinted: string[];
  notFound: string[];
  errors: { uid: string; error: string }[];
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'config';
  
  const { settings, updateSettings, roles } = useAppStore();
  const isAdmin = roles.includes('admin');
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [defaultPrinterId, setDefaultPrinterId] = useState(settings.default_printer_id || '');
  const [loading, setLoading] = useState(false);
  const [appConfigId, setAppConfigId] = useState<string>('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [originalPrinterId, setOriginalPrinterId] = useState('');
  
  // Auto-archive settings (admin only)
  const [archiveDays, setArchiveDays] = useState<number>(10);
  const [archiveDaysSaving, setArchiveDaysSaving] = useState(false);
  
  // Administrative tools state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [previewUids, setPreviewUids] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  
  // Analytics state
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Upload management state
  const [recentUploads, setRecentUploads] = useState<Array<{
    created_at: string;
    count: number;
    user_id: string;
    show_date: string | null;
  }>>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [deletingUpload, setDeletingUpload] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadAppConfig();
    loadRecentUploads();
  }, []);

  const loadAppConfig = async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .in('key', ['printnode_api_key', 'archive_days']);

    if (error) {
      console.error('Failed to load app config:', error);
      return;
    }

    if (data) {
      const printnodeRow = data.find(r => r.key === 'printnode_api_key');
      if (printnodeRow) {
        const apiKey = printnodeRow.value || '';
        setPrintnodeApiKey(apiKey);
        setOriginalApiKey(apiKey);
        setAppConfigId(printnodeRow.id);
      }

      const archiveRow = data.find(r => r.key === 'archive_days');
      if (archiveRow?.value) {
        setArchiveDays(parseInt(archiveRow.value) || 10);
      }
    }
  };

  const handleSaveArchiveDays = async () => {
    if (archiveDays < 1) {
      toast.error('Archive days must be at least 1');
      return;
    }
    setArchiveDaysSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'archive_days', value: String(archiveDays) }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Auto-archive setting saved');
    } catch (error: any) {
      toast.error('Failed to save', { description: error.message });
    } finally {
      setArchiveDaysSaving(false);
    }
  };

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load settings:', error);
      return;
    }

    if (data) {
      updateSettings({
        default_printer_id: data.default_printer_id,
        auto_print: data.auto_print,
        block_cancelled: data.block_cancelled
      });
      const printerId = data.default_printer_id || '';
      setDefaultPrinterId(printerId);
      setOriginalPrinterId(printerId);
    }
  };

  const handleSaveSettings = async () => {
    // Check if critical fields are being cleared
    const isApiKeyCleared = originalApiKey && !printnodeApiKey.trim();
    const isPrinterIdCleared = originalPrinterId && !defaultPrinterId.trim();
    
    if (isApiKeyCleared || isPrinterIdCleared) {
      setShowClearConfirmation(true);
      return;
    }
    
    await savePrintnodeConfig();
  };

  const savePrintnodeConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      // Save app config (PrintNode API key)
      if (appConfigId) {
        const { error: configError } = await supabase
          .from('app_config')
          .update({ value: printnodeApiKey })
          .eq('id', appConfigId);

        if (configError) throw configError;
      } else {
        // Insert if doesn't exist
        const { error: configError } = await supabase
          .from('app_config')
          .upsert({ 
            key: 'printnode_api_key', 
            value: printnodeApiKey 
          }, {
            onConflict: 'key'
          });

        if (configError) throw configError;
      }

      // Save user settings (printer ID)
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          default_printer_id: defaultPrinterId,
          auto_print: settings.auto_print,
          block_cancelled: settings.block_cancelled
        }, {
          onConflict: 'user_id'
        });

      if (settingsError) throw settingsError;

      updateSettings({ 
        default_printer_id: defaultPrinterId 
      });
      
      // Update original values after successful save
      setOriginalApiKey(printnodeApiKey);
      setOriginalPrinterId(defaultPrinterId);
      
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error('Failed to save settings', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (key: keyof typeof settings, value: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          [key]: value,
          default_printer_id: defaultPrinterId,
          auto_print: settings.auto_print,
          block_cancelled: settings.block_cancelled
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      updateSettings({ [key]: value });
      toast.success('Setting updated');
    } catch (error: any) {
      toast.error('Failed to update setting', {
        description: error.message
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const filesArray = Array.from(files);
      setSelectedFiles(filesArray);
      setResults(null);
      
      // Parse files to extract preview UIDs
      try {
        const allUids: string[] = [];
        for (const file of filesArray) {
          const result = await parseCSVFile(file);
          allUids.push(...result.uids);
        }
        const uniqueUids = Array.from(new Set(allUids));
        setPreviewUids(uniqueUids.slice(0, 10));
        
        if (allUids.length === 0) {
          toast.error("No UIDs found in the selected files. Make sure they have a 'UID' or 'SKU' column. Check console for details.");
        } else {
          toast.success(`Found ${allUids.length} UIDs across ${filesArray.length} file(s)`);
        }
      } catch (error) {
        console.error('Failed to parse preview:', error);
        setPreviewUids([]);
      }
    }
  };

  const parseCSVFile = (file: File): Promise<{ uids: string[], fileName: string }> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          const uids: string[] = [];
          const data = results.data as any[];
          
          if (data.length > 0) {
            const headers = Object.keys(data[0]);
            console.log(`[${file.name}] Headers found:`, headers);
            
            const uidKey = headers.find(key => 
              key.trim().toLowerCase() === 'uid' || 
              key.trim().toLowerCase() === 'sku'
            );
            
            if (uidKey) {
              data.forEach((row) => {
                const uid = row[uidKey]?.toString().trim().toUpperCase();
                if (uid) {
                  uids.push(uid);
                }
              });
              console.log(`[${file.name}] Found ${uids.length} UIDs`);
            } else {
              console.warn(`[${file.name}] No UID/SKU column found. Available headers:`, headers);
            }
          }
          
          resolve({ uids, fileName: file.name });
        },
        error: () => {
          resolve({ uids: [], fileName: file.name });
        }
      });
    });
  };

  const processShippedOrders = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one CSV file');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    setProcessing(true);
    setResults(null);

    try {
      // Parse all CSV files and collect UIDs
      const allUids: string[] = [];
      for (const file of selectedFiles) {
        const result = await parseCSVFile(file);
        allUids.push(...result.uids);
      }

      // Remove duplicates
      const uniqueUids = Array.from(new Set(allUids));
      
      if (uniqueUids.length === 0) {
        toast.error('No valid UIDs found in CSV files. Check console for details.');
        setProcessing(false);
        return;
      }

      const result: ProcessResult = {
        successful: [],
        alreadyPrinted: [],
        notFound: [],
        errors: []
      };

      // Process in batches of 100 for better efficiency
      const batchSize = 100;
      for (let i = 0; i < uniqueUids.length; i += batchSize) {
        const batch = uniqueUids.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} UIDs`);
        
        try {
          // Fetch all shipments for this batch (NO user_id filter)
          const { data: matches, error: fetchError } = await supabase
            .from('shipments')
            .select('id, uid, printed')
            .in('uid', batch);

          if (fetchError) {
            console.error('Batch fetch error:', fetchError);
            batch.forEach(uid => result.errors.push({ uid, error: fetchError.message }));
            continue;
          }

          console.log(`Found ${matches?.length || 0} shipments matching ${batch.length} UIDs`);

          // Build map of shipments by UID
          const byUid = new Map<string, Array<{ id: string; uid: string; printed: boolean | null }>>();
          (matches || []).forEach(shipment => {
            if (!byUid.has(shipment.uid)) {
              byUid.set(shipment.uid, []);
            }
            byUid.get(shipment.uid)!.push(shipment);
          });

          // Collect IDs to update
          const idsToUpdate: string[] = [];
          const uidsToMark: string[] = [];

          batch.forEach(uid => {
            const rows = byUid.get(uid) || [];
            
            if (rows.length === 0) {
              result.notFound.push(uid);
              return;
            }

            // Filter to rows that need updating (not already printed)
            const toUpdate = rows.filter(r => !r.printed);
            
            if (toUpdate.length > 0) {
              idsToUpdate.push(...toUpdate.map(r => r.id));
              uidsToMark.push(uid);
            } else {
              result.alreadyPrinted.push(uid);
            }
          });

          // Update all rows in one call
          if (idsToUpdate.length > 0) {
            console.log(`Updating ${idsToUpdate.length} shipments for ${uidsToMark.length} UIDs`);
            
            const { data: updatedRows, error: updateError } = await supabase
              .from('shipments')
              .update({
                printed: true,
                printed_at: new Date().toISOString(),
                printed_by_user_id: user.id
              })
              .in('id', idsToUpdate)
              .eq('printed', false)  // Concurrency safety
              .select('id, uid');

            if (updateError) {
              console.error('Batch update error:', updateError);
              uidsToMark.forEach(uid => result.errors.push({ uid, error: updateError.message }));
            } else if (updatedRows) {
              const updatedUids = Array.from(new Set(updatedRows.map(r => r.uid)));
              console.log(`Successfully updated ${updatedRows.length} shipments (${updatedUids.length} unique UIDs)`);
              result.successful.push(...updatedUids);
            }
          }
        } catch (error: any) {
          console.error('Batch processing error:', error);
          batch.forEach(uid => result.errors.push({ uid, error: error.message }));
        }
      }

      setResults(result);
      setShowResultsDialog(true);
      
      const updated = result.successful.length;
      const already = result.alreadyPrinted.length;
      const notFoundCount = result.notFound.length;
      const errorsCount = result.errors.length;
      
      // Show detailed toast with counts and action
      toast.info(`${updated} updated • ${already} already printed • ${notFoundCount} not found • ${errorsCount} errors`, {
        action: {
          label: 'View results',
          onClick: () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        duration: 5000
      });
    } catch (error: any) {
      toast.error('Failed to process orders', {
        description: error.message
      });
    } finally {
      setProcessing(false);
      // Scroll to results section
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const downloadResults = () => {
    if (!results) return;

    const csvRows: string[] = ['UID,Status,Details'];
    
    results.successful.forEach(uid => {
      csvRows.push(`${uid},Marked as Printed,Successfully updated`);
    });
    
    results.alreadyPrinted.forEach(uid => {
      csvRows.push(`${uid},Already Printed,Skipped - already marked as printed`);
    });
    
    results.notFound.forEach(uid => {
      csvRows.push(`${uid},Not Found,UID not found in database`);
    });
    
    results.errors.forEach(({ uid, error }) => {
      csvRows.push(`${uid},Error,"${error}"`);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mark-shipped-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearResults = () => {
    setResults(null);
    setSelectedFiles([]);
    setPreviewUids([]);
  };

  const handleDateRangeChange = (newRange: DateRange | undefined) => {
    if (!newRange?.from || !newRange?.to) {
      setDateRange(newRange || { from: subDays(new Date(), 30), to: new Date() });
      return;
    }

    const daysDiff = differenceInDays(newRange.to, newRange.from);
    
    if (daysDiff > 90) {
      toast.error('Date range too large', {
        description: 'Please select a date range of 90 days or less for optimal performance.',
      });
      return;
    }

    setDateRange(newRange);
  };

  const { isLoading, kpis, dailyData, printerData, printStatusData, hourlyData } = useAnalyticsData(dateRange);

  const handleExport = () => {
    exportSummaryReport(kpis, dateRange);
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const loadRecentUploads = async () => {
    setLoadingUploads(true);
    try {
      // Get distinct upload batches (grouped by created_at timestamp)
      const { data, error } = await supabase
        .from('shipments')
        .select('created_at, user_id, show_date')
        .order('created_at', { ascending: false })
        .limit(1000); // Get recent records to group

      if (error) throw error;

      // Group by created_at timestamp (uploads are batched with same timestamp)
      const uploadMap = new Map<string, { created_at: string; count: number; user_id: string; show_date: string | null }>();
      
      data?.forEach(shipment => {
        const timestamp = shipment.created_at;
        if (uploadMap.has(timestamp)) {
          uploadMap.get(timestamp)!.count++;
        } else {
          uploadMap.set(timestamp, {
            created_at: timestamp,
            count: 1,
            user_id: shipment.user_id || 'unknown',
            show_date: shipment.show_date
          });
        }
      });

      // Convert to array and sort by date (newest first)
      const uploads = Array.from(uploadMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20); // Show last 20 uploads

      setRecentUploads(uploads);
    } catch (error: any) {
      console.error('Failed to load recent uploads:', error);
      toast.error('Failed to load recent uploads');
    } finally {
      setLoadingUploads(false);
    }
  };

  const handleDeleteUpload = async (createdAt: string, count: number) => {
    if (!confirm(`Are you sure you want to delete this upload batch of ${count} shipments? This action cannot be undone.`)) {
      return;
    }

    setDeletingUpload(createdAt);
    try {
      // First delete related print jobs
      const { data: shipmentIds } = await supabase
        .from('shipments')
        .select('id')
        .eq('created_at', createdAt);

      if (shipmentIds && shipmentIds.length > 0) {
        await supabase
          .from('print_jobs')
          .delete()
          .in('shipment_id', shipmentIds.map(s => s.id));
      }

      // Then delete the shipments
      const { error } = await supabase
        .from('shipments')
        .delete()
        .eq('created_at', createdAt);

      if (error) throw error;

      toast.success('Upload deleted successfully', {
        description: `Removed ${count} shipments and their print jobs`
      });

      // Reload the uploads list
      loadRecentUploads();
    } catch (error: any) {
      toast.error('Failed to delete upload', {
        description: error.message
      });
    } finally {
      setDeletingUpload(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure application settings and view analytics</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="pack-stations" className="flex items-center gap-1">
            <Package2 className="h-4 w-4" />
            Pack Stations
          </TabsTrigger>
          <TabsTrigger value="kit-devices" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            Kit Devices
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>PrintNode Configuration</CardTitle>
          <CardDescription>Configure PrintNode API key (shared across all users) and your default printer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">PrintNode API Key (App-wide)</Label>
            <Input
              id="api-key"
              type="password"
              value={printnodeApiKey}
              onChange={(e) => setPrintnodeApiKey(e.target.value)}
              placeholder="Enter PrintNode API key"
              className={originalApiKey && !printnodeApiKey.trim() ? 'border-destructive' : ''}
            />
            {originalApiKey && !printnodeApiKey.trim() && (
              <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-4 w-4" />
                Warning: Clearing this will affect all users
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-id">Default Printer ID</Label>
            <Input
              id="printer-id"
              type="number"
              value={defaultPrinterId}
              onChange={(e) => setDefaultPrinterId(e.target.value)}
              placeholder="Enter PrintNode printer ID"
              className={originalPrinterId && !defaultPrinterId.trim() ? 'border-destructive' : ''}
            />
            {originalPrinterId && !defaultPrinterId.trim() && (
              <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-4 w-4" />
                Warning: Clearing this will remove your default printer
              </p>
            )}
          </div>

          <Button onClick={handleSaveSettings} disabled={loading}>
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scanning Options</CardTitle>
          <CardDescription>Configure how the app handles scanned UIDs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-print on scan</Label>
              <p className="text-sm text-muted-foreground">
                Automatically print labels when a UID is scanned
              </p>
            </div>
            <Switch
              checked={settings.auto_print}
              onCheckedChange={(checked) => handleUpdateSetting('auto_print', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Block cancelled orders</Label>
              <p className="text-sm text-muted-foreground">
                Prevent printing labels for cancelled or failed orders
              </p>
            </div>
            <Switch
              checked={settings.block_cancelled}
              onCheckedChange={(checked) => handleUpdateSetting('block_cancelled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrative Tools</CardTitle>
          <CardDescription>Mark manually shipped orders as printed in the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-files">Upload CSV Files</Label>
              <p className="text-sm text-muted-foreground">
                Select one or more CSV files containing a UID column. Orders matching these UIDs will be marked as printed.
              </p>
              <Input
                id="csv-files"
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileChange}
                disabled={processing}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {selectedFiles.map((file, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>•</span>
                        <span>{file.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {previewUids.length > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        Preview UIDs (first 10 of {previewUids.length} shown)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {previewUids.map((uid, idx) => (
                        <span key={idx} className="px-2 py-1 text-xs font-mono bg-background border rounded">
                          {uid}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check browser console for detailed parsing info per file
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={processShippedOrders} 
              disabled={processing || selectedFiles.length === 0}
              className="w-full"
            >
              {processing ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Process and Mark as Printed
                </>
              )}
            </Button>
          </div>

          {results && (
            <div ref={resultsRef} className="space-y-4 border-t pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold">Results Summary</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Marked as Printed</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{results.successful.length}</p>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">Already Printed</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{results.alreadyPrinted.length}</p>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="font-medium">Not Found</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{results.notFound.length}</p>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="font-medium">Errors</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{results.errors.length}</p>
                  </div>
                </div>
              </div>

              {(results.notFound.length > 0 || results.errors.length > 0) && (
                <div className="space-y-2">
                  <Label>Details</Label>
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">UID</th>
                          <th className="text-left p-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.notFound.map((uid, idx) => (
                          <tr key={`nf-${idx}`} className="border-t">
                            <td className="p-2">{uid}</td>
                            <td className="p-2 text-yellow-600">Not Found</td>
                          </tr>
                        ))}
                        {results.errors.map(({ uid, error }, idx) => (
                          <tr key={`err-${idx}`} className="border-t">
                            <td className="p-2">{uid}</td>
                            <td className="p-2 text-red-600">{error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={downloadResults} variant="outline" className="flex-1">
                  Download Results
                </Button>
                <Button onClick={clearResults} variant="outline" className="flex-1">
                  Clear Results
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Management</CardTitle>
          <CardDescription>View and remove recent shipment uploads to fix conflicts or errors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingUploads ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading recent uploads...
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent uploads found
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium">Upload Date & Time</th>
                      <th className="text-left p-3 font-medium">Show Date</th>
                      <th className="text-center p-3 font-medium">Shipments</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUploads.map((upload, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {new Date(upload.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {upload.created_at}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          {upload.show_date ? (
                            <span className="font-medium">
                              {new Date(upload.show_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">No show date</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                            {upload.count}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUpload(upload.created_at, upload.count)}
                            disabled={deletingUpload === upload.created_at}
                          >
                            {deletingUpload === upload.created_at ? (
                              'Deleting...'
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Delete
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Warning: Deletion is permanent</p>
                  <p className="text-xs">Deleting an upload will remove all shipments from that batch and their associated print jobs. This action cannot be undone.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Modal */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Processing Results</DialogTitle>
          </DialogHeader>
          
          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Marked as Printed</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{results.successful.length}</p>
                </div>

                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium">Already Printed</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{results.alreadyPrinted.length}</p>
                </div>

                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">Not Found</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{results.notFound.length}</p>
                </div>

                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">Errors</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{results.errors.length}</p>
                </div>
              </div>

              {(results.notFound.length > 0 || results.errors.length > 0) && (
                <div className="space-y-2">
                  <Label>Details</Label>
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="text-left p-2 font-medium">UID</th>
                          <th className="text-left p-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.notFound.map((uid, idx) => (
                          <tr key={`nf-${idx}`} className="border-t">
                            <td className="p-2">{uid}</td>
                            <td className="p-2 text-yellow-600">Not Found</td>
                          </tr>
                        ))}
                        {results.errors.map(({ uid, error }, idx) => (
                          <tr key={`err-${idx}`} className="border-t">
                            <td className="p-2">{uid}</td>
                            <td className="p-2 text-red-600">{error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button onClick={downloadResults} variant="outline">
              Download Results
            </Button>
            <Button onClick={() => setShowResultsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="locations">
          <BundleLocationsTab />
        </TabsContent>

        <TabsContent value="pack-stations">
          <PackStationsTab />
        </TabsContent>

        <TabsContent value="kit-devices">
          <KitDevicesTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Analytics & Reports</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  Export Summary Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DateRangeFilter dateRange={dateRange} setDateRange={handleDateRangeChange} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-2">
                      <div className="h-4 bg-muted rounded w-24" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-8 bg-muted rounded w-16" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <KPICard
                  title="Total Orders"
                  value={kpis.totalOrders}
                  description={`${kpis.printedPercentage}% printed`}
                />
                <KPICard
                  title="Print Success Rate"
                  value={`${kpis.printSuccessRate}%`}
                  description={`${kpis.successfulPrints} of ${kpis.totalPrintJobs} jobs`}
                />
                <KPICard
                  title="Bundle Orders"
                  value={kpis.bundleOrders}
                  description={`${kpis.bundlePercentage}% of total`}
                />
                <KPICard
                  title="Cancelled Orders"
                  value={kpis.cancelledOrders}
                  description={`${kpis.cancelledPercentage}% of total`}
                />
              </>
          )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Hourly Print Rate</CardTitle>
              <CardDescription>Labels printed by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <HourlyPrintRateChart hourlyData={hourlyData} />
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-6">
              <p className="text-muted-foreground text-center">Loading charts...</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-48 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Orders Over Time</CardTitle>
                    <CardDescription>Daily order volume and print status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OrdersTimelineChart dailyData={dailyData} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Print Job Status</CardTitle>
                    <CardDescription>Distribution of print job outcomes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PrintStatusPieChart printStatusData={printStatusData} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Orders by Status</CardTitle>
                    <CardDescription>Daily breakdown of order status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StatusStackedBarChart dailyData={dailyData} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Print Activity</CardTitle>
                    <CardDescription>Number of labels printed per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DailyActivityChart dailyData={dailyData} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Bundle Distribution</CardTitle>
                    <CardDescription>Bundled vs non-bundled orders</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BundleBreakdownChart dailyData={dailyData} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Printer Performance</CardTitle>
                    <CardDescription>Top printers by volume</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PrinterPerformanceChart printerData={printerData} />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Clear Configuration Confirmation Dialog */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Clearing Configuration</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to clear critical PrintNode configuration:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {originalApiKey && !printnodeApiKey.trim() && (
                  <li className="text-destructive font-medium">PrintNode API Key (affects all users)</li>
                )}
                {originalPrinterId && !defaultPrinterId.trim() && (
                  <li className="text-destructive font-medium">Default Printer ID</li>
                )}
              </ul>
              <p className="mt-3">This action will save empty values. Are you sure you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowClearConfirmation(false);
                savePrintnodeConfig();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Clear Configuration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
