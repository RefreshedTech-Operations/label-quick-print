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

interface LeaderboardEntry {
  email: string;
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
  printer_leaderboard: LeaderboardEntry[];
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
      
      if (!data) throw new Error('No data returned');
      
      const result = data as any;
      
      return {
        total_printed: Number(result.total_printed ?? 0),
        daily_goal: Number(result.daily_goal ?? 1000),
        hourly_breakdown: (result.hourly_breakdown as HourlyData[]) ?? [],
        last_hour_count: Number(result.last_hour_count ?? 0),
        unprinted_count: Number(result.unprinted_count ?? 0),
        avg_per_hour: Number(result.avg_per_hour ?? 0),
        peak_hour: result.peak_hour as PeakHourData | null,
        last_print_time: result.last_print_time as string | null,
        goal_percentage: Number(result.goal_percentage ?? 0),
        printer_leaderboard: (result.printer_leaderboard as LeaderboardEntry[]) ?? [],
      } as TVDashboardData;
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
