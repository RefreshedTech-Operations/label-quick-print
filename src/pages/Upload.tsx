import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload as UploadIcon, FileSpreadsheet, CalendarIcon } from 'lucide-react';
import { parseFile, normalizeShipmentData, parseCSVString } from '@/lib/csv';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// Extend window for automation API
declare global {
  interface Window {
    __uploadCSV?: (csvString: string, options?: {
      showDate?: string;       // ISO date string e.g. "2025-03-05"
      channel?: string;        // "regular" | "misfits" | "outlet"
      isLabelOnly?: boolean;
      autoSubmit?: boolean;    // default true - auto-trigger upload
    }) => Promise<{ success: boolean; message: string; count?: number }>;
    // Chunked upload helpers for automation tools with character limits
    __csvBuffer?: string;
    __appendCSV?: (chunk: string) => { success: boolean; bufferLength: number };
    __submitCSV?: (options?: {
      showDate?: string;
      channel?: string;
      isLabelOnly?: boolean;
    }) => Promise<{ success: boolean; message: string; count?: number }>;
    __clearCSV?: () => void;
  }
}

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [showDate, setShowDate] = useState<Date>();
  const [channel, setChannel] = useState<string>('regular');
  const [isLabelOnly, setIsLabelOnly] = useState(false);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  
  const { columnMap, settings } = useAppStore();
  const navigate = useNavigate();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isValidFormat = fileName.endsWith('.csv') || 
                          fileName.endsWith('.xlsx') || 
                          fileName.endsWith('.xls');
    
    if (!isValidFormat) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(selectedFile);
    setParsedData(null);

    try {
      const data = await parseFile(selectedFile);
      setPreview(data.slice(0, 5));
      const fileType = fileName.endsWith('.csv') ? 'CSV' : 'Excel';
      toast.success(`Loaded ${data.length} rows from ${fileType} file`);
    } catch (error: any) {
      toast.error('Failed to parse file', {
        description: error.message
      });
    }
  };

  // Core upload logic extracted so it can be used by both UI and automation API
  const processAndUpload = useCallback(async (
    data: any[],
    uploadShowDate: Date,
    uploadChannel: string,
    uploadIsLabelOnly: boolean,
    currentColumnMap: typeof columnMap
  ): Promise<{ success: boolean; message: string; count?: number }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Not authenticated' };
    }

    console.log('Total rows:', data.length);
    
    const shipments = data
      .map(row => normalizeShipmentData(row, currentColumnMap))
      .filter(s => !s.cancelled || s.cancelled.trim() === '')
      .filter(s => s.order_id && s.order_id.trim() !== '');
    
    console.log('After cancelled and empty order_id filter:', shipments.length);

    // Group shipments by tracking number
    const groupedByTracking = new Map<string, any[]>();
    shipments.forEach(shipment => {
      if (shipment.tracking && shipment.tracking.trim()) {
        const trackingNumber = shipment.tracking.trim().toLowerCase();
        if (!groupedByTracking.has(trackingNumber)) {
          groupedByTracking.set(trackingNumber, []);
        }
        groupedByTracking.get(trackingNumber)!.push(shipment);
      }
    });

    console.log('Tracking groups found:', groupedByTracking.size);
    console.log('Multi-item bundles:', Array.from(groupedByTracking.values()).filter(g => g.length > 1).length);

    // Assign order_group_id to groups with same tracking number
    const shipmentsWithGroups: any[] = [];
    const processedOrderIds = new Set<string>();

    groupedByTracking.forEach((group, tracking) => {
      if (group.length > 1) {
        const groupId = crypto.randomUUID();
        console.log(`Bundle group ${groupId}: tracking ${tracking}, ${group.length} items:`, group.map(s => s.order_id));
        group.forEach(shipment => {
          shipmentsWithGroups.push({
            ...shipment,
            order_group_id: groupId,
            bundle: true
          });
          processedOrderIds.add(shipment.order_id);
        });
      }
    });

    shipments.forEach(shipment => {
      if (!processedOrderIds.has(shipment.order_id)) {
        shipmentsWithGroups.push({
          ...shipment,
          order_group_id: null,
          bundle: false
        });
      }
    });

    console.log('Total after grouping:', shipmentsWithGroups.length, 'Bundled:', shipmentsWithGroups.filter(s => s.bundle).length);

    // Deduplicate within the file itself
    const seenOrderIds = new Set<string>();
    const deduplicatedShipments: any[] = [];
    let inFileDuplicates = 0;

    shipmentsWithGroups.forEach(shipment => {
      const orderId = shipment.order_id;
      if (orderId && seenOrderIds.has(orderId)) {
        inFileDuplicates++;
      } else {
        if (orderId) seenOrderIds.add(orderId);
        deduplicatedShipments.push(shipment);
      }
    });

    if (inFileDuplicates > 0) {
      console.log(`Found ${inFileDuplicates} duplicate order IDs within the file`);
    }
    console.log('After file dedup:', deduplicatedShipments.length);

    if (deduplicatedShipments.length === 0) {
      return { success: false, message: `No shipments to upload. All ${inFileDuplicates} records were duplicates within the file`, count: 0 };
    }

    const formattedShowDate = `${uploadShowDate.getFullYear()}-${String(uploadShowDate.getMonth() + 1).padStart(2, '0')}-${String(uploadShowDate.getDate()).padStart(2, '0')}`;

    const shipmentsWithUser = deduplicatedShipments.map(s => {
      const shipment = {
        ...s,
        user_id: user.id,
        channel: uploadChannel,
        show_date: formattedShowDate
      };
      
      if (uploadIsLabelOnly && s.label_url) {
        shipment.manifest_url = s.label_url;
      }
      
      return shipment;
    });

    const INSERT_BATCH_SIZE = 100;
    const PARALLEL_BATCHES = 2;
    let totalInserted = 0;
    let totalSkippedDuplicates = 0;

    const uploadStartTime = new Date().toISOString();

    const uploadBatch = async (
      batch: any[], 
      attempt = 1
    ): Promise<{ inserted: number; skipped: number }> => {
      const maxAttempts = 3;
      
      try {
        const { data: insertedData, error } = await supabase
          .from('shipments')
          .upsert(batch, { 
            onConflict: 'order_id'
          })
          .select('order_id');

        if (error) {
          if (error.code === '57014' && attempt < maxAttempts && batch.length > 10) {
            console.log(`Timeout on batch of ${batch.length}, splitting in half (attempt ${attempt})`);
            const mid = Math.floor(batch.length / 2);
            const result1 = await uploadBatch(batch.slice(0, mid), attempt + 1);
            await new Promise(resolve => setTimeout(resolve, 50));
            const result2 = await uploadBatch(batch.slice(mid), attempt + 1);
            return {
              inserted: result1.inserted + result2.inserted,
              skipped: result1.skipped + result2.skipped
            };
          }
          throw error;
        }

        const insertedCount = insertedData?.length || 0;
        return {
          inserted: insertedCount,
          skipped: batch.length - insertedCount
        };
      } catch (err) {
        throw err;
      }
    };

    console.log(`Starting upsert of ${shipmentsWithUser.length} shipments in batches of ${INSERT_BATCH_SIZE} (${PARALLEL_BATCHES} parallel)`);

    const totalBatches = Math.ceil(shipmentsWithUser.length / INSERT_BATCH_SIZE);
    
    for (let i = 0; i < shipmentsWithUser.length; i += INSERT_BATCH_SIZE * PARALLEL_BATCHES) {
      const batchPromises: Promise<{ inserted: number; skipped: number; batchNum: number }>[] = [];
      
      for (let j = 0; j < PARALLEL_BATCHES; j++) {
        const startIdx = i + (j * INSERT_BATCH_SIZE);
        if (startIdx >= shipmentsWithUser.length) break;
        
        const batch = shipmentsWithUser.slice(startIdx, startIdx + INSERT_BATCH_SIZE);
        const batchNum = Math.floor(startIdx / INSERT_BATCH_SIZE) + 1;
        
        batchPromises.push(
          uploadBatch(batch)
            .then(result => ({ ...result, batchNum }))
            .catch(error => {
              console.error(`Batch ${batchNum} failed:`, error);
              toast.error(`Batch ${batchNum} failed: ${error.message}`);
              return { inserted: 0, skipped: 0, batchNum };
            })
        );
      }

      const endIdx = Math.min(i + INSERT_BATCH_SIZE * PARALLEL_BATCHES, shipmentsWithUser.length);
      const progress = Math.round((endIdx / shipmentsWithUser.length) * 100);
      const currentBatch = Math.floor(i / INSERT_BATCH_SIZE) + 1;
      
      toast.loading(`Uploading... ${progress}%`, {
        id: 'upload-progress',
        description: `Batches ${currentBatch}-${Math.min(currentBatch + PARALLEL_BATCHES - 1, totalBatches)}/${totalBatches}`
      });

      const results = await Promise.all(batchPromises);
      
      for (const result of results) {
        totalInserted += result.inserted;
        totalSkippedDuplicates += result.skipped;
        console.log(`Batch ${result.batchNum}/${totalBatches}: ${result.inserted} new, ${result.skipped} skipped`);
      }

      if (endIdx < shipmentsWithUser.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    toast.dismiss('upload-progress');

    toast.dismiss('upload-progress');

    const totalSkipped = inFileDuplicates + totalSkippedDuplicates;

    console.log('Upload summary:', {
      fileRows: data.length,
      afterCancelledFilter: shipments.length,
      afterFileDedup: deduplicatedShipments.length,
      inFileDuplicates,
      totalInserted,
      dbDuplicatesSkipped: totalSkippedDuplicates,
    });

    if (totalInserted > 0) {
      const msg = `${totalInserted} shipments imported${totalSkipped > 0 ? `, ${totalSkipped} duplicates skipped` : ''}`;
      toast.success('Upload complete!', { description: msg });
      return { success: true, message: msg, count: totalInserted };
    } else if (totalSkippedDuplicates === deduplicatedShipments.length) {
      const msg = `${totalSkippedDuplicates} duplicates skipped`;
      toast.info('All shipments already exist', { description: msg });
      return { success: true, message: msg, count: 0 };
    } else {
      const msg = 'No records were inserted. Please try again.';
      toast.error('Upload failed', { description: msg });
      return { success: false, message: msg, count: 0 };
    }
  }, []);

  const handleUpload = async () => {
    if (!file && !parsedData) return;

    if (!showDate) {
      toast.error('Please select a show date');
      return;
    }

    setUploading(true);

    try {
      const data = parsedData || await parseFile(file!);
      const result = await processAndUpload(data, showDate, channel, isLabelOnly, columnMap);
      if (result.success) {
        navigate('/orders');
      }
    } catch (error: any) {
      toast.error('Upload failed', {
        description: error.message
      });
    } finally {
      setUploading(false);
    }
  };

  // Expose automation API on window
  useEffect(() => {
    // Initialize chunk buffer
    window.__csvBuffer = '';

    // Append a chunk of CSV data to the buffer
    window.__appendCSV = (chunk: string) => {
      window.__csvBuffer = (window.__csvBuffer || '') + chunk;
      console.log(`[Automation] Appended ${chunk.length} chars, buffer now ${window.__csvBuffer.length} chars`);
      return { success: true, bufferLength: window.__csvBuffer.length };
    };

    // Clear the buffer
    window.__clearCSV = () => {
      window.__csvBuffer = '';
      console.log('[Automation] Buffer cleared');
    };

    // Submit the buffered CSV data
    window.__submitCSV = async (options = {}) => {
      const csvString = window.__csvBuffer || '';
      if (!csvString) {
        return { success: false, message: 'Buffer is empty. Call __appendCSV(chunk) first.' };
      }
      console.log(`[Automation] Submitting buffer: ${csvString.length} chars`);
      const result = await window.__uploadCSV!(csvString, { ...options, autoSubmit: true });
      if (result.success) {
        window.__csvBuffer = '';
      }
      return result;
    };

    window.__uploadCSV = async (csvString, options = {}) => {
      const {
        showDate: showDateStr,
        channel: optChannel = 'regular',
        isLabelOnly: optLabelOnly = false,
        autoSubmit = true,
      } = options;

      if (!showDateStr) {
        return { success: false, message: 'showDate is required (ISO string e.g. "2025-03-05")' };
      }

      // Parse the date string as local date
      const [year, month, day] = showDateStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (isNaN(dateObj.getTime())) {
        return { success: false, message: `Invalid showDate: ${showDateStr}` };
      }

      try {
        const data = parseCSVString(csvString);
        if (!data || data.length === 0) {
          return { success: false, message: 'No data parsed from CSV string' };
        }

        console.log(`[Automation] Parsed ${data.length} rows from CSV string`);

        if (autoSubmit) {
          const currentColumnMap = useAppStore.getState().columnMap;
          const result = await processAndUpload(data, dateObj, optChannel, optLabelOnly, currentColumnMap);
          return result;
        } else {
          setParsedData(data);
          setPreview(data.slice(0, 5));
          setShowDate(dateObj);
          setChannel(optChannel);
          setIsLabelOnly(optLabelOnly);
          toast.success(`Loaded ${data.length} rows via automation API`);
          return { success: true, message: `Loaded ${data.length} rows. Click Upload to submit.`, count: data.length };
        }
      } catch (error: any) {
        console.error('[Automation] Upload failed:', error);
        return { success: false, message: error.message };
      }
    };

    return () => {
      delete window.__uploadCSV;
      delete window.__csvBuffer;
      delete window.__appendCSV;
      delete window.__submitCSV;
      delete window.__clearCSV;
    };
  }, [processAndUpload]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Upload Shipments</h1>
        <p className="text-muted-foreground">Import Whatnot shipment CSV or Excel file</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select CSV or Excel File</CardTitle>
          <CardDescription>Choose a Whatnot shipment export file (CSV or Excel)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Show Date <span className="text-destructive">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !showDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {showDate ? format(showDate, "PPP") : <span>Select show date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={showDate}
                    onSelect={setShowDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Channel <span className="text-destructive">*</span>
              </label>
              <RadioGroup value={channel} onValueChange={setChannel}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="regular" id="regular" />
                  <Label htmlFor="regular" className="font-normal cursor-pointer">
                    Regular Channel (chargers required)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="misfits" id="misfits" />
                  <Label htmlFor="misfits" className="font-normal cursor-pointer">
                    Misfits Channel (no chargers needed)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="outlet" id="outlet" />
                  <Label htmlFor="outlet" className="font-normal cursor-pointer">
                    Outlet Channel (no chargers needed)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tiktok" id="tiktok" />
                  <Label htmlFor="tiktok" className="font-normal cursor-pointer">
                    TikTok Channel (chargers required)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="label-only" className="font-medium">
                  Label Only Format
                </Label>
                <p className="text-sm text-muted-foreground">
                  Uses label_only field and generates pick lists for packing
                </p>
              </div>
              <Switch
                id="label-only"
                checked={isLabelOnly}
                onCheckedChange={setIsLabelOnly}
              />
            </div>

            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button
                onClick={handleUpload}
                disabled={(!file && !parsedData) || !showDate || uploading}
                size="lg"
              >
                <UploadIcon className="h-5 w-5 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            {parsedData && !file && (
              <p className="text-sm text-muted-foreground">
                📡 {parsedData.length} rows loaded via automation API
              </p>
            )}
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border p-2 whitespace-nowrap">UID</th>
                      <th className="border p-2 whitespace-nowrap">Order ID</th>
                      <th className="border p-2 whitespace-nowrap">Buyer</th>
                      <th className="border p-2 whitespace-nowrap">Product Name</th>
                      <th className="border p-2 whitespace-nowrap">Quantity</th>
                      <th className="border p-2 whitespace-nowrap">Price</th>
                      <th className="border p-2 whitespace-nowrap">Tracking</th>
                      <th className="border p-2 whitespace-nowrap">Address</th>
                      <th className="border p-2 whitespace-nowrap">Cancelled</th>
                      <th className="border p-2 whitespace-nowrap">Label URL</th>
                      <th className="border p-2 whitespace-nowrap">Manifest URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const normalized = normalizeShipmentData(row, columnMap);
                      return (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="border p-2 font-mono whitespace-nowrap">{normalized.uid || '-'}</td>
                          <td className="border p-2 whitespace-nowrap">{normalized.order_id || '-'}</td>
                          <td className="border p-2 whitespace-nowrap">{normalized.buyer || '-'}</td>
                          <td className="border p-2 max-w-[200px] truncate" title={normalized.product_name}>
                            {normalized.product_name || '-'}
                          </td>
                          <td className="border p-2 text-center">{normalized.quantity || '-'}</td>
                          <td className="border p-2 whitespace-nowrap">{normalized.price || '-'}</td>
                          <td className="border p-2 font-mono text-xs max-w-[150px] truncate" title={normalized.tracking}>
                            {normalized.tracking || '-'}
                          </td>
                          <td className="border p-2 max-w-[200px] truncate" title={normalized.address_full}>
                            {normalized.address_full || '-'}
                          </td>
                          <td className="border p-2 text-center">
                            {normalized.cancelled ? '✓' : '✗'}
                          </td>
                          <td className="border p-2 text-center">
                            {normalized.label_url ? '✓' : '✗'}
                          </td>
                          <td className="border p-2 text-center">
                            {normalized.manifest_url ? '✓' : '✗'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
