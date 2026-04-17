import { Card, CardContent } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIStatCardProps {
  title: string;
  value: number | string;
  prevValue?: number;
  suffix?: string;
  hint?: string;
  showDelta?: boolean;
}

export function KPIStatCard({ title, value, prevValue, suffix, hint, showDelta = true }: KPIStatCardProps) {
  const numericValue = typeof value === 'number' ? value : 0;
  const delta = prevValue !== undefined ? numericValue - prevValue : null;
  const deltaPct = prevValue !== undefined && prevValue > 0
    ? ((numericValue - prevValue) / prevValue) * 100
    : null;

  const formatted = typeof value === 'number' ? value.toLocaleString('en-US') : value;

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatted}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {showDelta && delta !== null && (
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-xs font-medium',
              delta > 0 && 'text-green-600 dark:text-green-500',
              delta < 0 && 'text-red-600 dark:text-red-500',
              delta === 0 && 'text-muted-foreground'
            )}
          >
            {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            <span>
              {delta > 0 ? '+' : ''}{delta.toLocaleString('en-US')}
              {deltaPct !== null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%)`}
            </span>
            <span className="text-muted-foreground font-normal">vs prior</span>
          </div>
        )}
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
