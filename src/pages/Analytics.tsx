import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsOverview, type AnalyticsPeriod } from '@/hooks/useAnalyticsOverview';
import { KPIStatCard } from '@/components/analytics/KPIStatCard';
import { HourlyDualChart } from '@/components/analytics/HourlyDualChart';
import { EmployeeLeaderboardTable } from '@/components/analytics/EmployeeLeaderboardTable';
import { WorkflowFunnel } from '@/components/analytics/WorkflowFunnel';
import { ExceptionsPanel } from '@/components/analytics/ExceptionsPanel';

export default function Analytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('today');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('disabled', false)
        .order('email');
      if (error) throw error;
      return data || [];
    },
  });

  const { data, isLoading } = useAnalyticsOverview(period, selectedUserId);

  const peakHour = useMemo(() => {
    if (!data?.hourly?.length) return null;
    const peak = [...data.hourly].sort((a, b) => (b.printed + b.packed) - (a.printed + a.packed))[0];
    if (!peak || (peak.printed + peak.packed) === 0) return null;
    const h = peak.hour;
    const display = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'AM' : 'PM'}`;
    return { display, total: peak.printed + peak.packed };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Operations health & employee productivity</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="last7">Last 7 Days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={selectedUserId || 'all'}
            onValueChange={(v) => setSelectedUserId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.email?.split('@')[0] || emp.email || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          {/* Section 1: Operations Health */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPIStatCard
              title="Labels Printed"
              value={data.kpis.printed}
              prevValue={data.kpis.printed_prev}
            />
            <KPIStatCard
              title="Orders Packed"
              value={data.kpis.packed}
              prevValue={data.kpis.packed_prev}
            />
            <KPIStatCard
              title="Pack Backlog"
              value={data.kpis.backlog}
              showDelta={false}
              hint="Printed but not packed (live)"
            />
            <KPIStatCard
              title="Avg Throughput"
              value={data.kpis.throughput_per_hr}
              suffix="labels/hr"
              showDelta={false}
              hint="Across selected period"
            />
          </div>

          {/* Section 2: Today at a Glance */}
          {period === 'today' && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Today by the Hour</CardTitle>
                  {peakHour && (
                    <div className="text-sm text-muted-foreground">
                      Peak: <span className="font-medium text-foreground">{peakHour.display}</span> ({peakHour.total} events)
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <HourlyDualChart data={data.hourly} />
              </CardContent>
            </Card>
          )}

          {/* Section 3: Employee Productivity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Top Printers</CardTitle></CardHeader>
              <CardContent>
                <EmployeeLeaderboardTable
                  entries={data.printer_leaderboard}
                  countLabel="Labels"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Packers</CardTitle></CardHeader>
              <CardContent>
                <EmployeeLeaderboardTable
                  entries={data.packer_leaderboard}
                  countLabel="Packed"
                  showStations
                />
              </CardContent>
            </Card>
          </div>

          {/* Section 4: Workflow Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowFunnel funnel={data.funnel} />
            </CardContent>
          </Card>

          {/* Section 5: Exceptions */}
          <ExceptionsPanel exceptions={data.exceptions} />
        </>
      )}
    </div>
  );
}
