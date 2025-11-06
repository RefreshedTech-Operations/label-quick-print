import { useMemo } from 'react';
import { PrintJob } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PrintStatusPieChartProps {
  printJobs: PrintJob[];
}

const COLORS = {
  completed: 'hsl(var(--success))',
  queued: 'hsl(var(--warning))',
  error: 'hsl(var(--destructive))',
};

export function PrintStatusPieChart({ printJobs }: PrintStatusPieChartProps) {
  const chartData = useMemo(() => {
    const completed = printJobs.filter(j => j.status === 'done').length;
    const queued = printJobs.filter(j => j.status === 'queued').length;
    const error = printJobs.filter(j => j.status === 'error').length;

    return [
      { name: 'Completed', value: completed, color: COLORS.completed },
      { name: 'Queued', value: queued, color: COLORS.queued },
      { name: 'Failed', value: error, color: COLORS.error },
    ].filter(item => item.value > 0);
  }, [printJobs]);

  if (chartData.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
