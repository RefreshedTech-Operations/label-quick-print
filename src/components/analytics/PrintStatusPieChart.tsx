import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PrintStatusData {
  status: string;
  count: number;
}

interface PrintStatusPieChartProps {
  printStatusData: PrintStatusData[];
}

const COLORS = {
  completed: 'hsl(var(--success))',
  queued: 'hsl(var(--warning))',
  error: 'hsl(var(--destructive))',
};

export function PrintStatusPieChart({ printStatusData }: PrintStatusPieChartProps) {
  const chartData = printStatusData.map(item => {
    const statusLower = item.status.toLowerCase();
    let name = item.status;
    let color = COLORS.completed;
    
    if (statusLower === 'done') {
      name = 'Completed';
      color = COLORS.completed;
    } else if (statusLower === 'queued') {
      name = 'Queued';
      color = COLORS.queued;
    } else if (statusLower === 'error') {
      name = 'Failed';
      color = COLORS.error;
    }
    
    return { 
      name, 
      value: Number(item.count), 
      color 
    };
  }).filter(item => item.value > 0);

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
