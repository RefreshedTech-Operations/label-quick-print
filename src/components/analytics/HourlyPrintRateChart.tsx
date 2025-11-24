import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface HourlyData {
  hour: number;
  print_count: number;
}

interface HourlyPrintRateChartProps {
  hourlyData: HourlyData[];
}

export function HourlyPrintRateChart({ hourlyData }: HourlyPrintRateChartProps) {
  const chartData = hourlyData.map(d => ({
    hour: d.hour,
    count: Number(d.print_count),
    label: formatHour(d.hour),
  }));

  const average = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length
    : 0;

  if (chartData.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <div>
      <div className="mb-2 text-sm text-muted-foreground">
        Average: <span className="font-semibold text-foreground">{average.toFixed(1)} prints/hour</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="label"
            className="text-muted-foreground"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis className="text-muted-foreground" />
          <Tooltip 
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <ReferenceLine 
            y={average} 
            stroke="hsl(var(--muted-foreground))" 
            strokeDasharray="3 3"
            label={{ value: 'Avg', position: 'right', fill: 'hsl(var(--muted-foreground))' }}
          />
          <Bar 
            dataKey="count" 
            fill="hsl(var(--primary))" 
            name="Labels Printed"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}
