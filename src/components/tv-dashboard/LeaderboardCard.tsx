import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface LeaderboardEntry { label: string; count: number; }

interface LeaderboardCardProps {
  title: string;
  entries: LeaderboardEntry[];
  icon?: LucideIcon;
  emptyMessage?: string;
}

export function LeaderboardCard({ title, entries, icon: Icon = Trophy, emptyMessage = 'No data yet today' }: LeaderboardCardProps) {
  const maxCount = entries.length > 0 ? entries[0].count : 1;

  return (
    <Card className="border-2 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Icon className="h-6 w-6 text-warning" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto max-h-[340px]">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-lg text-center py-8">{emptyMessage}</p>
        ) : (
          entries.map((entry, index) => {
            const percentage = Math.round((entry.count / maxCount) * 100);
            const rank = index + 1;
            return (
              <div key={`${entry.label}-${index}`} className="flex items-center gap-3">
                <div className="w-8 text-center shrink-0">
                  {rank === 1 ? <span className="text-2xl">🥇</span>
                    : rank === 2 ? <span className="text-2xl">🥈</span>
                    : rank === 3 ? <span className="text-2xl">🥉</span>
                    : <span className="text-lg font-bold text-muted-foreground">{rank}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-base font-semibold truncate ${rank === 1 ? 'text-warning' : 'text-foreground'}`}>
                      {entry.label}
                    </span>
                    <span className="text-lg font-bold text-primary ml-2 shrink-0">
                      {entry.count.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
