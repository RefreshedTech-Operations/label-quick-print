import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LeaderboardEntry {
  email: string;
  count: number;
}

interface PrinterLeaderboardProps {
  leaderboard: LeaderboardEntry[];
}

function extractUsername(email: string): string {
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function PrinterLeaderboard({ leaderboard }: PrinterLeaderboardProps) {
  const maxCount = leaderboard.length > 0 ? leaderboard[0].count : 1;

  return (
    <Card className="border-2 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          Printer Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto max-h-[340px]">
        {leaderboard.length === 0 ? (
          <p className="text-muted-foreground text-lg text-center py-8">No prints yet today</p>
        ) : (
          leaderboard.map((entry, index) => {
            const percentage = Math.round((entry.count / maxCount) * 100);
            const rank = index + 1;

            return (
              <div key={entry.email} className="flex items-center gap-3">
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  {rank === 1 ? (
                    <span className="text-2xl">🥇</span>
                  ) : rank === 2 ? (
                    <span className="text-2xl">🥈</span>
                  ) : rank === 3 ? (
                    <span className="text-2xl">🥉</span>
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">{rank}</span>
                  )}
                </div>

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className={`text-base font-semibold truncate ${rank === 1 ? 'text-yellow-500' : 'text-foreground'}`}>
                      {extractUsername(entry.email)}
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
