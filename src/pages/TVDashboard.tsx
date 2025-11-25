import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Activity, Target, TrendingUp, Package, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTVDashboardData } from '@/hooks/useTVDashboardData';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function TVDashboard() {
  const navigate = useNavigate();
  const EST_TIMEZONE = 'America/New_York';
  const [currentTime, setCurrentTime] = useState(() => toZonedTime(new Date(), EST_TIMEZONE));
  const { data, isLoading } = useTVDashboardData(undefined, 30000); // 30 second refresh

  // Update current time every second in EST
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(toZonedTime(new Date(), EST_TIMEZONE));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleExit = () => {
    navigate('/');
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold text-muted-foreground">Loading Dashboard...</div>
      </div>
    );
  }

  const goalPercentage = Math.min(data.goal_percentage, 100);
  const projectedTotal = data.avg_per_hour > 0 
    ? Math.round(data.avg_per_hour * 10) // Assuming 10 working hours
    : data.total_printed;
  
  const timeSinceLastPrint = data.last_print_time
    ? formatDistanceToNow(new Date(data.last_print_time), { addSuffix: true })
    : 'No prints yet';

  const isActive = data.last_hour_count > 0;

  // Format peak hour in 12-hour format with AM/PM
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const chartData = data.hourly_breakdown.map(h => ({
    hour: h.hour,
    count: h.count,
    name: formatHour(h.hour),
  }));

  const averageCount = data.avg_per_hour;

  return (
    <div className="min-h-screen bg-background p-6 overflow-hidden">
      {/* Header with Exit Button */}
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
        <Button 
          variant="outline" 
          size="lg" 
          onClick={handleExit}
          className="gap-2"
        >
          <X className="h-5 w-5" />
          Exit
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {/* Total Printed Today */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Package className="h-5 w-5" />
              Labels Printed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-6xl font-bold text-primary">
              {data.total_printed.toLocaleString()}
            </div>
            {isActive && (
              <div className="mt-2 flex items-center gap-2 text-success">
                <Activity className="h-4 w-4 animate-pulse" />
                <span className="text-lg font-medium">{data.last_hour_count} in last hour</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal Progress */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Target className="h-5 w-5" />
              Daily Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-6xl font-bold" style={{ 
              color: goalPercentage >= 100 ? 'hsl(var(--success))' : 
                     goalPercentage >= 75 ? 'hsl(var(--primary))' : 
                     'hsl(var(--warning))'
            }}>
              {goalPercentage.toFixed(0)}%
            </div>
            <Progress value={goalPercentage} className="mt-4 h-3" />
            <p className="text-lg text-muted-foreground mt-2">
              {data.total_printed} / {data.daily_goal.toLocaleString()} labels
            </p>
          </CardContent>
        </Card>

        {/* Average Per Hour */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Hourly Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-6xl font-bold text-accent">
              {data.avg_per_hour.toFixed(1)}
            </div>
            <p className="text-lg text-muted-foreground mt-2">labels per hour</p>
          </CardContent>
        </Card>

        {/* Projected End of Day */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Projected Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-6xl font-bold text-foreground">
              {projectedTotal.toLocaleString()}
            </div>
            <p className="text-lg text-muted-foreground mt-2">
              {projectedTotal >= data.daily_goal ? 'Above goal! 🎉' : `${data.daily_goal - projectedTotal} to goal`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="border-2 mb-6">
        <CardHeader>
          <CardTitle className="text-3xl">Hourly Print Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                className="text-muted-foreground"
                style={{ fontSize: '14px' }}
              />
              <YAxis 
                className="text-muted-foreground"
                style={{ fontSize: '14px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  fontSize: '16px'
                }}
              />
              <ReferenceLine 
                y={averageCount} 
                stroke="hsl(var(--accent))" 
                strokeDasharray="3 3"
                label={{ 
                  value: `Avg: ${averageCount.toFixed(1)}`, 
                  position: 'right',
                  fill: 'hsl(var(--accent))',
                  fontSize: 16
                }}
              />
              <Bar 
                dataKey="count" 
                fill="hsl(var(--primary))" 
                name="Labels Printed"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Zap className="h-12 w-12 text-accent" />
              <div>
                <p className="text-lg text-muted-foreground">Peak Hour</p>
                <p className="text-4xl font-bold text-foreground">
                  {formatHour(data.peak_hour.hour)}
                </p>
                <p className="text-lg text-muted-foreground">{data.peak_hour.count} labels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Package className="h-12 w-12 text-warning" />
              <div>
                <p className="text-lg text-muted-foreground">Remaining Unprinted</p>
                <p className="text-4xl font-bold text-foreground">
                  {data.unprinted_count.toLocaleString()}
                </p>
                <p className="text-lg text-muted-foreground">upcoming orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-12 w-12 text-primary" />
              <div>
                <p className="text-lg text-muted-foreground">Last Print</p>
                <p className="text-2xl font-bold text-foreground">
                  {timeSinceLastPrint}
                </p>
                {isActive && (
                  <div className="flex items-center gap-1 text-success mt-1">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm">Active</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
