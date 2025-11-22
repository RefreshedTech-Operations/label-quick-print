import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format, parse } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";

const EST_TIMEZONE = "America/New_York";

interface ShowDateFilterProps {
  selectedDate?: string; // 'yyyy-MM-dd' format
  recentDates: Array<{ date: string; count: number }>;
  onDateSelect: (date: string | undefined) => void;
  onAllShowsEnable?: () => void; // Callback to enable "All Shows" mode
}

export function ShowDateFilter({ selectedDate, recentDates, onDateSelect, onAllShowsEnable }: ShowDateFilterProps) {
  const handleAllDatesClick = () => {
    onAllShowsEnable?.(); // Enable "All Shows" mode
    onDateSelect(undefined);
  };
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onDateSelect(undefined);
      return;
    }
    // Format date in EST timezone as yyyy-MM-dd
    const dateStr = formatInTimeZone(date, EST_TIMEZONE, "yyyy-MM-dd");
    onDateSelect(dateStr);
  };

  const handleTodayClick = () => {
    // Get current date in EST timezone
    const now = new Date();
    const estDate = toZonedTime(now, EST_TIMEZONE);
    const dateStr = formatInTimeZone(estDate, EST_TIMEZONE, "yyyy-MM-dd");
    onDateSelect(dateStr);
  };

  const selectedDateObj = selectedDate 
    ? parse(selectedDate, "yyyy-MM-dd", new Date()) 
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-sm font-medium text-foreground">Show Date:</div>
      
      {/* All Dates Button */}
      <Button
        variant={!selectedDate ? "default" : "outline"}
        size="sm"
        onClick={handleAllDatesClick}
      >
        All Dates
      </Button>

      {/* Today Button */}
      <Button
        variant={selectedDate === formatInTimeZone(toZonedTime(new Date(), EST_TIMEZONE), EST_TIMEZONE, "yyyy-MM-dd") ? "default" : "outline"}
        size="sm"
        onClick={handleTodayClick}
      >
        Today
      </Button>

      {/* Recent Show Dates */}
      {recentDates.map(({ date, count }) => (
        <Button
          key={date}
          variant={selectedDate === date ? "default" : "outline"}
          size="sm"
          onClick={() => onDateSelect(date)}
        >
          {format(parse(date, "yyyy-MM-dd", new Date()), "MMM d")} ({count.toLocaleString()})
        </Button>
      ))}

      {/* Custom Date Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <CalendarIcon className="h-4 w-4" />
            Custom Date
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDateObj}
            onSelect={handleDateSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

    </div>
  );
}
