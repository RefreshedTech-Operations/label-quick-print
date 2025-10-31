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
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [showDateFilter, setShowDateFilter] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
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
          .eq('user_id', user.id)
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
            status: 'queued'
          });
      }

      updateShipment(shipment.id, { 
        printed: true, 
        printed_at: new Date().toISOString(),
        printed_by_user_id: user.id
      });
      
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>UID</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Group ID</TableHead>
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
                <TableCell colSpan={18} className="text-center text-muted-foreground py-8">
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              paginatedShipments.map((shipment) => (
                <TableRow key={shipment.id} className={shipment.bundle ? "bg-primary/10 border-l-4 border-l-primary hover:bg-primary/15" : ""}>
                  <TableCell className="font-mono font-semibold">{shipment.uid}</TableCell>
                  <TableCell className="font-mono">{shipment.order_id}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate" title={shipment.order_group_id || ''}>
                    {shipment.order_group_id ? shipment.order_group_id.slice(0, 8) : '-'}
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
                    <Button
                      size="sm"
                      onClick={() => handlePrint(shipment)}
                      disabled={!shipment.manifest_url || printing === shipment.id}
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
    </div>
  );
}
