import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { KPICard } from '@/components/analytics/KPICard';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { DailyActivityChart } from '@/components/analytics/DailyActivityChart';
import { StatusStackedBarChart } from '@/components/analytics/StatusStackedBarChart';
import { PrintStatusPieChart } from '@/components/analytics/PrintStatusPieChart';
import { PrinterPerformanceChart } from '@/components/analytics/PrinterPerformanceChart';
import { HourlyPrintRateChart } from '@/components/analytics/HourlyPrintRateChart';

export default function Analytics() {
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch employees (profiles)
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

  const effectiveDateRange: DateRange | undefined = mode === 'single'
    ? { from: singleDate, to: singleDate }
    : dateRange;

  const { isLoading, kpis, dailyData, printerData, printStatusData, hourlyData } =
    useAnalyticsData(effectiveDateRange, selectedUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Detailed reporting and KPI breakdown</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'range')}>
            <TabsList className="mb-4">
              <TabsTrigger value="single">Single Day</TabsTrigger>
              <TabsTrigger value="range">Date Range</TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(singleDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={singleDate}
                    onSelect={(date) => date && setSingleDate(date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </TabsContent>

            <TabsContent value="range">
              <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
            </TabsContent>
          </Tabs>

          {/* Employee Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Employee:</span>
            <Select
              value={selectedUserId || 'all'}
              onValueChange={(v) => setSelectedUserId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[250px]">
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
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <KPICard title="Total Orders" value={kpis.totalOrders} />
            <KPICard title="Printed" value={kpis.printedOrders} description={`${kpis.printedPercentage}%`} />
            <KPICard title="Unprinted" value={kpis.unprintedOrders} />
            <KPICard title="Bundles" value={kpis.bundleOrders} description={`${kpis.bundlePercentage}%`} />
            <KPICard title="Cancelled" value={kpis.cancelledOrders} description={`${kpis.cancelledPercentage}%`} />
            <KPICard title="Print Jobs" value={kpis.totalPrintJobs} />
            <KPICard title="Success Rate" value={`${kpis.printSuccessRate}%`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Daily Activity</CardTitle></CardHeader>
              <CardContent><DailyActivityChart dailyData={dailyData} /></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader>
              <CardContent><StatusStackedBarChart dailyData={dailyData} /></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Print Status</CardTitle></CardHeader>
              <CardContent><PrintStatusPieChart printStatusData={printStatusData} /></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Printer Performance</CardTitle></CardHeader>
              <CardContent><PrinterPerformanceChart printerData={printerData} /></CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Hourly Print Rate</CardTitle></CardHeader>
              <CardContent><HourlyPrintRateChart hourlyData={hourlyData} /></CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
