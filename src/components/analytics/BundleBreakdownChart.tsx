import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DailyData {
  bundle_orders: number;
  total_orders: number;
}

interface BundleBreakdownChartProps {
  dailyData: DailyData[];
}

const COLORS = {
  bundled: 'hsl(var(--accent))',
  nonBundled: 'hsl(var(--primary))',
};

export function BundleBreakdownChart({ dailyData }: BundleBreakdownChartProps) {
  const bundled = dailyData.reduce((sum, d) => sum + Number(d.bundle_orders), 0);
  const total = dailyData.reduce((sum, d) => sum + Number(d.total_orders), 0);
  const nonBundled = total - bundled;

  const chartData = [
    { name: 'Bundled', value: bundled, color: COLORS.bundled },
    { name: 'Non-Bundled', value: nonBundled, color: COLORS.nonBundled },
  ].filter(item => item.value > 0);

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
