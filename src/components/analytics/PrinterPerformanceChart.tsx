import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PrinterData {
  printer_id: string;
  job_count: number;
}

interface PrinterPerformanceChartProps {
  printerData: PrinterData[];
}

export function PrinterPerformanceChart({ printerData }: PrinterPerformanceChartProps) {
  const chartData = printerData.map(d => ({
    printer: d.printer_id,
    count: Number(d.job_count),
  }));

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
