import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailyData {
  date: string;
  total_orders: number;
  printed_orders: number;
  unprinted_orders: number;
}

interface OrdersTimelineChartProps {
  dailyData: DailyData[];
}

export function OrdersTimelineChart({ dailyData }: OrdersTimelineChartProps) {
  const chartData = dailyData.map(d => ({
    date: d.date,
    total: Number(d.total_orders),
    printed: Number(d.printed_orders),
    unprinted: Number(d.unprinted_orders),
  }));

  if (chartData.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
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
        <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" name="Total Orders" strokeWidth={2} />
        <Line type="monotone" dataKey="printed" stroke="hsl(var(--success))" name="Printed" strokeWidth={2} />
        <Line type="monotone" dataKey="unprinted" stroke="hsl(var(--warning))" name="Unprinted" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
