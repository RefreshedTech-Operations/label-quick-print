import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface HourlyData { hour: number; count: number; }
interface PeakHourData { hour: number; count: number; }
interface LeaderboardEntry { label: string; count: number; }

export interface PackTVDashboardData {
  total_packed: number;
  daily_goal: number;
  hourly_breakdown: HourlyData[];
  last_hour_count: number;
  unpacked_count: number;
  avg_per_hour: number;
  peak_hour: PeakHourData;
  last_pack_time: string | null;
  goal_percentage: number;
  packer_leaderboard: LeaderboardEntry[];
  station_leaderboard: LeaderboardEntry[];
}

export function usePackTVDashboardData(targetDate?: Date, refreshInterval = 30000) {
  const dateString = format(targetDate ?? new Date(), 'yyyy-MM-dd');

  return useQuery<PackTVDashboardData>({
    queryKey: ['pack-tv-dashboard', dateString],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pack_tv_dashboard_stats', {
        target_date: dateString,
      });
      if (error) throw error;
      if (!data) throw new Error('No data returned');
      const r = data as any;
      return {
        total_packed: Number(r.total_packed ?? 0),
        daily_goal: Number(r.daily_goal ?? 1000),
        hourly_breakdown: (r.hourly_breakdown as HourlyData[]) ?? [],
        last_hour_count: Number(r.last_hour_count ?? 0),
        unpacked_count: Number(r.unpacked_count ?? 0),
        avg_per_hour: Number(r.avg_per_hour ?? 0),
        peak_hour: r.peak_hour as PeakHourData,
        last_pack_time: r.last_pack_time as string | null,
        goal_percentage: Number(r.goal_percentage ?? 0),
        packer_leaderboard: (r.packer_leaderboard as LeaderboardEntry[]) ?? [],
        station_leaderboard: (r.station_leaderboard as LeaderboardEntry[]) ?? [],
      };
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
    refetchOnWindowFocus: true,
    staleTime: 25_000,
    placeholderData: keepPreviousData,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
