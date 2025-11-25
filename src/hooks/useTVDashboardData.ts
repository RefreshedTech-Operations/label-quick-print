import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface HourlyData {
  hour: number;
  count: number;
}

interface PeakHourData {
  hour: number;
  count: number;
}

export interface TVDashboardData {
  total_printed: number;
  daily_goal: number;
  hourly_breakdown: HourlyData[];
  last_hour_count: number;
  unprinted_count: number;
  avg_per_hour: number;
  peak_hour: PeakHourData;
  last_print_time: string | null;
  goal_percentage: number;
}

export function useTVDashboardData(targetDate?: Date, refreshInterval = 30000) {
  const dateString = targetDate ? format(targetDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  return useQuery<TVDashboardData>({
    queryKey: ['tv-dashboard', dateString],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tv_dashboard_stats', {
        target_date: dateString,
      });

      if (error) throw error;
      
      // Parse the jsonb response
      if (!data) throw new Error('No data returned');
      
      // Cast to any first to work around jsonb type
      const result = data as any;
      
      return {
        total_printed: Number(result.total_printed),
        daily_goal: Number(result.daily_goal),
        hourly_breakdown: result.hourly_breakdown as HourlyData[],
        last_hour_count: Number(result.last_hour_count),
        unprinted_count: Number(result.unprinted_count),
        avg_per_hour: Number(result.avg_per_hour),
        peak_hour: result.peak_hour as PeakHourData,
        last_print_time: result.last_print_time as string | null,
        goal_percentage: Number(result.goal_percentage),
      } as TVDashboardData;
    },
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: true,
  });
}
