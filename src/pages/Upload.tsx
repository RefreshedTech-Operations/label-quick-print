import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload as UploadIcon, FileSpreadsheet, CalendarIcon } from 'lucide-react';
import { parseCSV, normalizeShipmentData } from '@/lib/csv';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [showDate, setShowDate] = useState<Date>();
  
  const { columnMap, setShipments, settings } = useAppStore();
  const navigate = useNavigate();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(selectedFile);

    try {
      const data = await parseCSV(selectedFile);
      setPreview(data.slice(0, 5));
      toast.success(`Loaded ${data.length} rows`);
    } catch (error: any) {
      toast.error('Failed to parse CSV');
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

      const data = await parseCSV(file);
      
      const shipments = data
        .map(row => normalizeShipmentData(row, columnMap, settings.fallback_uid_from_description))
        .filter(s => s.uid)
        .filter(s => !s.cancelled || s.cancelled.trim() === '');

      // Deduplicate by UID (keep last occurrence)
      const uidMap = new Map<string, any>();
      shipments.forEach(s => {
        uidMap.set(s.uid.toUpperCase(), s);
      });
      const uniqueShipments = Array.from(uidMap.values());

      if (uniqueShipments.length < shipments.length) {
        toast.info(`Removed ${shipments.length - uniqueShipments.length} duplicate UIDs`);
      }

      // Insert shipments into database
      const shipmentsWithUser = uniqueShipments.map(s => ({
        ...s,
        user_id: user.id,
        show_date: showDate ? format(showDate, 'yyyy-MM-dd') : null
      }));

      const { data: insertedData, error } = await supabase
        .from('shipments')
        .upsert(shipmentsWithUser, { 
          onConflict: 'user_id,uid',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;

      setShipments(insertedData || []);

      const printable = uniqueShipments.filter(s => s.label_url && (!settings.block_cancelled || !s.cancelled)).length;
      const printed = insertedData?.filter(s => s.printed).length || 0;
      const exceptions = uniqueShipments.filter(s => !s.label_url || (settings.block_cancelled && s.cancelled)).length;

      toast.success('Upload complete!', {
        description: `Total: ${uniqueShipments.length} | Printable: ${printable} | Printed: ${printed} | Exceptions: ${exceptions}`
      });

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
        <p className="text-muted-foreground">Import Whatnot shipment CSV</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select CSV File</CardTitle>
          <CardDescription>Choose a Whatnot shipment export CSV file</CardDescription>
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

            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".csv"
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border p-2">UID</th>
                      <th className="border p-2">Order ID</th>
                      <th className="border p-2">Buyer</th>
                      <th className="border p-2">Product</th>
                      <th className="border p-2">Label URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const normalized = normalizeShipmentData(row, columnMap, settings.fallback_uid_from_description);
                      return (
                        <tr key={i}>
                          <td className="border p-2 font-mono">{normalized.uid}</td>
                          <td className="border p-2">{normalized.order_id}</td>
                          <td className="border p-2">{normalized.buyer}</td>
                          <td className="border p-2">{normalized.product_name}</td>
                          <td className="border p-2">
                            {normalized.label_url ? '✓' : '✗'}
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
