import { cn } from '@/lib/utils';

interface WorkflowFunnelProps {
  funnel: { uploaded: number; printed: number; packed: number; shipped: number };
}

export function WorkflowFunnel({ funnel }: WorkflowFunnelProps) {
  const stages = [
    { key: 'uploaded', label: 'Uploaded', value: funnel.uploaded, color: 'bg-muted' },
    { key: 'printed', label: 'Printed', value: funnel.printed, color: 'bg-primary' },
    { key: 'packed', label: 'Packed', value: funnel.packed, color: 'bg-green-600 dark:bg-green-500' },
    { key: 'shipped', label: 'Shipped', value: funnel.shipped, color: 'bg-blue-600 dark:bg-blue-500' },
  ];
  const max = Math.max(funnel.uploaded, 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const widthPct = (stage.value / max) * 100;
        const prev = idx > 0 ? stages[idx - 1].value : null;
        const conv = prev !== null && prev > 0 ? ((stage.value / prev) * 100).toFixed(1) : null;
        return (
          <div key={stage.key} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{stage.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono">{stage.value.toLocaleString('en-US')}</span>
                {conv !== null && (
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {conv}% from prev
                  </span>
                )}
              </div>
            </div>
            <div className="h-7 w-full rounded bg-muted/40 overflow-hidden">
              <div
                className={cn('h-full transition-all', stage.color)}
                style={{ width: `${Math.max(widthPct, stage.value > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
