import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Ban, Clock } from 'lucide-react';

interface ExceptionsPanelProps {
  exceptions: { open_issues: number; cancelled: number; stale_unpacked: number };
}

export function ExceptionsPanel({ exceptions }: ExceptionsPanelProps) {
  const total = exceptions.open_issues + exceptions.cancelled + exceptions.stale_unpacked;
  if (total === 0) return null;

  const items = [
    { icon: AlertTriangle, label: 'Open Issues', value: exceptions.open_issues, hint: 'Marked has_issue' },
    { icon: Ban, label: 'Cancelled', value: exceptions.cancelled, hint: 'In selected period' },
    { icon: Clock, label: 'Stale Unpacked', value: exceptions.stale_unpacked, hint: 'Printed >48h ago, not packed' },
  ];

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.filter(i => i.value > 0).map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
                <Icon className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <div className="text-2xl font-bold">{item.value.toLocaleString('en-US')}</div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.hint}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
