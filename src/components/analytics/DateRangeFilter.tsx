import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export function DateRangeFilter({ dateRange, setDateRange }: DateRangeFilterProps) {
  const presets = [
    { label: 'Today', range: { from: new Date(), to: new Date() } },
    { label: 'Yesterday', range: { from: subDays(new Date(), 1), to: subDays(new Date(), 1) } },
    { label: 'Last 7 days', range: { from: subDays(new Date(), 7), to: new Date() } },
    { label: 'Last 30 days', range: { from: subDays(new Date(), 30), to: new Date() } },
    { label: 'Last 90 days', range: { from: subDays(new Date(), 90), to: new Date() } },
    { label: 'This month', range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } },
    { label: 'Last month', range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Date Range:</span>
      
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => setDateRange(preset.range)}
          className={cn(
            dateRange.from &&
            dateRange.to &&
            format(dateRange.from, 'yyyy-MM-dd') === format(preset.range.from, 'yyyy-MM-dd') &&
            format(dateRange.to, 'yyyy-MM-dd') === format(preset.range.to, 'yyyy-MM-dd') &&
            'bg-primary text-primary-foreground'
          )}
        >
          {preset.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {dateRange.from && dateRange.to ? (
              <>
                {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
              </>
            ) : (
              'Custom Range'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => range && setDateRange(range)}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
