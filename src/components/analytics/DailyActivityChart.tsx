import { useMemo } from 'react';
import { PrintJob } from '@/types';
import { format, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DailyActivityChartProps {
  printJobs: PrintJob[];
}

export function DailyActivityChart({ printJobs }: DailyActivityChartProps) {
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string; count: number }>();

    printJobs.forEach((job) => {
      const date = format(parseISO(job.created_at), 'yyyy-MM-dd');
      const existing = dataMap.get(date) || { date, count: 0 };
      existing.count++;
      dataMap.set(date, existing);
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [printJobs]);

  if (chartData.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tickFormatter={(value) => format(parseISO(value), 'MMM d')}
          className="text-muted-foreground"
        />
        <YAxis className="text-muted-foreground" />
        <Tooltip 
          labelFormatter={(value) => format(parseISO(value as string), 'MMM d, yyyy')}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" name="Print Jobs" />
      </BarChart>
    </ResponsiveContainer>
  );
}
