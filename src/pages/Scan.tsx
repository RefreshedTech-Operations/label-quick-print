import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { submitPrintJob, createPrintJob } from '@/lib/printnode';
import { Shipment } from '@/types';

export default function Scan() {
  const [uid, setUid] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerId, setPrinterId] = useState<string>('');
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    findShipmentByUid, 
    updateShipment, 
    settings,
    addRecentScan,
    setShipments,
    updateSettings
  } = useAppStore();

  // Load shipments and API key from database on mount
  useEffect(() => {
    loadShipments();
    loadAppConfig();
    loadUserSettings();
  }, []);

  const loadAppConfig = async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'printnode_api_key')
      .maybeSingle();

    if (error) {
      console.error('Failed to load app config:', error);
      return;
    }

    if (data?.value) {
      setPrintnodeApiKey(data.value);
    }
  };

  const loadUserSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load user settings:', error);
      return;
    }

    if (data) {
      updateSettings({
        default_printer_id: data.default_printer_id,
        auto_print: data.auto_print,
        block_cancelled: data.block_cancelled
      });
      
      // Set printer ID from settings
      if (data.default_printer_id) {
        const savedPrinterId = getCookie('selected_printer_id');
        setPrinterId(savedPrinterId || data.default_printer_id);
      }
    }
  };

  const loadShipments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load shipments:', error);
      return;
    }

    setShipments(data || []);
  };

  // Load printer ID from cookie on mount
  useEffect(() => {
    const savedPrinterId = getCookie('selected_printer_id');
    if (savedPrinterId) {
      setPrinterId(savedPrinterId);
    } else if (settings.default_printer_id) {
      setPrinterId(settings.default_printer_id);
    }
  }, [settings.default_printer_id]);

  const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };

  const setCookie = (name: string, value: string, days: number = 365) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  };

  const handlePrinterIdChange = (value: string) => {
    setPrinterId(value);
    if (value) {
      setCookie('selected_printer_id', value);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedShipment]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUid = uid.trim().toUpperCase();
    
    if (!trimmedUid) return;

    const shipment = findShipmentByUid(trimmedUid);

    if (!shipment) {
      toast.error('UID not found', {
        description: `No shipment found for UID: ${trimmedUid}`
      });
      addRecentScan(trimmedUid, 'not_found');
      setSelectedShipment(null);
      setUid('');
      return;
    }

    if (shipment.printed) {
      toast.error('Already printed', {
        description: `This label was already printed${shipment.printed_at ? ` on ${new Date(shipment.printed_at).toLocaleString()}` : ''}`
      });
      addRecentScan(trimmedUid, 'already_printed');
      setUid('');
      return;
    }

    if (settings.block_cancelled && shipment.cancelled && shipment.cancelled.toLowerCase() !== 'false') {
      toast.error('Order cancelled', {
        description: 'This order has been cancelled or failed'
      });
      addRecentScan(trimmedUid, 'cancelled');
      setUid('');
      return;
    }

    if (!shipment.manifest_url) {
      toast.error('Missing manifest URL', {
        description: 'This shipment does not have a manifest URL'
      });
      addRecentScan(trimmedUid, 'missing_manifest');
      setSelectedShipment(shipment);
      setUid('');
      return;
    }

    setSelectedShipment(shipment);
    addRecentScan(trimmedUid, 'found');
    setUid('');

    if (settings.auto_print) {
      await handlePrint(shipment);
    }
  };

  const handlePrint = async (shipment: Shipment) => {
    if (!shipment.manifest_url) {
      toast.error('Cannot print: Missing manifest URL');
      return;
    }

    if (!printnodeApiKey) {
      toast.error('PrintNode not configured', {
        description: 'Please configure PrintNode API key in Settings'
      });
      return;
    }

    if (!printerId) {
      toast.error('No printer selected', {
        description: 'Please enter a printer ID'
      });
      return;
    }

    setPrinting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const printJob = createPrintJob(
        parseInt(printerId),
        shipment.uid,
        shipment.manifest_url
      );

      const jobId = await submitPrintJob(printnodeApiKey, printJob);

      // Update shipment as printed
      await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('id', shipment.id);

      // Log print job
      await supabase
        .from('print_jobs')
        .insert({
          user_id: user.id,
          shipment_id: shipment.id,
          uid: shipment.uid,
          order_id: shipment.order_id,
          printer_id: printerId,
          printnode_job_id: jobId,
          label_url: shipment.manifest_url,
          status: 'queued'
        });

      updateShipment(shipment.id, { 
        printed: true, 
        printed_at: new Date().toISOString(),
        printed_by_user_id: user.id
      });
      
      toast.success('Label printed!', {
        description: `Printed label for ${shipment.uid}`
      });

      setSelectedShipment(null);
    } catch (error: any) {
      toast.error('Print failed', {
        description: error.message
      });

      // Log failed print job
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: user.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: printerId || '',
            label_url: shipment.manifest_url,
            status: 'error',
            error: error.message
          });
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Scan Label</h1>
        <p className="text-muted-foreground">Scan barcode with handheld scanner</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleScan} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">PrintNode Printer ID</label>
                <Input
                  type="number"
                  value={printerId}
                  onChange={(e) => handlePrinterIdChange(e.target.value)}
                  placeholder="Enter printer ID..."
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">UID</label>
                <Input
                  ref={inputRef}
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Scan or enter UID..."
                  className="text-2xl h-16 text-center font-mono"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-lg">
              Lookup
            </Button>
          </form>
        </CardContent>
      </Card>

      {selectedShipment && (
        <Card className={selectedShipment.bundle ? "border-4 border-primary bg-primary/10" : "border-2 border-primary"}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Shipment Found</span>
                {selectedShipment.bundle && (
                  <Badge variant="secondary" className="text-sm">
                    Bundle Item
                  </Badge>
                )}
              </div>
              {selectedShipment.manifest_url ? (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Manifest Ready
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" />
                  Missing Manifest URL
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-lg">
              <div>
                <p className="text-muted-foreground">UID</p>
                <p className="font-mono font-bold">{selectedShipment.uid}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Order ID</p>
                <p className="font-mono">{selectedShipment.order_id}</p>
              </div>
              {selectedShipment.order_group_id && (
                <div>
                  <p className="text-muted-foreground">Group ID</p>
                  <p className="font-mono text-xs" title={selectedShipment.order_group_id}>
                    {selectedShipment.order_group_id.slice(0, 12)}...
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Buyer</p>
                <p className="font-semibold">{selectedShipment.buyer}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Product</p>
                <p>{selectedShipment.product_name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Shipping Address</p>
                <p>{selectedShipment.address_full}</p>
              </div>
              {selectedShipment.tracking && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Tracking</p>
                  <p className="font-mono">{selectedShipment.tracking}</p>
                </div>
              )}
            </div>

            {selectedShipment.manifest_url && (
              <Button
                onClick={() => handlePrint(selectedShipment)}
                disabled={printing}
                size="lg"
                className="w-full"
              >
                <Printer className="h-5 w-5 mr-2" />
                {printing ? 'Printing...' : 'Print Label'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
