import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Activity, Target, Package2, Trophy, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { usePackTVDashboardData } from '@/hooks/usePackTVDashboardData';
import { LeaderboardCard } from '@/components/tv-dashboard/LeaderboardCard';

export default function PackTVDashboard() {
  const navigate = useNavigate();
  const { data } = usePackTVDashboardData(new Date(), 30000);

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-12 w-96 bg-muted animate-pulse rounded" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-6 mb-4 grid-cols-2">
          <div className="h-48 bg-muted animate-pulse rounded-lg border-2" />
          <div className="h-48 bg-muted animate-pulse rounded-lg border-2" />
        </div>
        <div className="grid gap-6 grid-cols-2">
          <div className="h-96 bg-muted animate-pulse rounded-lg border-2" />
          <div className="h-96 bg-muted animate-pulse rounded-lg border-2" />
        </div>
      </div>
    );
  }

  const goalPercentage = Math.min(data.goal_percentage, 100);
  const projectedTotal = data.avg_per_hour > 0
    ? Math.round(data.avg_per_hour * 10)
    : data.total_packed;
  const isActive = data.last_hour_count > 0;

  return (
    <div className="min-h-screen bg-background p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-5xl font-bold text-foreground">Packing Dashboard</h1>
        <Button variant="outline" size="lg" onClick={() => navigate('/')} className="gap-2">
          <X className="h-5 w-5" />
          Exit
        </Button>
      </div>

      <div className="grid gap-6 mb-4 grid-cols-2">
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              Packed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-6xl font-bold text-primary">
                  {data.total_packed.toLocaleString()}
                </div>
                <p className="text-lg text-muted-foreground mt-1">packed</p>
              </div>
              <div className="text-3xl text-muted-foreground font-light">/</div>
              <div>
                <div className="text-6xl font-bold text-muted-foreground">
                  {data.unpacked_count.toLocaleString()}
                </div>
                <p className="text-lg text-muted-foreground mt-1">backlog</p>
              </div>
            </div>
            {isActive && (
              <div className="mt-3 flex items-center gap-2 text-success">
                <Activity className="h-4 w-4 animate-pulse" />
                <span className="text-lg font-medium">{data.last_hour_count} in last hour</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Target className="h-5 w-5" />
              Daily Pack Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-6">
              <div>
                <div className="text-6xl font-bold" style={{
                  color: goalPercentage >= 100 ? 'hsl(var(--success))' :
                         goalPercentage >= 75 ? 'hsl(var(--primary))' :
                         'hsl(var(--warning))'
                }}>
                  {goalPercentage.toFixed(0)}%
                </div>
                <p className="text-lg text-muted-foreground mt-1">
                  {data.total_packed} / {data.daily_goal.toLocaleString()}
                </p>
              </div>
              <div className="border-l border-border pl-6">
                <div className="text-4xl font-bold text-foreground">
                  {projectedTotal.toLocaleString()}
                </div>
                <p className="text-lg text-muted-foreground mt-1">
                  projected {projectedTotal >= data.daily_goal ? '🎉' : `(${data.daily_goal - projectedTotal} short)`}
                </p>
              </div>
            </div>
            <Progress value={goalPercentage} className="mt-4 h-3" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-2">
        <LeaderboardCard title="Top Packers" entries={data.packer_leaderboard} icon={Trophy} emptyMessage="No packs yet today" />
        <LeaderboardCard title="Top Stations" entries={data.station_leaderboard} icon={MapPin} emptyMessage="No stations active today" />
      </div>
    </div>
  );
}
