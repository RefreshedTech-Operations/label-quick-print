import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Printer, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Shipment } from '@/types';
import { submitPrintJob, createPrintJob } from '@/lib/printnode';

export default function Orders() {
  const [filter, setFilter] = useState<'all' | 'printed' | 'unprinted' | 'exceptions'>('all');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState<string | null>(null);
  
  const { shipments, updateShipment, settings, setShipments } = useAppStore();

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
      toast.error('Failed to load shipments');
      return;
    }

    setShipments(data || []);
  };

  const handlePrint = async (shipment: Shipment) => {
    if (!shipment.label_url) {
      toast.error('Cannot print: Missing label URL');
      return;
    }

    if (!settings.printnode_api_key || !settings.default_printer_id) {
      toast.error('PrintNode not configured');
      return;
    }

    setPrinting(shipment.id);

    try {
      const printJob = createPrintJob(
        parseInt(settings.default_printer_id),
        shipment.uid,
        shipment.label_url
      );

      const jobId = await submitPrintJob(settings.printnode_api_key, printJob);

      await supabase
        .from('shipments')
        .update({ printed: true, printed_at: new Date().toISOString() })
        .eq('id', shipment.id);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: user.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: settings.default_printer_id,
            printnode_job_id: jobId,
            label_url: shipment.label_url,
            status: 'queued'
          });
      }

      updateShipment(shipment.id, { printed: true, printed_at: new Date().toISOString() });
      
      toast.success(`Printed label for ${shipment.uid}`);
    } catch (error: any) {
      toast.error('Print failed', { description: error.message });
    } finally {
      setPrinting(null);
    }
  };

  const filteredShipments = shipments.filter(s => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !s.uid.toLowerCase().includes(searchLower) &&
        !s.order_id?.toLowerCase().includes(searchLower) &&
        !s.buyer?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Status filter
    if (filter === 'printed' && !s.printed) return false;
    if (filter === 'unprinted' && s.printed) return false;
    if (filter === 'exceptions') {
      const hasException = !s.label_url || (settings.block_cancelled && s.cancelled);
      if (!hasException) return false;
    }

    return true;
  });

  const stats = {
    total: shipments.length,
    printed: shipments.filter(s => s.printed).length,
    unprinted: shipments.filter(s => !s.printed).length,
    exceptions: shipments.filter(s => !s.label_url || (settings.block_cancelled && s.cancelled)).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">All Orders</h1>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            Total: {stats.total}
          </Badge>
          <Badge className="text-lg px-4 py-2 bg-success">
            Printed: {stats.printed}
          </Badge>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Unprinted: {stats.unprinted}
          </Badge>
          <Badge variant="destructive" className="text-lg px-4 py-2">
            Exceptions: {stats.exceptions}
          </Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by UID, Order ID, or Buyer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="printed">Printed</SelectItem>
            <SelectItem value="unprinted">Unprinted</SelectItem>
            <SelectItem value="exceptions">Exceptions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              filteredShipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-mono font-semibold">{shipment.uid}</TableCell>
                  <TableCell className="font-mono">{shipment.order_id}</TableCell>
                  <TableCell>{shipment.buyer}</TableCell>
                  <TableCell>{shipment.product_name}</TableCell>
                  <TableCell>
                    {!shipment.label_url ? (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        No Label
                      </Badge>
                    ) : settings.block_cancelled && shipment.cancelled ? (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Cancelled
                      </Badge>
                    ) : shipment.printed ? (
                      <Badge className="bg-success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Printed
                      </Badge>
                    ) : (
                      <Badge variant="outline">Ready</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handlePrint(shipment)}
                      disabled={!shipment.label_url || printing === shipment.id}
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      {printing === shipment.id ? 'Printing...' : shipment.printed ? 'Reprint' : 'Print'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
