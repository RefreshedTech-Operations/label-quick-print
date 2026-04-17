import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface HourlyDualChartProps {
  data: { hour: number; printed: number; packed: number }[];
}

export function HourlyDualChart({ data }: HourlyDualChartProps) {
  const formatted = data.map(d => ({
    ...d,
    label: `${d.hour === 0 ? 12 : d.hour > 12 ? d.hour - 12 : d.hour}${d.hour < 12 ? 'a' : 'p'}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
        <Bar dataKey="printed" fill="hsl(var(--primary))" name="Printed" radius={[2, 2, 0, 0]} />
        <Bar dataKey="packed" fill="hsl(var(--chart-2, 142 76% 36%))" name="Packed" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
