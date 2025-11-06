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
        // Fetch all shipments with pagination (1000 rows at a time)
        let allShipments: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: shipmentsData, error: shipmentsError } = await supabase
            .from('shipments')
            .select('*')
            .gte('created_at', format(dateRange.from, 'yyyy-MM-dd'))
            .lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59')
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (shipmentsError) {
            console.error('Error fetching shipments:', shipmentsError);
            break;
          }

          if (shipmentsData && shipmentsData.length > 0) {
            allShipments = [...allShipments, ...shipmentsData];
            hasMore = shipmentsData.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        // Fetch all print jobs with pagination (1000 rows at a time)
        let allPrintJobs: any[] = [];
        page = 0;
        hasMore = true;

        while (hasMore) {
          const { data: printJobsData, error: printJobsError } = await supabase
            .from('print_jobs')
            .select('*')
            .gte('created_at', format(dateRange.from, 'yyyy-MM-dd'))
            .lte('created_at', format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59')
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (printJobsError) {
            console.error('Error fetching print jobs:', printJobsError);
            break;
          }

          if (printJobsData && printJobsData.length > 0) {
            allPrintJobs = [...allPrintJobs, ...printJobsData];
            hasMore = printJobsData.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        setShipments(allShipments as Shipment[]);
        setPrintJobs(allPrintJobs as PrintJob[]);
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
