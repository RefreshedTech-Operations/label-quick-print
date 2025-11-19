import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';
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
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { DateRange } from 'react-day-picker';

export default function Orders() {
  const [filter, setFilter] = useState<'all' | 'printed' | 'unprinted' | 'exceptions' | 'bundled'>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [printing, setPrinting] = useState<string | null>(null);
  const [printingGroup, setPrintingGroup] = useState<string | null>(null);
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [showDateFilter, setShowDateFilter] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingLocationIds, setEditingLocationIds] = useState<{[key: string]: string}>({});
  const [editingUids, setEditingUids] = useState<{[key: string]: string}>({});
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [showAlreadyPrintedDialog, setShowAlreadyPrintedDialog] = useState(false);
  const [bulkPrintData, setBulkPrintData] = useState<{
    alreadyPrinted: Shipment[];
    unprinted: Shipment[];
  }>({ alreadyPrinted: [], unprinted: [] });
  const [pageSize, setPageSize] = useState(25);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const { shipments, updateShipment, settings, setShipments, updateSettings } = useAppStore();

  useEffect(() => {
    loadAppConfig();
    loadUserSettings();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearch, dateRange]);

  // Load shipments when page, filters, or search changes
  useEffect(() => {
    loadShipments();
  }, [currentPage, filter, debouncedSearch, dateRange, pageSize]);

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
    }
  };

  const loadShipments = async (forceSearchMode = false) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Prevent extremely high page numbers that cause slow queries
      const MAX_OFFSET = 10000;
      const currentOffset = (currentPage - 1) * pageSize;
      if (currentOffset > MAX_OFFSET) {
        toast.error('Page number too high', {
          description: 'Please use search or filters to narrow down results.'
        });
        setCurrentPage(1);
        setLoading(false);
        return;
      }
      
      let query = supabase
        .from('shipments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply tab filters to database query
      if (filter === 'printed') {
        query = query.eq('printed', true);
      } else if (filter === 'unprinted') {
        query = query.eq('printed', false);
      } else if (filter === 'bundled') {
        query = query.eq('bundle', true);
      } else if (filter === 'exceptions') {
        query = query.or('manifest_url.is.null,cancelled.not.is.null');
      }

      // Apply search filter if present
      if (debouncedSearch.trim()) {
        const searchTerm = debouncedSearch.trim();
        const upperSearch = searchTerm.toUpperCase();
        
        // Single optimized query with exact UID match priority
        query = query.or(
          `uid.eq.${upperSearch},` + // Exact UID match (highest priority)
          `uid.ilike.%${searchTerm}%,order_id.ilike.%${searchTerm}%,` +
          `order_group_id.ilike.%${searchTerm}%,buyer.ilike.%${searchTerm}%,` +
          `tracking.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,` +
          `location_id.ilike.%${searchTerm}%`
        );
      }
      
      // Apply date range filter if present
      if (dateRange?.from && dateRange?.to) {
        query = query
          .gte('show_date', dateRange.from.toISOString().split('T')[0])
          .lte('show_date', dateRange.to.toISOString().split('T')[0]);
      }
      
      // Always paginate
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;
      query = query.range(startIndex, endIndex);

      const { data: shipmentsData, error: shipmentsError, count } = await query;

      if (shipmentsError) {
        toast.error('Failed to load shipments');
        setLoading(false);
        return;
      }

      setTotalRecords(count || 0);

      // Get all unique user IDs who printed labels (both individual and group)
      const printerIds = [...new Set([
        ...(shipmentsData || [])
          .filter(s => s.printed_by_user_id)
          .map(s => s.printed_by_user_id),
        ...(shipmentsData || [])
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
        const enrichedShipments = (shipmentsData || []).map(shipment => ({
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
        setShipments(shipmentsData || []);
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

  const handleUidChange = async (shipmentId: string, newUid: string) => {
    // Clear editing state
    const { [shipmentId]: _, ...rest } = editingUids;
    setEditingUids(rest);

    const trimmedUid = newUid.trim().toUpperCase();
    
    if (!trimmedUid) {
      toast.error('UID cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('shipments')
        .update({ uid: trimmedUid })
        .eq('id', shipmentId);

      if (error) throw error;

      updateShipment(shipmentId, { uid: trimmedUid });
      
      // Reload shipments to update the shipmentMap with new UID
      await loadShipments();
      
      toast.success('UID updated');
    } catch (error: any) {
      toast.error('Failed to update UID', { description: error.message });
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
          status: 'queued'
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
    if (selectedShipments.size === paginatedShipments.length && paginatedShipments.length > 0) {
      // Deselect all on current page
      const newSelected = new Set(selectedShipments);
      paginatedShipments.forEach(s => newSelected.delete(s.id));
      setSelectedShipments(newSelected);
    } else {
      // Select all on current page
      const newSelected = new Set(selectedShipments);
      paginatedShipments.forEach(s => newSelected.add(s.id));
      setSelectedShipments(newSelected);
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

    // Optional printer check - won't block if it fails
    try {
      if (printnodeApiKey && settings.default_printer_id) {
        const { fetchPrinters } = await import('@/lib/printnode');
        const printers = await fetchPrinters(printnodeApiKey);
        const printerIdNum = parseInt(settings.default_printer_id, 10);
        
        if (!isNaN(printerIdNum)) {
          const printer = printers.find(p => p.id === printerIdNum);
          
          if (printer) {
            console.log('Printer found:', printer.name, 'State:', printer.state);
            if (printer.state !== 'online' && printer.state !== 'idle') {
              toast.error(`Warning: Printer is ${printer.state}`, {
                description: 'Jobs may not print immediately. Check PrintNode.'
              });
            }
          } else {
            console.warn('Printer ID not found in printer list');
          }
        }
      }
    } catch (error) {
      console.warn('Could not verify printer state (non-critical):', error);
    }

    // Group shipments by tracking number (primary), manifest_url (secondary), or order_id (fallback)
    const shipmentGroups = new Map<string, Shipment[]>();
    shipmentsToPrint.forEach(shipment => {
      let groupKey: string;
      if (shipment.tracking?.trim()) {
        groupKey = `tracking:${shipment.tracking.trim()}`;
      } else if (shipment.manifest_url) {
        groupKey = `manifest:${shipment.manifest_url}`;
      } else {
        groupKey = `order:${shipment.order_id}`;
      }
      
      if (!shipmentGroups.has(groupKey)) {
        shipmentGroups.set(groupKey, []);
      }
      shipmentGroups.get(groupKey)!.push(shipment);
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated');
      setIsBulkPrinting(false);
      return;
    }

    if (!printnodeApiKey || !settings.default_printer_id) {
      toast.error('PrintNode not configured');
      setIsBulkPrinting(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let groupsProcessed = 0;
    const totalShipments = shipmentGroups.size;
    const totalItems = shipmentsToPrint.length;

    toast.info(`Printing ${totalShipments} shipping label${totalShipments !== 1 ? 's' : ''} for ${totalItems} item${totalItems !== 1 ? 's' : ''}...`);

    // Process each shipment group
    for (const [groupKey, shipmentsInGroup] of shipmentGroups) {
      groupsProcessed++;
      
      try {
        // Find representative shipment with manifest_url or label_url
        const representative = shipmentsInGroup.find(s => s.manifest_url) || shipmentsInGroup.find(s => s.label_url);
        
        if (representative) {
          const labelUrl = representative.manifest_url || representative.label_url;
          const displayUid = representative.uid || shipmentsInGroup[0].order_id;
          
          if (!labelUrl) {
            console.warn(`⚠ Group ${groupKey} has no label URL, skipping print but marking as shipped`);
          } else {
            // Print ONE label for this shipment group
            const printJob = createPrintJob(
              parseInt(settings.default_printer_id),
              displayUid,
              labelUrl
            );

            const jobId = await submitPrintJob(printnodeApiKey, printJob);

            // Add delay to prevent overwhelming PrintNode
            await new Promise(resolve => setTimeout(resolve, 150));

            console.log(`✓ Printed label ${groupsProcessed}/${totalShipments} - Group: ${groupKey} - Items: ${shipmentsInGroup.length} - Job ID: ${jobId}`);

            // Log print job
            await supabase.from('print_jobs').insert({
              user_id: user.id,
              shipment_id: representative.id,
              uid: representative.uid,
              order_id: representative.order_id,
              printer_id: settings.default_printer_id,
              printnode_job_id: jobId,
              label_url: labelUrl,
              status: 'done'
            });

            successCount++;
          }
        } else {
          console.warn(`⚠ Group ${groupKey} has no label URL, skipping print but marking as shipped`);
        }

        // Mark ALL items in this shipment group as printed
        const shipmentIds = shipmentsInGroup.map(s => s.id);
        await supabase
          .from('shipments')
          .update({ 
            printed: true, 
            printed_at: new Date().toISOString(),
            printed_by_user_id: user.id
          })
          .in('id', shipmentIds);

        // Update local state for all items
        shipmentsInGroup.forEach(shipment => {
          updateShipment(shipment.id, { 
            printed: true, 
            printed_at: new Date().toISOString(),
            printed_by_user_id: user.id
          });
        });

        // Force a full reload to ensure UI reflects database state
        await loadShipments();

      } catch (error: any) {
        failCount++;
        console.error(`✗ Failed to print group ${groupKey}:`, error.message);
        
        // Log failed job
        const representative = shipmentsInGroup.find(s => s.manifest_url) || shipmentsInGroup.find(s => s.label_url);
        if (representative) {
          const labelUrl = representative.manifest_url || representative.label_url;
          if (labelUrl) {
            try {
              await supabase.from('print_jobs').insert({
                user_id: user.id,
                shipment_id: representative.id,
                uid: representative.uid || shipmentsInGroup[0].order_id,
                order_id: representative.order_id,
                printer_id: settings.default_printer_id,
                label_url: labelUrl,
                status: 'error',
                error: error.message
              });
            } catch (dbError) {
              console.error('Failed to log error to database:', dbError);
            }
          }
        }
      }
    }

    setIsBulkPrinting(false);
    setSelectedShipments(new Set());

    if (successCount > 0) {
      toast.success(`Successfully printed ${successCount} shipping label${successCount !== 1 ? 's' : ''} for ${totalItems} item${totalItems !== 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to print ${failCount} order${failCount !== 1 ? 's' : ''}`);
    }
  };

  const handleBulkMarkShipped = async () => {
    if (selectedShipments.size === 0) return;

    const selectedShipmentsList = Array.from(selectedShipments)
      .map(id => shipments.find(s => s.id === id))
      .filter(Boolean) as Shipment[];

    setIsBulkPrinting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        setIsBulkPrinting(false);
        return;
      }

      // Update all selected shipments
      const shipmentIds = selectedShipmentsList.map(s => s.id);
      await supabase
        .from('shipments')
        .update({ 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        })
        .in('id', shipmentIds);

      // Update local state
      selectedShipmentsList.forEach(shipment => {
        updateShipment(shipment.id, { 
          printed: true, 
          printed_at: new Date().toISOString(),
          printed_by_user_id: user.id
        });
      });

      toast.success(`Marked ${selectedShipments.size} item${selectedShipments.size !== 1 ? 's' : ''} as shipped`);
      setSelectedShipments(new Set());
    } catch (error: any) {
      toast.error('Failed to mark as shipped', { description: error.message });
    } finally {
      setIsBulkPrinting(false);
    }
  };

  const filteredShipments = useMemo(() => {
    if (!shipments) return [];
    
    // Only apply status tab filter - search is already handled by database query
    return shipments.filter((s) => {
      if (filter === 'printed') return s.printed;
      if (filter === 'unprinted') return !s.printed;
      if (filter === 'bundled') return s.bundle;
      if (filter === 'exceptions') {
        return !s.manifest_url || (settings.block_cancelled && s.cancelled);
      }
      return true;
    });
  }, [shipments, filter, settings.block_cancelled]);

  // Optimized stats calculation - single pass through array
  const stats = useMemo(() => {
    return filteredShipments.reduce((acc, s) => {
      acc.total++;
      if (s.printed) acc.printed++;
      if (!s.printed) acc.unprinted++;
      if (!s.manifest_url || (settings.block_cancelled && s.cancelled)) acc.exceptions++;
      return acc;
    }, { total: 0, printed: 0, unprinted: 0, exceptions: 0 });
  }, [filteredShipments, settings.block_cancelled]);

  // Pagination
  const totalPages = isSearchMode ? Math.ceil(filteredShipments.length / pageSize) : Math.ceil(totalRecords / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedShipments = isSearchMode ? filteredShipments.slice(startIndex, endIndex) : filteredShipments;

  // Reset to page 1 and trigger search mode when search/date filters change
  useEffect(() => {
    setCurrentPage(1);
    const shouldBeSearchMode = debouncedSearch.trim() !== '' || (dateRange?.from !== undefined && dateRange?.to !== undefined);
    if (shouldBeSearchMode !== isSearchMode) {
      setIsSearchMode(shouldBeSearchMode);
      loadShipments(shouldBeSearchMode);
    }
  }, [debouncedSearch, dateRange]);

  // Reload when filter or pagination changes (only in non-search mode)
  useEffect(() => {
    if (!isSearchMode) {
      loadShipments();
    }
  }, [filter, currentPage, pageSize]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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

      <div className="flex gap-4 items-center flex-wrap">
        <Input
          placeholder="Search by UID, Order ID, Buyer, Tracking, Location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[300px]"
        />
        <div className="flex items-center gap-2">
          <DateRangeFilter 
            dateRange={dateRange} 
            setDateRange={setDateRange} 
          />
          {dateRange?.from && dateRange?.to && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDateRange(undefined)}
            >
              Clear Dates
            </Button>
          )}
        </div>
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
        <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
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
            {isBulkPrinting ? 'Processing...' : `Print Selected (${selectedShipments.size})`}
          </Button>
          <Button 
            variant="secondary"
            onClick={handleBulkMarkShipped}
            disabled={isBulkPrinting}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark as Shipped ({selectedShipments.size})
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
                  checked={paginatedShipments.length > 0 && paginatedShipments.every(s => selectedShipments.has(s.id))}
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
            {loading ? (
              <>
                {[...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : paginatedShipments.length === 0 ? (
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
                  <TableCell>
                    <Input
                      value={editingUids[shipment.id] ?? shipment.uid ?? ''}
                      onChange={(e) => setEditingUids(prev => ({ 
                        ...prev, 
                        [shipment.id]: e.target.value 
                      }))}
                      onBlur={(e) => {
                        if (editingUids[shipment.id] !== undefined && editingUids[shipment.id] !== shipment.uid) {
                          handleUidChange(shipment.id, e.target.value);
                        } else {
                          const { [shipment.id]: _, ...rest } = editingUids;
                          setEditingUids(rest);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUidChange(shipment.id, e.currentTarget.value);
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          const { [shipment.id]: _, ...rest } = editingUids;
                          setEditingUids(rest);
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="UID"
                      className="w-32 h-8 text-xs font-mono font-semibold"
                    />
                  </TableCell>
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
            {isSearchMode ? (
              <>Showing {startIndex + 1} to {Math.min(endIndex, filteredShipments.length)} of {filteredShipments.length} orders (filtered from {totalRecords} total)</>
            ) : (
              <>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} orders</>
            )}
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
