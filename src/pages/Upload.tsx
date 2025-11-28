import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload as UploadIcon, FileSpreadsheet, CalendarIcon } from 'lucide-react';
import { parseFile, normalizeShipmentData } from '@/lib/csv';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [showDate, setShowDate] = useState<Date>();
  const [channel, setChannel] = useState<string>('regular');
  
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

  const handleUpload = async () => {
    if (!file) return;

    if (!showDate) {
      toast.error('Please select a show date');
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const data = await parseFile(file);
      console.log('Total rows:', data.length);
      
      const shipments = data
        .map(row => normalizeShipmentData(row, columnMap))
        .filter(s => !s.cancelled || s.cancelled.trim() === '')
        .filter(s => s.order_id && s.order_id.trim() !== ''); // Skip empty order_ids
      
      console.log('After cancelled and empty order_id filter:', shipments.length);

      // Group shipments by tracking number
      const groupedByTracking = new Map<string, any[]>();
      shipments.forEach(shipment => {
        // Only group if tracking number exists
        if (shipment.tracking && shipment.tracking.trim()) {
          const trackingNumber = shipment.tracking.trim().toLowerCase();
          if (!groupedByTracking.has(trackingNumber)) {
            groupedByTracking.set(trackingNumber, []);
          }
          groupedByTracking.get(trackingNumber)!.push(shipment);
        }
      });

      // Assign order_group_id to groups with same tracking number
      const shipmentsWithGroups: any[] = [];
      const processedShipments = new Set();

      groupedByTracking.forEach((group) => {
        // Only assign group ID if there are multiple shipments with the same tracking
        if (group.length > 1) {
          const groupId = crypto.randomUUID();
          group.forEach(shipment => {
            shipmentsWithGroups.push({
              ...shipment,
              order_group_id: groupId,
              bundle: true
            });
            processedShipments.add(shipment);
          });
        }
      });

      // Add remaining shipments without group IDs (single tracking or no tracking)
      shipments.forEach(shipment => {
        if (!processedShipments.has(shipment)) {
          shipmentsWithGroups.push({
            ...shipment,
            order_group_id: null,
            bundle: false
          });
        }
      });

      // Phase 1: Deduplicate within the file itself
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
      console.log('After dedup:', deduplicatedShipments.length);

      // Phase 2: Check database for existing order_ids (batched for large files)
      const orderIdsToCheck = deduplicatedShipments
        .map(s => s.order_id)
        .filter(Boolean);

      // Batch the .in() query to handle large files (Supabase limit ~1000)
      const BATCH_SIZE = 500;
      const existingOrderIds = new Set<string>();

      for (let i = 0; i < orderIdsToCheck.length; i += BATCH_SIZE) {
        const batch = orderIdsToCheck.slice(i, i + BATCH_SIZE);
        const { data: existingBatch } = await supabase
          .from('shipments')
          .select('order_id')
          .in('order_id', batch);
        
        existingBatch?.forEach(s => existingOrderIds.add(s.order_id));
      }

      console.log('Existing in DB:', existingOrderIds.size);

      // Filter out DB duplicates
      const newShipments = deduplicatedShipments.filter(
        s => !existingOrderIds.has(s.order_id)
      );
      const dbDuplicateCount = deduplicatedShipments.length - newShipments.length;
      const totalSkipped = inFileDuplicates + dbDuplicateCount;
      
      console.log('New to insert:', newShipments.length);

      // Early return if ALL are duplicates
      if (newShipments.length === 0) {
        toast.warning('No new shipments to upload', {
          description: `Skipped ${inFileDuplicates} file duplicates, ${dbDuplicateCount} already in database`
        });
        setUploading(false);
        return;
      }

      // Insert only NEW shipments into database
      const shipmentsWithUser = newShipments.map(s => ({
        ...s,
        user_id: user.id,
        channel: channel,
        show_date: showDate 
          ? `${showDate.getFullYear()}-${String(showDate.getMonth() + 1).padStart(2, '0')}-${String(showDate.getDate()).padStart(2, '0')}`
          : null
      }));

      const { data: insertedData, error } = await supabase
        .from('shipments')
        .upsert(shipmentsWithUser, { 
          onConflict: 'order_id',
          ignoreDuplicates: true
        })
        .select();

      if (error) throw error;

      // No need to set local state - Orders page will fetch from database

      const printable = newShipments.filter(s => s.manifest_url && (!settings.block_cancelled || !s.cancelled)).length;
      const printed = insertedData?.filter(s => s.printed).length || 0;
      const exceptions = newShipments.filter(s => !s.manifest_url || (settings.block_cancelled && s.cancelled)).length;

      toast.success('Upload complete!', {
        description: `Imported: ${newShipments.length} | File duplicates: ${inFileDuplicates} | DB duplicates: ${dbDuplicateCount} | Printable: ${printable}`
      });

      if (totalSkipped > 0) {
        toast.info(`Skipped ${totalSkipped} duplicate shipment(s)`, {
          description: `${inFileDuplicates} duplicates within file, ${dbDuplicateCount} already in database`
        });
      }

      navigate('/orders');
    } catch (error: any) {
      toast.error('Upload failed', {
        description: error.message
      });
    } finally {
      setUploading(false);
    }
  };

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
              </RadioGroup>
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
                disabled={!file || !showDate || uploading}
                size="lg"
              >
                <UploadIcon className="h-5 w-5 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
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
