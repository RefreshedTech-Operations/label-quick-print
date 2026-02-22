import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Activity, Target, TrendingUp, Package, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTVDashboardData } from '@/hooks/useTVDashboardData';
import { Progress } from '@/components/ui/progress';
import { PrinterLeaderboard } from '@/components/tv-dashboard/PrinterLeaderboard';
import { formatDistanceToNow, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const formatHour = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
};

export default function TVDashboard() {
  const navigate = useNavigate();
  const EST_TIMEZONE = 'America/New_York';
  const [currentTime, setCurrentTime] = useState(() => toZonedTime(new Date(), EST_TIMEZONE));
  const { data, isLoading } = useTVDashboardData(undefined, 30000);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(toZonedTime(new Date(), EST_TIMEZONE));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold text-muted-foreground">Loading Dashboard...</div>
      </div>
    );
  }

  const goalPercentage = Math.min(data.goal_percentage, 100);
  const projectedTotal = data.avg_per_hour > 0 
    ? Math.round(data.avg_per_hour * 10)
    : data.total_printed;
  
  const timeSinceLastPrint = data.last_print_time
    ? formatDistanceToNow(new Date(data.last_print_time), { addSuffix: true })
    : 'No prints yet';

  const isActive = data.last_hour_count > 0;

  const chartData = data.hourly_breakdown.map(h => ({
    hour: h.hour,
    count: h.count,
    name: formatHour(h.hour),
  }));

  return (
    <div className="min-h-screen bg-background p-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-5xl font-bold text-foreground">Label Printing Dashboard</h1>
          <p className="text-2xl text-muted-foreground mt-2">
            {format(currentTime, 'EEEE, MMMM d, yyyy')}
            {' • '}
            {format(currentTime, 'hh:mm:ss a')}
            {' EST'}
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={() => navigate('/')} className="gap-2">
          <X className="h-5 w-5" />
          Exit
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        {/* Labels Printed + Unprinted */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Package className="h-5 w-5" />
              Labels Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-6xl font-bold text-primary">
                  {data.total_printed.toLocaleString()}
                </div>
                <p className="text-lg text-muted-foreground mt-1">printed</p>
              </div>
              <div className="text-3xl text-muted-foreground font-light">/</div>
              <div>
                <div className="text-6xl font-bold text-muted-foreground">
                  {data.unprinted_count.toLocaleString()}
                </div>
                <p className="text-lg text-muted-foreground mt-1">unprinted</p>
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

        {/* Daily Goal + Projected */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Target className="h-5 w-5" />
              Daily Goal
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
                  {data.total_printed} / {data.daily_goal.toLocaleString()}
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

      {/* Compact Stats Strip */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <Badge variant="secondary" className="text-base px-4 py-2 gap-2">
          <Zap className="h-4 w-4" />
          Peak Hour: {data.peak_hour ? formatHour(data.peak_hour.hour) : 'N/A'}
          {data.peak_hour ? ` (${data.peak_hour.count} labels)` : ''}
        </Badge>
        <Badge variant="secondary" className="text-base px-4 py-2 gap-2">
          <Package className="h-4 w-4" />
          Unprinted: {data.unprinted_count.toLocaleString()}
        </Badge>
        <Badge variant="secondary" className="text-base px-4 py-2 gap-2">
          <Clock className="h-4 w-4" />
          Last Print: {timeSinceLastPrint}
          {isActive && (
            <span className="inline-flex items-center gap-1 ml-1 text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse inline-block" />
              Active
            </span>
          )}
        </Badge>
      </div>

      {/* Chart + Leaderboard Row */}
      <div className="grid grid-cols-5 gap-6">
        {/* Chart - 3/5 width */}
        <Card className="border-2 col-span-3">
          <CardHeader>
            <CardTitle className="text-3xl">Hourly Print Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-muted-foreground" style={{ fontSize: '14px' }} />
                <YAxis className="text-muted-foreground" style={{ fontSize: '14px' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '16px' }} />
                <ReferenceLine 
                  y={data.avg_per_hour} 
                  stroke="hsl(var(--accent))" 
                  strokeDasharray="3 3"
                  label={{ value: `Avg: ${data.avg_per_hour.toFixed(1)}`, position: 'right', fill: 'hsl(var(--accent))', fontSize: 16 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Labels Printed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leaderboard - 2/5 width */}
        <div className="col-span-2">
          <PrinterLeaderboard leaderboard={data.printer_leaderboard} />
        </div>
      </div>
    </div>
  );
}
