import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shipment, PrintJob } from '@/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

// Optimized columns for analytics (excludes heavy 'raw' JSONB column)
const SHIPMENT_COLUMNS = 'id, created_at, printed, bundle, cancelled, order_id, uid, buyer, tracking, product_name, quantity, printed_at, user_id';
const PRINT_JOB_COLUMNS = 'id, created_at, status, printer_id, order_id, uid';

async function fetchPaginatedShipments(dateRange: DateRange): Promise<Shipment[]> {
  if (!dateRange.from || !dateRange.to) return [];
  
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('shipments')
      .select(SHIPMENT_COLUMNS)
      .gte('created_at', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching shipments:', error);
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allData as Shipment[];
}

async function fetchPaginatedPrintJobs(dateRange: DateRange): Promise<PrintJob[]> {
  if (!dateRange.from || !dateRange.to) return [];
  
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('print_jobs')
      .select(PRINT_JOB_COLUMNS)
      .gte('created_at', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching print jobs:', error);
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allData as PrintJob[];
}

export function useAnalyticsData(dateRange: DateRange) {
  // Fetch shipments with optimized columns
  const { data: shipments = [], isLoading: shipmentsLoading } = useQuery({
    queryKey: ['analytics-shipments', dateRange.from, dateRange.to],
    queryFn: () => fetchPaginatedShipments(dateRange),
    enabled: !!dateRange.from && !!dateRange.to,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch print jobs with optimized columns
  const { data: printJobs = [], isLoading: printJobsLoading } = useQuery({
    queryKey: ['analytics-printjobs', dateRange.from, dateRange.to],
    queryFn: () => fetchPaginatedPrintJobs(dateRange),
    enabled: !!dateRange.from && !!dateRange.to,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = shipmentsLoading || printJobsLoading;

  const kpis = useMemo(() => {
    const totalOrders = shipments.length;
    const printedOrders = shipments.filter(s => s.printed).length;
    const bundleOrders = shipments.filter(s => s.bundle).length;
    const cancelledOrders = shipments.filter(s => s.cancelled && s.cancelled.toLowerCase() === 'yes').length;

    const totalPrintJobs = printJobs.length;
    const successfulPrints = printJobs.filter(j => j.status === 'done').length;

    return {
      totalOrders,
      printedOrders,
      printedPercentage: totalOrders > 0 ? ((printedOrders / totalOrders) * 100).toFixed(1) : '0',
      bundleOrders,
      bundlePercentage: totalOrders > 0 ? ((bundleOrders / totalOrders) * 100).toFixed(1) : '0',
      cancelledOrders,
      cancelledPercentage: totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0',
      totalPrintJobs,
      successfulPrints,
      printSuccessRate: totalPrintJobs > 0 ? ((successfulPrints / totalPrintJobs) * 100).toFixed(1) : '0',
    };
  }, [shipments, printJobs]);

  return { shipments, printJobs, isLoading, kpis };
}
