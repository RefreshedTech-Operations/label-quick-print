
-- Drop the old 2-parameter overloads (no p_user_id)
DROP FUNCTION IF EXISTS public.get_analytics_kpis(timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_daily_analytics(date, date);
DROP FUNCTION IF EXISTS public.get_printer_performance(timestamp with time zone, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS public.get_print_status_breakdown(timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_hourly_print_rate(timestamp with time zone, timestamp with time zone);
