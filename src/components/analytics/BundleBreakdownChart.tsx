import { useMemo } from 'react';
import { Shipment } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BundleBreakdownChartProps {
  shipments: Shipment[];
}

const COLORS = {
  bundled: 'hsl(var(--accent))',
  nonBundled: 'hsl(var(--primary))',
};

export function BundleBreakdownChart({ shipments }: BundleBreakdownChartProps) {
  const chartData = useMemo(() => {
    const bundled = shipments.filter(s => s.bundle).length;
    const nonBundled = shipments.filter(s => !s.bundle).length;

    return [
      { name: 'Bundled', value: bundled, color: COLORS.bundled },
      { name: 'Non-Bundled', value: nonBundled, color: COLORS.nonBundled },
    ].filter(item => item.value > 0);
  }, [shipments]);

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
          innerRadius={60}
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
