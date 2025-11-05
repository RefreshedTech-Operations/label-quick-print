import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from 'sonner';
import { Printer, CheckCircle, XCircle, AlertCircle, CalendarIcon } from 'lucide-react';
import { Shipment } from '@/types';
import { submitPrintJob, createPrintJob } from '@/lib/printnode';
import { format } from 'date-fns';

export default function Orders() {
  const [filter, setFilter] = useState<'all' | 'printed' | 'unprinted' | 'exceptions' | 'bundled'>('all');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState<string | null>(null);
  const [printingGroup, setPrintingGroup] = useState<string | null>(null);
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [showDateFilter, setShowDateFilter] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingLocationIds, setEditingLocationIds] = useState<{[key: string]: string}>({});
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [showAlreadyPrintedDialog, setShowAlreadyPrintedDialog] = useState(false);
  const [bulkPrintData, setBulkPrintData] = useState<{
    alreadyPrinted: Shipment[];
    unprinted: Shipment[];
  }>({ alreadyPrinted: [], unprinted: [] });
  const itemsPerPage = 1000;
  
  const { shipments, updateShipment, settings, setShipments } = useAppStore();

  useEffect(() => {
    loadShipments();
    loadAppConfig();
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

  const loadShipments = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all shipments with pagination (1000 rows at a time)
      let allShipments: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: shipmentsData, error: shipmentsError } = await supabase
          .from('shipments')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (shipmentsError) {
          toast.error('Failed to load shipments');
          setLoading(false);
          return;
        }

        if (shipmentsData && shipmentsData.length > 0) {
          allShipments = [...allShipments, ...shipmentsData];
          hasMore = shipmentsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Get all unique user IDs who printed labels (both individual and group)
      const printerIds = [...new Set([
        ...allShipments
          .filter(s => s.printed_by_user_id)
          .map(s => s.printed_by_user_id),
        ...allShipments
          .filter(s => s.group_id_printed_by_user_id)
          .map(s => s.group_id_printed_by_user_id)
      ])];

      if (printerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', printerIds);

        // Map profiles to shipments
        const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const enrichedShipments = allShipments.map(shipment => ({
          ...shipment,
          printed_by: shipment.printed_by_user_id 
            ? profileMap.get(shipment.printed_by_user_id) 
            : undefined,
          group_id_printed_by: shipment.group_id_printed_by_user_id 
            ? profileMap.get(shipment.group_id_printed_by_user_id) 
            : undefined
        }));

        setShipments(enrichedShipments);
      } else {
        setShipments(allShipments);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLocationIdChange = async (shipmentId: string, newLocationId: string) => {
    // Clear editing state
    const { [shipmentId]: _, ...rest } = editingLocationIds;
    setEditingLocationIds(rest);

    try {
      const { error } = await supabase
        .from('shipments')
        .update({ location_id: newLocationId })
        .eq('id', shipmentId);

      if (error) throw error;

      updateShipment(shipmentId, { location_id: newLocationId });
      toast.success('Location ID updated');
    } catch (error: any) {
      toast.error('Failed to update location ID', { description: error.message });
    }
  };

  const handlePrint = async (shipment: Shipment) => {
    if (!shipment.manifest_url) {
      toast.error('Cannot print: Missing manifest URL');
      return;
    }

    if (!printnodeApiKey || !settings.default_printer_id) {
      toast.error('PrintNode not configured');
      return;
    }

    setPrinting(shipment.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const printJob = createPrintJob(
        parseInt(settings.default_printer_id),
        shipment.uid,
        shipment.manifest_url
      );

      const jobId = await submitPrintJob(printnodeApiKey, printJob);
      console.log('Print job submitted - UID:', shipment.uid, '- PrintNode Job ID:', jobId);

      await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .eq('id', shipment.id);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: currentUser.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: settings.default_printer_id,
            printnode_job_id: jobId,
            label_url: shipment.manifest_url,
            status: 'done'
          });
      }

      updateShipment(shipment.id, { 
        printed: true, 
        printed_at: new Date().toISOString(),
        printed_by_user_id: user.id
      });
      
      toast.success(`Printed label for ${shipment.uid}`);
    } catch (error: any) {
      console.error('Print failed:', error);
      toast.error('Print failed', { description: error.message });
      
      // Log the error in print_jobs
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from('print_jobs')
          .insert({
            user_id: currentUser.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: settings.default_printer_id,
            label_url: shipment.manifest_url,
            status: 'error',
            error: error.message
          });
      }
    } finally {
      setPrinting(null);
    }
  };

  const handlePrintGroupLabel = async (shipment: Shipment) => {
    if (!shipment.order_group_id) {
      toast.error('No group ID for this shipment');
      return;
    }

    if (!shipment.manifest_url) {
      toast.error('Cannot print: Missing manifest URL');
      return;
    }

    if (!printnodeApiKey || !settings.default_printer_id) {
      toast.error('PrintNode not configured');
      return;
    }

    setPrintingGroup(shipment.order_group_id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      // Print the group label
      const printJob = createPrintJob(
        parseInt(settings.default_printer_id),
        `GROUP-${shipment.order_group_id.slice(0, 8)}`,
        shipment.manifest_url
      );

      const jobId = await submitPrintJob(printnodeApiKey, printJob);

      // Mark all shipments in this group as group_id_printed
      await supabase
        .from('shipments')
        .update({
          group_id_printed: true,
          group_id_printed_at: new Date().toISOString(),
          group_id_printed_by_user_id: user.id
        })
        .eq('order_group_id', shipment.order_group_id);

      // Log print job
      await supabase
        .from('print_jobs')
        .insert({
          user_id: user.id,
          shipment_id: shipment.id,
          uid: `GROUP-${shipment.order_group_id.slice(0, 8)}`,
          order_id: shipment.order_id,
          printer_id: settings.default_printer_id,
          printnode_job_id: jobId,
          label_url: shipment.manifest_url,
          status: 'done'
        });

      // Update local state for all shipments in this group
      shipments.forEach(s => {
        if (s.order_group_id === shipment.order_group_id) {
          updateShipment(s.id, {
            group_id_printed: true,
            group_id_printed_at: new Date().toISOString(),
            group_id_printed_by_user_id: user.id
          });
        }
      });

      toast.success(`Printed group label for ${shipment.order_group_id.slice(0, 8)}`);
    } catch (error: any) {
      toast.error('Group print failed', { description: error.message });
    } finally {
      setPrintingGroup(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedShipments.size === filteredShipments.length) {
      setSelectedShipments(new Set());
    } else {
      setSelectedShipments(new Set(filteredShipments.map(s => s.id)));
    }
  };

  const toggleSelectShipment = (id: string) => {
    const newSelected = new Set(selectedShipments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedShipments(newSelected);
  };

  const handleBulkPrint = async () => {
    if (selectedShipments.size === 0) return;

    const selectedShipmentsList = Array.from(selectedShipments)
      .map(id => shipments.find(s => s.id === id))
      .filter(Boolean) as Shipment[];

    const alreadyPrinted = selectedShipmentsList.filter(s => s.printed);
    const unprinted = selectedShipmentsList.filter(s => !s.printed);

    if (alreadyPrinted.length === selectedShipmentsList.length) {
      toast.error('All selected orders have already been printed');
      return;
    }

    if (alreadyPrinted.length > 0) {
      setBulkPrintData({ alreadyPrinted, unprinted });
      setShowAlreadyPrintedDialog(true);
      return;
    }

    await executeBulkPrint(unprinted);
  };

  const executeBulkPrint = async (shipmentsToPrint: Shipment[]) => {
    setShowAlreadyPrintedDialog(false);
    setIsBulkPrinting(true);

    // Check printer state before starting
    try {
      const { fetchPrinters } = await import('@/lib/printnode');
      const printers = await fetchPrinters(printnodeApiKey);
      const defaultPrinter = printers.find(p => p.id === parseInt(settings.default_printer_id!));
      
      if (!defaultPrinter) {
        toast.error('Default printer not found in PrintNode');
        setIsBulkPrinting(false);
        return;
      }
      
      if (defaultPrinter.state !== 'online' && defaultPrinter.state !== 'idle') {
        toast.error(`Printer is ${defaultPrinter.state}. Please check PrintNode.`);
        setIsBulkPrinting(false);
        return;
      }
      
      console.log('Printer check passed:', defaultPrinter.name, 'State:', defaultPrinter.state);
    } catch (error: any) {
      console.error('Failed to check printer state:', error);
      toast.error('Failed to verify printer status', { description: error.message });
      setIsBulkPrinting(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated');
      setIsBulkPrinting(false);
      return;
    }

    for (let i = 0; i < shipmentsToPrint.length; i++) {
      const shipment = shipmentsToPrint[i];
      
      toast.info(`Printing ${i + 1} of ${shipmentsToPrint.length}...`);

      try {
        if (!shipment.manifest_url) {
          console.log(`Skipping ${shipment.uid}: No manifest URL`);
          failCount++;
          continue;
        }

        if (!printnodeApiKey || !settings.default_printer_id) {
          toast.error('PrintNode not configured');
          setIsBulkPrinting(false);
          return;
        }

        const printJob = createPrintJob(
          parseInt(settings.default_printer_id),
          shipment.uid,
          shipment.manifest_url
        );

        const jobId = await submitPrintJob(printnodeApiKey, printJob);
        console.log(`Submitted job ${i + 1} of ${shipmentsToPrint.length} - UID: ${shipment.uid} - PrintNode Job ID: ${jobId}`);

        await supabase
          .from('shipments')
          .update({ 
            printed: true, 
            printed_at: new Date().toISOString(),
            printed_by_user_id: user.id
          })
          .eq('id', shipment.id);

        await supabase
          .from('print_jobs')
          .insert({
            user_id: user.id,
            shipment_id: shipment.id,
            uid: shipment.uid,
            order_id: shipment.order_id,
            printer_id: settings.default_printer_id,
            printnode_job_id: jobId,
            label_url: shipment.manifest_url,
            status: 'done'
          });

        updateShipment(shipment.id, { 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        });

        successCount++;
        
        // Add 150ms delay between jobs to prevent overwhelming PrintNode
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error: any) {
        console.error(`Failed to print ${shipment.uid}:`, error);
        
        // Log the error in print_jobs
        try {
          await supabase
            .from('print_jobs')
            .insert({
              user_id: user.id,
              shipment_id: shipment.id,
              uid: shipment.uid,
              order_id: shipment.order_id,
              printer_id: settings.default_printer_id,
              label_url: shipment.manifest_url,
              status: 'error',
              error: error.message
            });
        } catch (logError) {
          console.error('Failed to log error:', logError);
        }
        
        failCount++;
      }
    }

    setIsBulkPrinting(false);
    setSelectedShipments(new Set());

    if (successCount > 0) {
      toast.success(`Successfully printed ${successCount} label${successCount !== 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to print ${failCount} label${failCount !== 1 ? 's' : ''}`);
    }
  };

  const filteredShipments = shipments.filter(s => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !s.uid.toLowerCase().includes(searchLower) &&
        !s.order_id?.toLowerCase().includes(searchLower) &&
        !s.buyer?.toLowerCase().includes(searchLower) &&
        !s.order_group_id?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Show date filter
    if (showDateFilter && s.show_date) {
      const shipmentDate = new Date(s.show_date);
      const filterDate = new Date(showDateFilter);
      if (
        shipmentDate.getFullYear() !== filterDate.getFullYear() ||
        shipmentDate.getMonth() !== filterDate.getMonth() ||
        shipmentDate.getDate() !== filterDate.getDate()
      ) {
        return false;
      }
    }

    // Status filter
    if (filter === 'printed' && !s.printed) return false;
    if (filter === 'unprinted' && s.printed) return false;
    if (filter === 'bundled' && !s.bundle) return false;
    if (filter === 'exceptions') {
      const hasException = !s.manifest_url || (settings.block_cancelled && s.cancelled);
      if (!hasException) return false;
    }

    return true;
  });

  const stats = {
    total: filteredShipments.length,
    printed: filteredShipments.filter(s => s.printed).length,
    unprinted: filteredShipments.filter(s => !s.printed).length,
    exceptions: filteredShipments.filter(s => !s.manifest_url || (settings.block_cancelled && s.cancelled)).length
  };

  // Pagination
  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedShipments = filteredShipments.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, showDateFilter, filter]);

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

      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading shipments...
        </div>
      )}

      <div className="flex gap-4">
        <Input
          placeholder="Search by UID, Order ID, Buyer, or Group ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[240px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {showDateFilter ? format(showDateFilter, "PPP") : "Filter by Show Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={showDateFilter}
              onSelect={setShowDateFilter}
              initialFocus
            />
            {showDateFilter && (
              <div className="p-3 border-t">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setShowDateFilter(undefined)}
                >
                  Clear Filter
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="printed">Printed</SelectItem>
            <SelectItem value="unprinted">Unprinted</SelectItem>
            <SelectItem value="bundled">Bundled Items</SelectItem>
            <SelectItem value="exceptions">Exceptions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedShipments.size > 0 && (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
          <span className="text-sm font-medium">
            {selectedShipments.size} order{selectedShipments.size !== 1 ? 's' : ''} selected
          </span>
          <Button 
            onClick={handleBulkPrint}
            disabled={isBulkPrinting}
            className="ml-auto"
          >
            <Printer className="h-4 w-4 mr-2" />
            {isBulkPrinting ? 'Printing...' : `Print Selected (${selectedShipments.size})`}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setSelectedShipments(new Set())}
            disabled={isBulkPrinting}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedShipments.size === filteredShipments.length && filteredShipments.length > 0}
                  onCheckedChange={toggleSelectAll}
                  disabled={isBulkPrinting}
                />
              </TableHead>
              <TableHead>UID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Group ID</TableHead>
              <TableHead>Location ID</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Bundle</TableHead>
              <TableHead>Show Date</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Cancelled</TableHead>
              <TableHead>Printed</TableHead>
              <TableHead>Printed By</TableHead>
              <TableHead>Group Label Printed</TableHead>
              <TableHead>Group Label By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="text-center text-muted-foreground py-8">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              paginatedShipments.map((shipment) => (
                <TableRow 
                  key={shipment.id} 
                  className={
                    shipment.printed 
                      ? "bg-success/10 hover:bg-success/15" 
                      : shipment.bundle 
                        ? "bg-primary/10 border-l-4 border-l-primary hover:bg-primary/15" 
                        : ""
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedShipments.has(shipment.id)}
                      onCheckedChange={() => toggleSelectShipment(shipment.id)}
                      disabled={isBulkPrinting}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-semibold">{shipment.uid}</TableCell>
                  <TableCell className="font-mono">{shipment.order_id}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate" title={shipment.order_group_id || ''}>
                    {shipment.order_group_id ? shipment.order_group_id.slice(0, 8) : '-'}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editingLocationIds[shipment.id] ?? shipment.location_id ?? ''}
                      onChange={(e) => setEditingLocationIds(prev => ({ 
                        ...prev, 
                        [shipment.id]: e.target.value 
                      }))}
                      onBlur={(e) => {
                        if (editingLocationIds[shipment.id] !== undefined) {
                          handleLocationIdChange(shipment.id, e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleLocationIdChange(shipment.id, e.currentTarget.value);
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="Location"
                      className="w-24 h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>{shipment.buyer}</TableCell>
                  <TableCell>{shipment.product_name}</TableCell>
                  <TableCell className="text-center">
                    {shipment.bundle ? (
                      <Badge variant="secondary" className="text-xs">Bundle</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{shipment.show_date ? format(new Date(shipment.show_date), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{shipment.price || '-'}</TableCell>
                  <TableCell>{shipment.quantity || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{shipment.tracking || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={shipment.address_full || ''}>{shipment.address_full || '-'}</TableCell>
                  <TableCell>{shipment.cancelled || '-'}</TableCell>
                  <TableCell>{shipment.printed ? format(new Date(shipment.printed_at!), 'MMM d, HH:mm') : '-'}</TableCell>
                  <TableCell className="text-xs">{shipment.printed_by?.email || '-'}</TableCell>
                  <TableCell>{shipment.group_id_printed ? format(new Date(shipment.group_id_printed_at!), 'MMM d, HH:mm') : '-'}</TableCell>
                  <TableCell className="text-xs">{shipment.group_id_printed_by?.email || '-'}</TableCell>
                  <TableCell>
                    {!shipment.manifest_url ? (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        No Manifest
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePrint(shipment)}
                        disabled={!shipment.manifest_url || printing === shipment.id}
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        {printing === shipment.id ? 'Printing...' : shipment.printed ? 'Reprint' : 'Print'}
                      </Button>
                      {shipment.order_group_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintGroupLabel(shipment)}
                          disabled={!shipment.manifest_url || printingGroup === shipment.order_group_id}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          {printingGroup === shipment.order_group_id ? 'Printing...' : 'Group'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredShipments.length)} of {filteredShipments.length} orders
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <AlertDialog open={showAlreadyPrintedDialog} onOpenChange={setShowAlreadyPrintedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Some Orders Already Printed
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                {bulkPrintData.alreadyPrinted.length} of {bulkPrintData.alreadyPrinted.length + bulkPrintData.unprinted.length} selected orders have already been printed:
              </p>
              
              <div className="max-h-[200px] overflow-y-auto bg-muted p-3 rounded border">
                {bulkPrintData.alreadyPrinted.map(s => (
                  <div key={s.id} className="font-mono text-sm py-1 border-b last:border-0">
                    <span className="font-semibold">UID: {s.uid}</span> | Order: {s.order_id}
                  </div>
                ))}
              </div>

              <p className="text-sm">
                Would you like to print only the {bulkPrintData.unprinted.length} unprinted order{bulkPrintData.unprinted.length !== 1 ? 's' : ''}?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkPrinting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => executeBulkPrint(bulkPrintData.unprinted)}
              disabled={isBulkPrinting}
            >
              Print Unprinted Only ({bulkPrintData.unprinted.length})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
