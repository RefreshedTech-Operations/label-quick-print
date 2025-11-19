import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

interface DailyAnalytics {
  date: string;
  total_orders: number;
  printed_orders: number;
  unprinted_orders: number;
  cancelled_orders: number;
  bundle_orders: number;
  print_jobs_count: number;
}

interface PrinterPerformance {
  printer_id: string;
  job_count: number;
}

interface PrintStatusBreakdown {
  status: string;
  count: number;
}

export function useAnalyticsData(dateRange: DateRange) {
  // Fetch KPIs using server-side aggregation
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics-kpis', dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) return null;
      
      const { data, error } = await supabase.rpc('get_analytics_kpis', {
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59',
      });

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!dateRange.from && !!dateRange.to,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch daily analytics for charts
  const { data: dailyData = [], isLoading: dailyLoading } = useQuery<DailyAnalytics[]>({
    queryKey: ['analytics-daily', dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) return [];
      
      const { data, error } = await supabase.rpc('get_daily_analytics', {
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59',
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!dateRange.from && !!dateRange.to,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch printer performance data
  const { data: printerData = [], isLoading: printerLoading } = useQuery<PrinterPerformance[]>({
    queryKey: ['analytics-printers', dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) return [];
      
      const { data, error } = await supabase.rpc('get_printer_performance', {
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59',
        top_limit: 10,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!dateRange.from && !!dateRange.to,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch print status breakdown
  const { data: printStatusData = [], isLoading: printStatusLoading } = useQuery<PrintStatusBreakdown[]>({
    queryKey: ['analytics-print-status', dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!dateRange.from || !dateRange.to) return [];
      
      const { data, error } = await supabase.rpc('get_print_status_breakdown', {
        start_date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59',
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!dateRange.from && !!dateRange.to,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = kpisLoading || dailyLoading || printerLoading || printStatusLoading;

  const kpis = kpisData ? {
    totalOrders: Number(kpisData.total_orders),
    printedOrders: Number(kpisData.printed_orders),
    printedPercentage: kpisData.total_orders > 0 
      ? ((Number(kpisData.printed_orders) / Number(kpisData.total_orders)) * 100).toFixed(1) 
      : '0',
    bundleOrders: Number(kpisData.bundle_orders),
    bundlePercentage: kpisData.total_orders > 0 
      ? ((Number(kpisData.bundle_orders) / Number(kpisData.total_orders)) * 100).toFixed(1) 
      : '0',
    cancelledOrders: Number(kpisData.cancelled_orders),
    cancelledPercentage: kpisData.total_orders > 0 
      ? ((Number(kpisData.cancelled_orders) / Number(kpisData.total_orders)) * 100).toFixed(1) 
      : '0',
    totalPrintJobs: Number(kpisData.total_print_jobs),
    successfulPrints: Number(kpisData.successful_prints),
    printSuccessRate: kpisData.total_print_jobs > 0 
      ? ((Number(kpisData.successful_prints) / Number(kpisData.total_print_jobs)) * 100).toFixed(1) 
      : '0',
  } : {
    totalOrders: 0,
    printedOrders: 0,
    printedPercentage: '0',
    bundleOrders: 0,
    bundlePercentage: '0',
    cancelledOrders: 0,
    cancelledPercentage: '0',
    totalPrintJobs: 0,
    successfulPrints: 0,
    printSuccessRate: '0',
  };

  return { 
    isLoading, 
    kpis,
    dailyData,
    printerData,
    printStatusData,
  };
}
