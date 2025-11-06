import { useMemo } from 'react';
import { Shipment } from '@/types';
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

interface OrdersTimelineChartProps {
  shipments: Shipment[];
}

export function OrdersTimelineChart({ shipments }: OrdersTimelineChartProps) {
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string; total: number; printed: number; unprinted: number }>();

    shipments.forEach((shipment) => {
      const date = format(parseISO(shipment.created_at), 'yyyy-MM-dd');
      const existing = dataMap.get(date) || { date, total: 0, printed: 0, unprinted: 0 };
      
      existing.total++;
      if (shipment.printed) {
        existing.printed++;
      } else {
        existing.unprinted++;
      }
      
      dataMap.set(date, existing);
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [shipments]);

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
