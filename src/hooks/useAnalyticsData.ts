import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shipment, PrintJob } from '@/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export function useAnalyticsData(dateRange: DateRange) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange.from || !dateRange.to) return;
      
      setIsLoading(true);

      try {
        // Fetch shipments
        const { data: shipmentsData } = await supabase
          .from('shipments')
          .select('*')
          .gte('created_at', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59')
          .order('created_at', { ascending: false });

        // Fetch print jobs
        const { data: printJobsData } = await supabase
          .from('print_jobs')
          .select('*')
          .gte('created_at', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59')
          .order('created_at', { ascending: false });

        setShipments((shipmentsData || []) as Shipment[]);
        setPrintJobs((printJobsData || []) as PrintJob[]);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

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
