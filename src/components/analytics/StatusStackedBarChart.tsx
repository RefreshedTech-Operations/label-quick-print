import { useMemo } from 'react';
import { Shipment } from '@/types';
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

interface StatusStackedBarChartProps {
  shipments: Shipment[];
}

export function StatusStackedBarChart({ shipments }: StatusStackedBarChartProps) {
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string; printed: number; unprinted: number; cancelled: number }>();

    shipments.forEach((shipment) => {
      const date = format(parseISO(shipment.created_at), 'yyyy-MM-dd');
      const existing = dataMap.get(date) || { date, printed: 0, unprinted: 0, cancelled: 0 };
      
      if (shipment.cancelled && shipment.cancelled.toLowerCase() === 'yes') {
        existing.cancelled++;
      } else if (shipment.printed) {
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
