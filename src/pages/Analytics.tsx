import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { KPICard } from '@/components/analytics/KPICard';
import { OrdersTimelineChart } from '@/components/analytics/OrdersTimelineChart';
import { PrintStatusPieChart } from '@/components/analytics/PrintStatusPieChart';
import { StatusStackedBarChart } from '@/components/analytics/StatusStackedBarChart';
import { DailyActivityChart } from '@/components/analytics/DailyActivityChart';
import { BundleBreakdownChart } from '@/components/analytics/BundleBreakdownChart';
import { PrinterPerformanceChart } from '@/components/analytics/PrinterPerformanceChart';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { exportFilteredOrders, exportPrintJobs, exportSummaryReport } from '@/lib/analyticsExport';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { shipments, printJobs, isLoading, kpis } = useAnalyticsData(dateRange);

  const handleExport = (type: 'orders' | 'printJobs' | 'summary') => {
    if (type === 'orders') {
      exportFilteredOrders(shipments, dateRange);
    } else if (type === 'printJobs') {
      exportPrintJobs(printJobs, dateRange);
    } else {
      exportSummaryReport(kpis, dateRange);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics & Reports</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('orders')}>
              Export Orders ({shipments.length})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('printJobs')}>
              Export Print Jobs ({printJobs.length})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('summary')}>
              Export Summary Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />

      {/* KPI Cards - Show immediately when data loads */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <KPICard
              title="Total Orders"
              value={kpis.totalOrders}
              description={`${kpis.printedPercentage}% printed`}
            />
            <KPICard
              title="Print Success Rate"
              value={`${kpis.printSuccessRate}%`}
              description={`${kpis.successfulPrints} of ${kpis.totalPrintJobs} jobs`}
            />
            <KPICard
              title="Bundle Orders"
              value={kpis.bundleOrders}
              description={`${kpis.bundlePercentage}% of total`}
            />
            <KPICard
              title="Cancelled Orders"
              value={kpis.cancelledOrders}
              description={`${kpis.cancelledPercentage}% of total`}
            />
          </>
        )}
      </div>

      {/* Charts - Show loading states individually */}
      {isLoading ? (
        <div className="space-y-6">
          <p className="text-muted-foreground text-center">Loading charts...</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-48 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Orders Over Time</CardTitle>
                <CardDescription>Daily order volume and print status</CardDescription>
              </CardHeader>
              <CardContent>
                <OrdersTimelineChart shipments={shipments} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Print Job Status</CardTitle>
                <CardDescription>Distribution of print job outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <PrintStatusPieChart printJobs={printJobs} />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Orders by Status</CardTitle>
                <CardDescription>Daily breakdown of order status</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusStackedBarChart shipments={shipments} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Print Activity</CardTitle>
                <CardDescription>Number of labels printed per day</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyActivityChart printJobs={printJobs} />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bundle Distribution</CardTitle>
                <CardDescription>Bundled vs non-bundled orders</CardDescription>
              </CardHeader>
              <CardContent>
                <BundleBreakdownChart shipments={shipments} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Printer Performance</CardTitle>
                <CardDescription>Top printers by volume</CardDescription>
              </CardHeader>
              <CardContent>
                <PrinterPerformanceChart printJobs={printJobs} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
