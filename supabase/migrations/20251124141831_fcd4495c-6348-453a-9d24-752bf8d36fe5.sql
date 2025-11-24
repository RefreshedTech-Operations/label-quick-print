-- Create function to get hourly print rate
CREATE OR REPLACE FUNCTION public.get_hourly_print_rate(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE(hour integer, print_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH hours AS (
    SELECT generate_series(0, 23) AS hour
  ),
  prints AS (
    SELECT 
      EXTRACT(HOUR FROM printed_at)::integer as hour,
      COUNT(*)::bigint as count
    FROM shipments
    WHERE printed = true
      AND printed_at IS NOT NULL
      AND printed_at >= start_date
      AND printed_at <= end_date
    GROUP BY EXTRACT(HOUR FROM printed_at)
  )
  SELECT 
    h.hour,
    COALESCE(p.count, 0)::bigint as print_count
  FROM hours h
  LEFT JOIN prints p ON h.hour = p.hour
  ORDER BY h.hour;
END;
$function$