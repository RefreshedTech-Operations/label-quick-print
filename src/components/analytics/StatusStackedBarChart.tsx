import { format, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailyData {
  date: string;
  printed_orders: number;
  unprinted_orders: number;
  cancelled_orders: number;
}

interface StatusStackedBarChartProps {
  dailyData: DailyData[];
}

export function StatusStackedBarChart({ dailyData }: StatusStackedBarChartProps) {
  const chartData = dailyData.map(d => ({
    date: d.date,
    printed: Number(d.printed_orders),
    unprinted: Number(d.unprinted_orders),
    cancelled: Number(d.cancelled_orders),
  }));

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
        <Legend />
        <Bar dataKey="printed" stackId="a" fill="hsl(var(--success))" name="Printed" />
        <Bar dataKey="unprinted" stackId="a" fill="hsl(var(--primary))" name="Unprinted" />
        <Bar dataKey="cancelled" stackId="a" fill="hsl(var(--destructive))" name="Cancelled" />
      </BarChart>
    </ResponsiveContainer>
  );
}
