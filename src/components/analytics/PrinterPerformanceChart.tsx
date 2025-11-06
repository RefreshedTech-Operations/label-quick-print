import { useMemo } from 'react';
import { PrintJob } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PrinterPerformanceChartProps {
  printJobs: PrintJob[];
}

export function PrinterPerformanceChart({ printJobs }: PrinterPerformanceChartProps) {
  const chartData = useMemo(() => {
    const printerMap = new Map<string, number>();

    printJobs.forEach((job) => {
      if (job.printer_id) {
        printerMap.set(job.printer_id, (printerMap.get(job.printer_id) || 0) + 1);
      }
    });

    return Array.from(printerMap.entries())
      .map(([printer, count]) => ({ printer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [printJobs]);

  if (chartData.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" className="text-muted-foreground" />
        <YAxis 
          dataKey="printer" 
          type="category" 
          width={100}
          className="text-muted-foreground"
        />
        <Tooltip 
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" name="Jobs Printed" />
      </BarChart>
    </ResponsiveContainer>
  );
}
