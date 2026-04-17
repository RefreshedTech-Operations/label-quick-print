import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, differenceInMilliseconds } from 'date-fns';

export type AnalyticsPeriod = 'today' | 'last7';

export interface AnalyticsOverview {
  kpis: {
    printed: number;
    printed_prev: number;
    packed: number;
    packed_prev: number;
    backlog: number;
    throughput_per_hr: number;
  };
  hourly: { hour: number; printed: number; packed: number }[];
  printer_leaderboard: { name: string; count: number }[];
  packer_leaderboard: { name: string; count: number; stations: string[] }[];
  funnel: { uploaded: number; printed: number; packed: number; shipped: number };
  exceptions: { open_issues: number; cancelled: number; stale_unpacked: number };
}

function getPeriodRange(period: AnalyticsPeriod): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  if (period === 'today') {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const prevStart = startOfDay(subDays(now, 1));
    const prevEnd = endOfDay(subDays(now, 1));
    return { start, end, prevStart, prevEnd };
  }
  // last7
  const end = endOfDay(now);
  const start = startOfDay(subDays(now, 6));
  const span = differenceInMilliseconds(end, start);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return { start, end, prevStart, prevEnd };
}

export function useAnalyticsOverview(period: AnalyticsPeriod, userId?: string | null) {
  const { start, end, prevStart, prevEnd } = getPeriodRange(period);

  return useQuery({
    queryKey: ['analytics-overview', period, userId, start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_analytics_overview', {
        p_start_ts: start.toISOString(),
        p_end_ts: end.toISOString(),
        p_prev_start_ts: prevStart.toISOString(),
        p_prev_end_ts: prevEnd.toISOString(),
        p_user_id: userId || null,
      } as any);
      if (error) throw error;
      return data as unknown as AnalyticsOverview;
    },
    staleTime: 60 * 1000,
    refetchInterval: period === 'today' ? 60 * 1000 : false,
  });
}
