import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdaptiveDebounce } from '@/hooks/useAdaptiveDebounce';
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
import { Printer, CheckCircle, XCircle, AlertCircle, CalendarIcon, Loader2, RefreshCw, Download, Trash2 } from 'lucide-react';
import { Shipment } from '@/types';
import { exportOrders } from '@/lib/analyticsExport';
import { submitPrintJob, createPrintJob } from '@/lib/printnode';
import { createPickListPrintJob, PickListData } from '@/lib/pickList';
import { format } from 'date-fns';
import { ShowDateFilter } from '@/components/ShowDateFilter';
import { useColumnResize } from '@/hooks/useColumnResize';
import { HighlightText } from '@/components/HighlightText';

export default function Orders() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'printed' | 'unprinted' | 'exceptions' | 'bundled' | 'incomplete_bundles'>(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter && ['all', 'printed', 'unprinted', 'exceptions', 'bundled', 'incomplete_bundles'].includes(urlFilter)) {
      return urlFilter as 'all' | 'printed' | 'unprinted' | 'exceptions' | 'bundled' | 'incomplete_bundles';
    }
    return 'unprinted';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');

  // Clear URL params after initial read
  useEffect(() => {
    if (searchParams.get('search') || searchParams.get('filter')) {
      searchParams.delete('search');
      searchParams.delete('filter');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);
  const debouncedSearch = useAdaptiveDebounce(search, 600);
  const [printing, setPrinting] = useState<string | null>(null);
  const [printingGroup, setPrintingGroup] = useState<string | null>(null);
  const [printnodeApiKey, setPrintnodeApiKey] = useState('');
  const [showDateFilter, setShowDateFilter] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
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
  const [statsEnabled, setStatsEnabled] = useState(true); // PHASE 2: Lazy stats loading
  const [allowAllShows, setAllowAllShows] = useState(false); // Prevent "All Shows" query on initial load
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteNoManifestDialog, setShowDeleteNoManifestDialog] = useState(false);
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const { settings, updateSettings } = useAppStore();

  // Check if current user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.rpc('has_role', { 
          _user_id: user.id, 
          _role: 'admin' 
        });
        setIsAdmin(data === true);
      }
    };
    checkAdminRole();
  }, []);

  // Reset "All Shows" mode when a specific date is selected
  useEffect(() => {
    if (showDateFilter !== undefined && allowAllShows) {
      setAllowAllShows(false);
    }
  }, [showDateFilter, allowAllShows]);
  const { columnWidths, handleResizeStart, resizingColumn } = useColumnResize('orders-table-widths');

  // Helper to identify Label Only orders
  const isLabelOnlyOrder = (shipment: Shipment) => {
    return shipment.label_url && 
           shipment.manifest_url && 
           shipment.label_url === shipment.manifest_url;
  };

  // Fetch app config and user settings (cached with React Query)
  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'printnode_api_key')
        .maybeSingle();
      
      if (error) throw error;
      return data?.value || '';
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Parallel fetch of recent show dates with efficient aggregation
  const { data: recentShowDates } = useQuery({
    queryKey: ['recent-show-dates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_show_date_counts', { limit_rows: 5 });
      
      if (error) throw error;
      
      return data?.map(({ show_date, count, unprinted_count }) => ({ 
        date: show_date, 
        count: Number(count),
        unprintedCount: Number(unprinted_count)
      })) || [];
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Auto-select most recent show date on initial load
  useEffect(() => {
    if (recentShowDates && recentShowDates.length > 0 && !showDateFilter) {
      setShowDateFilter(recentShowDates[0].date);
    }
  }, [recentShowDates, showDateFilter]);

  // Update settings when userSettings data loads
  useEffect(() => {
    if (userSettings) {
      updateSettings({
        default_printer_id: userSettings.default_printer_id,
        auto_print: userSettings.auto_print,
        block_cancelled: userSettings.block_cancelled
      });
    }
  }, [userSettings, updateSettings]);

  // Update API key when appConfig loads
  useEffect(() => {
    if (appConfig) {
      setPrintnodeApiKey(appConfig);
    }
  }, [appConfig]);

  // Reset to page 1 when filters change (instant for filters, debounced for search)
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, showDateFilter, debouncedSearch]);

  // React Query for shipments with caching and optimized column selection
  // PHASE 2 VERIFICATION: Query cancellation is automatic via React Query's AbortSignal
  // React Query automatically cancels in-flight requests when queryKey changes
  // GUARD: Wait for show date to be auto-selected OR user explicitly enables "All Shows"
  const { data: shipmentsResponse, isLoading: loading } = useQuery({
    queryKey: ['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize],
    queryFn: async ({ signal }) => { // signal is automatically provided by React Query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Prevent extremely high page numbers that cause slow queries
      const MAX_OFFSET = 10000;
      const currentOffset = (currentPage - 1) * pageSize;
      if (currentOffset > MAX_OFFSET) {
        toast.error('Page number too high', {
          description: 'Please use search or filters to narrow down results.'
        });
        setCurrentPage(1);
        throw new Error('Page number too high');
      }
      
      // Use the new database function with p_filter parameter
      // Note: Supabase JS client doesn't fully support AbortSignal yet,
      // but React Query will still cancel on component unmount/key change
      const { data: searchData, error: searchError, count } = await supabase
        .rpc('search_shipments', {
          search_term: debouncedSearch.trim() || null,
          p_show_date: showDateFilter || null,
          p_printed: null, // Keep for backward compatibility
          p_filter: filter, // NEW: Pass filter to SQL for server-side filtering
          p_limit: pageSize,
          p_offset: (currentPage - 1) * pageSize
        });

      if (searchError) throw searchError;

      return { shipments: searchData || [] };
    },
    enabled: showDateFilter !== undefined || allowAllShows, // Wait for auto-selected date OR explicit "All Shows"
    staleTime: 60000, // Increased from 30s to 60s
    gcTime: 15 * 60 * 1000, // Increased from 5min to 15min
  });

  // Separate query for aggregate stats (counts all records, not just current page)
  // PHASE 2: Lazy stats loading - only loads when enabled, with manual refresh button
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['shipments-stats', showDateFilter, filter], // Removed debouncedSearch for instant filter updates
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_shipments_stats', {
          search_term: search.trim() || null, // Use instant search (no debounce) for filters
          p_show_date: showDateFilter || null,
          p_printed: null,
          p_filter: filter,
        })
        .single();

      if (error) throw error;
      return data;
    },
    enabled: (showDateFilter !== undefined || allowAllShows) && statsEnabled, // Wait for date + manual enable
    staleTime: 600000, // 10 minutes (5x longer cache)
    gcTime: 60 * 60 * 1000, // 60 minutes (2x longer retention)
  });

  // No local state needed - data comes from React Query cache only

  // OPTIMIZATION: Prefetch next page for instant pagination
  useEffect(() => {
    if (!shipmentsResponse) return;
    
    const totalPages = Math.max(1, Math.ceil((statsData?.total || 0) / pageSize));
    const nextPage = currentPage + 1;
    
    // Only prefetch if there's a next page
    if (nextPage <= totalPages) {
      queryClient.prefetchQuery({
        queryKey: ['shipments', nextPage, filter, showDateFilter, debouncedSearch, pageSize],
        queryFn: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const currentOffset = (nextPage - 1) * pageSize;
          
          const { data: searchData, error: searchError, count } = await supabase
            .rpc('search_shipments', {
              search_term: debouncedSearch.trim() || null,
              p_show_date: showDateFilter || null,
              p_printed: null,
              p_filter: filter,
              p_limit: pageSize,
              p_offset: currentOffset
            });

          if (searchError) throw searchError;

          return { shipments: searchData || [] };
        },
        staleTime: 60000,
      });
    }
  }, [shipmentsResponse, currentPage, filter, showDateFilter, debouncedSearch, pageSize, queryClient]);

  // Phase 5: Optimistic mutation for location ID
  const updateLocationMutation = useMutation({
    mutationFn: async ({ shipmentId, newLocationId }: { shipmentId: string; newLocationId: string }) => {
      const { error } = await supabase
        .from('shipments')
        .update({ location_id: newLocationId })
        .eq('id', shipmentId);
      
      if (error) throw error;
      return { shipmentId, newLocationId };
    },
    onMutate: async ({ shipmentId, newLocationId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['shipments'] });
      
      // Optimistically update UI
      const previousShipments = queryClient.getQueryData(['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize]);
      
      queryClient.setQueryData(
        ['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            shipments: old.shipments.map((s: Shipment) =>
              s.id === shipmentId ? { ...s, location_id: newLocationId } : s
            )
          };
        }
      );
      
      return { previousShipments };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousShipments) {
        queryClient.setQueryData(
          ['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize],
          context.previousShipments
        );
      }
      toast.error('Failed to update location');
    },
    onSuccess: () => {
      toast.success('Location updated');
    }
  });

  // Phase 5: Optimistic mutation for UID
  const updateUidMutation = useMutation({
    mutationFn: async ({ shipmentId, newUid }: { shipmentId: string; newUid: string }) => {
      const { error } = await supabase
        .from('shipments')
        .update({ uid: newUid })
        .eq('id', shipmentId);
      
      if (error) throw error;
      return { shipmentId, newUid };
    },
    onMutate: async ({ shipmentId, newUid }) => {
      await queryClient.cancelQueries({ queryKey: ['shipments'] });
      
      const previousShipments = queryClient.getQueryData(['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize]);
      
      queryClient.setQueryData(
        ['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            shipments: old.shipments.map((s: Shipment) =>
              s.id === shipmentId ? { ...s, uid: newUid } : s
            )
          };
        }
      );
      
      return { previousShipments };
    },
    onError: (error, variables, context) => {
      if (context?.previousShipments) {
        queryClient.setQueryData(
          ['shipments', currentPage, filter, showDateFilter, debouncedSearch, pageSize],
          context.previousShipments
        );
      }
      toast.error('Failed to update UID');
    },
    onSuccess: () => {
      toast.success('UID updated');
    }
  });

  const handleLocationIdChange = async (shipmentId: string, newLocationId: string) => {
    // Clear editing state
    const { [shipmentId]: _, ...rest } = editingLocationIds;
    setEditingLocationIds(rest);
    
    // Use optimistic mutation
    updateLocationMutation.mutate({ shipmentId, newLocationId });
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

    // Use optimistic mutation
    updateUidMutation.mutate({ shipmentId, newUid: trimmedUid });
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

      // Invalidate cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      
      toast.success(`Printed label for ${shipment.uid}`);

      // Print pick list for Label Only orders
      if (isLabelOnlyOrder(shipment)) {
        try {
          let pickListData: PickListData;

          if (shipment.order_group_id) {
            // Bundle: Fetch all items in this order group
            const { data: bundleItems, error: bundleError } = await supabase
              .from('shipments')
              .select('product_name, uid, quantity, buyer, tracking, order_id')
              .eq('order_group_id', shipment.order_group_id);

            if (bundleError) throw bundleError;

            pickListData = {
              buyer: shipment.buyer || 'Unknown',
              tracking: shipment.tracking || 'No tracking',
              order_id: bundleItems?.map(i => i.order_id).join(', ') || shipment.order_id,
              items: bundleItems?.map(item => ({
                product_name: item.product_name || 'Unknown',
                uid: item.uid || 'N/A',
                quantity: item.quantity || 1
              })) || []
            };
          } else {
            // Single item
            pickListData = {
              buyer: shipment.buyer || 'Unknown',
              tracking: shipment.tracking || 'No tracking',
              order_id: shipment.order_id,
              items: [{
                product_name: shipment.product_name || 'Unknown',
                uid: shipment.uid || 'N/A',
                quantity: shipment.quantity || 1
              }]
            };
          }

          const pickListJob = createPickListPrintJob(
            parseInt(settings.default_printer_id),
            pickListData
          );

          await submitPrintJob(printnodeApiKey, pickListJob);
          console.log('✓ Printed pick list for Label Only order');
        } catch (pickListError: any) {
          console.error('Failed to print pick list:', pickListError);
          toast.error('Label printed but pick list failed', {
            description: pickListError.message
          });
        }
      }
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

      // Invalidate cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

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
      .map(id => shipmentsResponse?.shipments.find(s => s.id === id))
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
    const printedPickLists = new Set<string>(); // Track which order_group_ids have had pick lists printed

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

        // Invalidate cache to refetch updated data
        await queryClient.invalidateQueries({ queryKey: ['shipments'] });

        // Print pick list for Label Only orders
        if (representative && isLabelOnlyOrder(representative)) {
          try {
            // Determine if this is a bundle or single item
            const orderGroupId = representative.order_group_id;
            
            // Avoid printing duplicate pick lists for the same bundle
            if (orderGroupId && printedPickLists.has(orderGroupId)) {
              console.log('✓ Pick list already printed for this bundle');
            } else {
              let pickListData: PickListData;

              if (orderGroupId) {
                // Bundle: Use all items in this group
                pickListData = {
                  buyer: representative.buyer || 'Unknown',
                  tracking: representative.tracking || 'No tracking',
                  order_id: shipmentsInGroup.map(i => i.order_id).join(', '),
                  items: shipmentsInGroup.map(item => ({
                    product_name: item.product_name || 'Unknown',
                    uid: item.uid || 'N/A',
                    quantity: item.quantity || 1
                  }))
                };

                printedPickLists.add(orderGroupId);
              } else {
                // Single item
                pickListData = {
                  buyer: representative.buyer || 'Unknown',
                  tracking: representative.tracking || 'No tracking',
                  order_id: representative.order_id,
                  items: [{
                    product_name: representative.product_name || 'Unknown',
                    uid: representative.uid || 'N/A',
                    quantity: representative.quantity || 1
                  }]
                };
              }

              const pickListJob = createPickListPrintJob(
                parseInt(settings.default_printer_id),
                pickListData
              );

              await submitPrintJob(printnodeApiKey, pickListJob);
              console.log('✓ Printed pick list for Label Only order');
            }
          } catch (pickListError: any) {
            console.error('Failed to print pick list:', pickListError);
            // Don't fail the whole bulk print, just log it
          }
        }

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
      .map(id => shipmentsResponse?.shipments.find(s => s.id === id))
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

      // Invalidate cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

      toast.success(`Marked ${selectedShipments.size} item${selectedShipments.size !== 1 ? 's' : ''} as shipped`);
      setSelectedShipments(new Set());
    } catch (error: any) {
      toast.error('Failed to mark as shipped', { description: error.message });
    } finally {
      setIsBulkPrinting(false);
    }
  };

  // Export handlers
  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .rpc('search_shipments', {
          search_term: '',
          p_show_date: showDateFilter || null,
          p_filter: 'all',
          p_limit: 999999,
          p_offset: 0,
        });

      if (error) throw error;

      exportOrders(data || [], {
        showDate: showDateFilter,
        filter: 'all',
        isFiltered: false,
      });

      toast.success(`Successfully exported ${data?.length || 0} orders`);
    } catch (error: any) {
      toast.error('Failed to export orders', { description: error.message });
    } finally {
      setIsExporting(false);
      setShowExportDialog(false);
    }
  };

  const handleExportFiltered = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .rpc('search_shipments', {
          search_term: debouncedSearch || '',
          p_show_date: showDateFilter || null,
          p_filter: filter,
          p_limit: 999999,
          p_offset: 0,
        });

      if (error) throw error;

      exportOrders(data || [], {
        showDate: showDateFilter,
        filter: filter,
        isFiltered: true,
      });

      toast.success(`Successfully exported ${data?.length || 0} filtered orders`);
    } catch (error: any) {
      toast.error('Failed to export orders', { description: error.message });
    } finally {
      setIsExporting(false);
      setShowExportDialog(false);
    }
  };

  const handleDeleteNoManifest = async () => {
    setIsDeleting(true);
    try {
      let query = supabase
        .from('shipments')
        .delete()
        .or('manifest_url.is.null,manifest_url.eq.');
      
      if (showDateFilter) {
        query = query.eq('show_date', showDateFilter);
      }
      
      const { error } = await query;
      if (error) throw error;
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['shipments-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-show-dates'] });
      
      toast.success('Successfully deleted orders without manifests');
    } catch (error: any) {
      toast.error('Failed to delete orders', { description: error.message });
    } finally {
      setIsDeleting(false);
      setShowDeleteNoManifestDialog(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedShipments.size === 0) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('shipments')
        .delete()
        .in('id', Array.from(selectedShipments));
      
      if (error) throw error;
      
      // Clear selection and refresh
      setSelectedShipments(new Set());
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['shipments-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-show-dates'] });
      
      toast.success(`Successfully deleted ${selectedShipments.size} order(s)`);
    } catch (error: any) {
      toast.error('Failed to delete orders', { description: error.message });
    } finally {
      setIsDeleting(false);
      setShowDeleteSelectedDialog(false);
    }
  };

  // REMOVED: Client-side filtering now handled in SQL via p_filter parameter

  // Stats calculation using aggregate query from database
  const stats = useMemo(() => {
    if (statsData) {
      return {
        total: Number(statsData.total) || 0,
        printed: Number(statsData.printed) || 0,
        unprinted: Number(statsData.unprinted) || 0,
        exceptions: Number(statsData.exceptions) || 0,
      };
    }
    
    // Default empty stats if query hasn't loaded yet
    return { total: 0, printed: 0, unprinted: 0, exceptions: 0 };
  }, [statsData]);

  // Pagination - Use totalCount from database and current page's shipments
  const totalCount = stats.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedShipments = shipmentsResponse?.shipments || [];

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          {filter === 'all' ? 'All Orders' : 
           filter === 'unprinted' ? 'Active Orders' : 
           filter === 'printed' ? 'Completed Orders' :
           filter === 'bundled' ? 'Bundled Orders' : 
           'Exception Orders'}
        </h1>
        <div className="flex gap-2 items-center">
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
          <Button
            size="icon"
            variant="ghost"
            onClick={() => refetchStats()}
            disabled={statsLoading}
            title="Refresh stats"
            className="h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowExportDialog(true)}
            disabled={isExporting || loading}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>
          {isAdmin && stats.exceptions > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteNoManifestDialog(true)}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete No Manifest ({stats.exceptions})
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Input
            placeholder="Search by UID, Order ID, Buyer, Tracking, Location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
          {loading && debouncedSearch && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
          <ShowDateFilter
            selectedDate={showDateFilter}
            recentDates={recentShowDates || []}
            onDateSelect={setShowDateFilter}
            onAllShowsEnable={() => setAllowAllShows(true)}
          />
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="printed">Printed</SelectItem>
            <SelectItem value="unprinted">Unprinted</SelectItem>
            <SelectItem value="bundled">Bundled Items</SelectItem>
            <SelectItem value="incomplete_bundles">Incomplete Bundles</SelectItem>
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
          {isAdmin && (
            <Button 
              variant="destructive"
              onClick={() => setShowDeleteSelectedDialog(true)}
              disabled={isBulkPrinting || isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedShipments.size})
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => setSelectedShipments(new Set())}
            disabled={isBulkPrinting}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] sticky left-0 bg-background z-20 border-r">
                <Checkbox
                  checked={paginatedShipments.length > 0 && paginatedShipments.every(s => selectedShipments.has(s.id))}
                  onCheckedChange={toggleSelectAll}
                  disabled={isBulkPrinting}
                />
              </TableHead>
              <TableHead className="w-[100px] sticky left-[60px] bg-background z-20 border-r">Actions</TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.uid }}>
                <span>Order Details</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('uid', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.bundleId }}>
                <span>Bundle ID</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('bundleId', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.location }}>
                <span>Location & Buyer</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('location', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.product }}>
                <span>Product</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('product', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.shipping }}>
                <span>Shipping</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('shipping', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.status }}>
                <span>Status</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('status', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.showDate }}>
                <span>Show Date & Price</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('showDate', e.clientX)}
                />
              </TableHead>
              <TableHead className="relative group" style={{ width: columnWidths.printHistory }}>
                <span>Print History</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => handleResizeStart('printHistory', e.clientX)}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                {[...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="sticky left-0 bg-background z-10 border-r"><Skeleton className="h-5 w-5" /></TableCell>
                    <TableCell className="sticky left-[60px] bg-background z-10 border-r">
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.uid }}>
                      <div className="space-y-1.5">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.bundleId }}>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell style={{ width: columnWidths.location }}>
                      <div className="space-y-1.5">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.product }}>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.shipping }}>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.status }}>
                      <div className="space-y-1.5">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.showDate }}>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </TableCell>
                    <TableCell style={{ width: columnWidths.printHistory }}>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : paginatedShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
                  {/* Checkbox */}
                  <TableCell className="sticky left-0 bg-background z-10 border-r">
                    <Checkbox
                      checked={selectedShipments.has(shipment.id)}
                      onCheckedChange={() => toggleSelectShipment(shipment.id)}
                      disabled={isBulkPrinting}
                      className="h-5 w-5"
                    />
                  </TableCell>

                  {/* Actions - Larger buttons for touchscreen */}
                  <TableCell className="sticky left-[60px] bg-background z-10 border-r">
                    <Button
                      size="sm"
                      onClick={() => handlePrint(shipment)}
                      disabled={!shipment.manifest_url || printing === shipment.id}
                      className="h-9 text-sm px-3 touch-manipulation"
                    >
                      <Printer className="h-4 w-4 mr-1.5" />
                      {printing === shipment.id ? 'Printing...' : shipment.printed ? 'Reprint' : 'Print'}
                    </Button>
                  </TableCell>

                  {/* Order Details - UID (editable) and Order ID only */}
                  <TableCell style={{ width: columnWidths.uid }}>
                    <div className="space-y-1">
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
                        className="h-9 text-sm font-mono font-semibold"
                      />
                      <div className="text-xs text-muted-foreground">
                        <div className="font-mono break-all">Order: <HighlightText text={shipment.order_id} searchTerm={debouncedSearch} /></div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Bundle ID - Separate column */}
                  <TableCell style={{ width: columnWidths.bundleId }}>
                    {shipment.order_group_id && (
                      <div 
                        className="font-mono text-sm break-all cursor-pointer hover:text-primary hover:underline" 
                        title={`Click to search bundle: ${shipment.order_group_id}`}
                        onClick={() => {
                          setSearch(shipment.order_group_id);
                          setFilter('all');
                        }}
                      >
                        <HighlightText text={shipment.order_group_id} searchTerm={debouncedSearch} />
                      </div>
                    )}
                    {shipment.bundle && (
                      <Badge variant="secondary" className="mt-1 text-xs">Bundle</Badge>
                    )}
                  </TableCell>

                  {/* Location & Buyer Stack */}
                  <TableCell style={{ width: columnWidths.location }}>
                    <div className="space-y-1">
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
                          } else if (e.key === 'Escape') {
                            const { [shipment.id]: _, ...rest } = editingLocationIds;
                            setEditingLocationIds(rest);
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="Location"
                        className="h-9 text-sm"
                      />
                      <div className="text-xs text-muted-foreground break-words" title={shipment.buyer || ''}>
                        <HighlightText text={shipment.buyer || '-'} searchTerm={debouncedSearch} />
                      </div>
                    </div>
                  </TableCell>

                  {/* Product */}
                  <TableCell style={{ width: columnWidths.product }}>
                    <div>
                      <div className="font-medium text-sm break-words" title={shipment.product_name}><HighlightText text={shipment.product_name} searchTerm={debouncedSearch} /></div>
                      <div className="text-xs text-muted-foreground">Qty: {shipment.quantity || 1}</div>
                    </div>
                  </TableCell>

                  {/* Shipping Stack - Tracking + Address */}
                  <TableCell style={{ width: columnWidths.shipping }}>
                    <div className="space-y-1">
                      <div className="font-mono text-xs break-all" title={shipment.tracking || ''}>
                        <HighlightText text={shipment.tracking || '-'} searchTerm={debouncedSearch} />
                      </div>
                      <div className="text-xs text-muted-foreground break-words" title={shipment.address_full || ''}>
                        <HighlightText text={shipment.address_full || '-'} searchTerm={debouncedSearch} />
                      </div>
                    </div>
                  </TableCell>

                  {/* Status Stack - Bundle, Cancelled, Printed status */}
                  <TableCell style={{ width: columnWidths.status }}>
                    <div className="space-y-1.5">
                      {shipment.bundle && (
                        <Badge variant="default" className="text-xs">Bundle</Badge>
                      )}
                      {shipment.cancelled && (
                        <Badge variant="destructive" className="text-xs">Cancelled</Badge>
                      )}
                      {!shipment.manifest_url ? (
                        <Badge variant="destructive" className="text-xs">No Manifest</Badge>
                      ) : shipment.printed ? (
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs">Printed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <XCircle className="h-3 w-3" />
                          <span className="text-xs">Unprinted</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Show Date & Price Stack */}
                  <TableCell style={{ width: columnWidths.showDate }}>
                    <div className="space-y-1">
                      <div className="text-xs">{shipment.show_date || '-'}</div>
                      <div className="text-xs text-muted-foreground">{shipment.price || '-'}</div>
                    </div>
                  </TableCell>

                  <TableCell style={{ width: columnWidths.printHistory }}>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {shipment.printed_at && (
                        <div className="break-words" title={`Printed: ${format(new Date(shipment.printed_at), 'MMM d, HH:mm')}`}>
                          <span className="font-medium">Printed:</span> {format(new Date(shipment.printed_at), 'MMM d, HH:mm')}
                        </div>
                      )}
                      {shipment.group_id_printed_at && (
                        <div className="break-words" title={`Group: ${format(new Date(shipment.group_id_printed_at), 'MMM d, HH:mm')}`}>
                          <span className="font-medium">Group:</span> {format(new Date(shipment.group_id_printed_at), 'MMM d, HH:mm')}
                        </div>
                      )}
                      {!shipment.printed_at && !shipment.group_id_printed_at && '-'}
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
            Showing {startIndex + 1} to {Math.min(endIndex, totalCount)} of {totalCount} total
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

      {/* Export Confirmation Dialog */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Orders</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>
                <p className="font-medium mb-2">Current Filters:</p>
                <div className="bg-muted p-3 rounded space-y-1 text-sm">
                  <div><strong>Show Date:</strong> {showDateFilter || 'All Shows'}</div>
                  <div><strong>Status Filter:</strong> {filter.charAt(0).toUpperCase() + filter.slice(1)}</div>
                  {debouncedSearch && <div><strong>Search:</strong> "{debouncedSearch}"</div>}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Choose export option:</p>
                <div className="bg-muted/50 p-3 rounded space-y-2 text-sm">
                  <div>
                    <strong>Export All Orders:</strong> All orders for selected date ({stats.total} orders)
                  </div>
                  <div>
                    <strong>Export Filtered Orders:</strong> Only orders matching current filters ({totalCount} orders)
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExporting}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleExportAll}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Export All ({stats.total})
            </Button>
            <AlertDialogAction 
              onClick={handleExportFiltered}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Export Filtered ({totalCount})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete No Manifest Confirmation Dialog */}
      <AlertDialog open={showDeleteNoManifestDialog} onOpenChange={setShowDeleteNoManifestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orders Without Manifest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {stats.exceptions} order{stats.exceptions !== 1 ? 's' : ''} 
              that have no manifest URL{showDateFilter ? ` for the ${format(new Date(showDateFilter), 'MMM d, yyyy')} show` : ''}.
              <br /><br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNoManifest}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Orders'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Confirmation Dialog */}
      <AlertDialog open={showDeleteSelectedDialog} onOpenChange={setShowDeleteSelectedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedShipments.size} selected order{selectedShipments.size !== 1 ? 's' : ''}.
              <br /><br />
              <strong className="text-destructive">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Orders'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
