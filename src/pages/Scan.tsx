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

// Get PrintNode API key from environment variable
const PRINTNODE_API_KEY = import.meta.env.VITE_PRINTNODE_API_KEY || '';

export default function Scan() {
  const [uid, setUid] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printerId, setPrinterId] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    findShipmentByUid, 
    updateShipment, 
    settings,
    addRecentScan,
    setShipments 
  } = useAppStore();

  // Load shipments from database on mount
  useEffect(() => {
    loadShipments();
  }, []);

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

    if (!shipment.label_url) {
      toast.error('Missing label URL', {
        description: 'This shipment does not have a label URL'
      });
      addRecentScan(trimmedUid, 'missing_label');
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
    if (!shipment.label_url) {
      toast.error('Cannot print: Missing label URL');
      return;
    }

    if (!PRINTNODE_API_KEY) {
      toast.error('PrintNode not configured', {
        description: 'PrintNode API key not found. Please contact administrator.'
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
      const printJob = createPrintJob(
        parseInt(printerId),
        shipment.uid,
        shipment.label_url
      );

      const jobId = await submitPrintJob(PRINTNODE_API_KEY, printJob);

      // Update shipment as printed
      await supabase
        .from('shipments')
        .update({ printed: true, printed_at: new Date().toISOString() })
        .eq('id', shipment.id);

      // Log print job
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: user.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: printerId,
            printnode_job_id: jobId,
            label_url: shipment.label_url,
            status: 'queued'
          });
      }

      updateShipment(shipment.id, { printed: true, printed_at: new Date().toISOString() });
      
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
            label_url: shipment.label_url,
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
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Shipment Found</span>
              {selectedShipment.label_url ? (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Label Ready
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-4 w-4 mr-1" />
                  Missing Label URL
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

            {selectedShipment.label_url && (
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
