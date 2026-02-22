import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Activity, Target, Package, CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTVDashboardData } from '@/hooks/useTVDashboardData';
import { Progress } from '@/components/ui/progress';
import { PrinterLeaderboard } from '@/components/tv-dashboard/PrinterLeaderboard';
import { format, isToday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const isViewingToday = isToday(selectedDate);
  const { data, isLoading } = useTVDashboardData(selectedDate, isViewingToday ? 30000 : 0);

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

  const isActive = isViewingToday && data.last_hour_count > 0;

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
          <div className="flex items-center gap-4 mt-2">
            <p className="text-2xl text-muted-foreground">
              {format(currentTime, 'hh:mm:ss a')} EST
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="lg" className="text-xl gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  {!isViewingToday && (
                    <span className="text-sm text-muted-foreground ml-1">(historical)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {!isViewingToday && (
              <Button variant="secondary" size="lg" onClick={() => setSelectedDate(new Date())}>
                Back to Today
              </Button>
            )}
          </div>
        </div>
        <Button variant="outline" size="lg" onClick={() => navigate('/')} className="gap-2">
          <X className="h-5 w-5" />
          Exit
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className={cn("grid gap-6 mb-4", isViewingToday ? "grid-cols-2" : "grid-cols-1")}>
        {/* Labels Printed (+ Unprinted only for today) */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Package className="h-5 w-5" />
              Labels {isViewingToday ? 'Today' : format(selectedDate, 'MMM d')}
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
              {isViewingToday && (
                <>
                  <div className="text-3xl text-muted-foreground font-light">/</div>
                  <div>
                    <div className="text-6xl font-bold text-muted-foreground">
                      {data.unprinted_count.toLocaleString()}
                    </div>
                    <p className="text-lg text-muted-foreground mt-1">unprinted</p>
                  </div>
                </>
              )}
            </div>
            {isActive && (
              <div className="mt-3 flex items-center gap-2 text-success">
                <Activity className="h-4 w-4 animate-pulse" />
                <span className="text-lg font-medium">{data.last_hour_count} in last hour</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Goal + Projected (today only) */}
        {isViewingToday && (
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
        )}
      </div>

      {/* Chart + Leaderboard Row */}
      <div className="grid grid-cols-5 gap-6">
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

        <div className="col-span-2">
          <PrinterLeaderboard leaderboard={data.printer_leaderboard} />
        </div>
      </div>
    </div>
  );
}
