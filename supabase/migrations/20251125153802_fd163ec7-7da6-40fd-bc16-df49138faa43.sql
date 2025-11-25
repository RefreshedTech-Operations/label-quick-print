-- Create RPC function for TV Dashboard statistics
CREATE OR REPLACE FUNCTION public.get_tv_dashboard_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  total_printed bigint;
  hourly_breakdown jsonb;
  last_hour_count bigint;
  unprinted_count bigint;
  avg_per_hour numeric;
  peak_hour_data jsonb;
  last_print_time timestamp with time zone;
  daily_goal integer;
BEGIN
  -- Get daily goal from app_config
  SELECT COALESCE(value::integer, 1000)
  INTO daily_goal
  FROM app_config
  WHERE key = 'daily_print_goal'
  LIMIT 1;

  -- Total prints today
  SELECT COUNT(*)
  INTO total_printed
  FROM shipments
  WHERE printed = true
    AND DATE(printed_at) = target_date
    AND printed_at IS NOT NULL;

  -- Hourly breakdown
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour', hour,
      'count', COALESCE(count, 0)
    ) ORDER BY hour
  )
  INTO hourly_breakdown
  FROM (
    SELECT h.hour, COUNT(s.id) as count
    FROM generate_series(0, 23) AS h(hour)
    LEFT JOIN shipments s ON 
      EXTRACT(HOUR FROM s.printed_at)::integer = h.hour
      AND DATE(s.printed_at) = target_date
      AND s.printed = true
      AND s.printed_at IS NOT NULL
    GROUP BY h.hour
  ) hourly_data;

  -- Prints in last hour
  SELECT COUNT(*)
  INTO last_hour_count
  FROM shipments
  WHERE printed = true
    AND printed_at >= NOW() - INTERVAL '1 hour'
    AND printed_at IS NOT NULL;

  -- Unprinted count for upcoming show dates
  SELECT COUNT(*)
  INTO unprinted_count
  FROM shipments
  WHERE (printed = false OR printed IS NULL)
    AND show_date >= CURRENT_DATE
    AND show_date IS NOT NULL;

  -- Calculate average per hour (for working hours)
  SELECT CASE 
    WHEN COUNT(*) > 0 THEN total_printed::numeric / COUNT(DISTINCT EXTRACT(HOUR FROM printed_at))
    ELSE 0
  END
  INTO avg_per_hour
  FROM shipments
  WHERE printed = true
    AND DATE(printed_at) = target_date
    AND printed_at IS NOT NULL
    AND EXTRACT(HOUR FROM printed_at) BETWEEN 8 AND 18;

  -- Find peak hour
  SELECT jsonb_build_object(
    'hour', COALESCE(hour, 0),
    'count', COALESCE(count, 0)
  )
  INTO peak_hour_data
  FROM (
    SELECT 
      EXTRACT(HOUR FROM printed_at)::integer as hour,
      COUNT(*) as count
    FROM shipments
    WHERE printed = true
      AND DATE(printed_at) = target_date
      AND printed_at IS NOT NULL
    GROUP BY EXTRACT(HOUR FROM printed_at)
    ORDER BY count DESC
    LIMIT 1
  ) peak;

  -- Last print time
  SELECT MAX(printed_at)
  INTO last_print_time
  FROM shipments
  WHERE printed = true
    AND printed_at IS NOT NULL;

  -- Build result
  result := jsonb_build_object(
    'total_printed', total_printed,
    'daily_goal', daily_goal,
    'hourly_breakdown', hourly_breakdown,
    'last_hour_count', last_hour_count,
    'unprinted_count', unprinted_count,
    'avg_per_hour', ROUND(avg_per_hour, 1),
    'peak_hour', peak_hour_data,
    'last_print_time', last_print_time,
    'goal_percentage', CASE 
      WHEN daily_goal > 0 THEN ROUND((total_printed::numeric / daily_goal * 100), 1)
      ELSE 0
    END
  );

  RETURN result;
END;
$function$;

-- Insert default daily goal if not exists
INSERT INTO app_config (key, value)
VALUES ('daily_print_goal', '1000')
ON CONFLICT (key) DO NOTHING;