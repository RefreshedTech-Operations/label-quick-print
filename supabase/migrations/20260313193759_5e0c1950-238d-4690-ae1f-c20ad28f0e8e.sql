CREATE OR REPLACE FUNCTION public.get_tv_dashboard_stats(target_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  daily_goal integer;
  v_total_printed bigint;
BEGIN
  -- Get daily goal from app_config
  SELECT COALESCE(value::integer, 1000)
  INTO daily_goal
  FROM app_config
  WHERE key = 'daily_print_goal'
  LIMIT 1;

  IF daily_goal IS NULL THEN
    daily_goal := 1000;
  END IF;

  WITH base AS (
    SELECT s.id, s.printed_at, s.printed_by_user_id
    FROM shipments s
    WHERE s.printed = true
      AND s.printed_at IS NOT NULL
      AND DATE(s.printed_at AT TIME ZONE 'America/New_York') = target_date
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM base
  ),
  hourly AS (
    SELECT
      h.hour,
      COUNT(b.id) AS count
    FROM generate_series(0, 23) AS h(hour)
    LEFT JOIN base b ON EXTRACT(HOUR FROM b.printed_at AT TIME ZONE 'America/New_York')::integer = h.hour
    GROUP BY h.hour
    ORDER BY h.hour
  ),
  last_hour AS (
    SELECT COUNT(*) AS cnt
    FROM base
    WHERE printed_at >= NOW() - INTERVAL '1 hour'
  ),
  unprinted AS (
    SELECT COUNT(*) AS cnt
    FROM shipments
    WHERE printed = false OR printed IS NULL
  ),
  working_hours AS (
    SELECT
      CASE
        WHEN COUNT(DISTINCT EXTRACT(HOUR FROM printed_at AT TIME ZONE 'America/New_York')) > 0
        THEN (SELECT cnt FROM total)::numeric / COUNT(DISTINCT EXTRACT(HOUR FROM printed_at AT TIME ZONE 'America/New_York'))
        ELSE 0
      END AS avg
    FROM base
    WHERE EXTRACT(HOUR FROM printed_at AT TIME ZONE 'America/New_York') BETWEEN 8 AND 18
  ),
  peak AS (
    SELECT
      EXTRACT(HOUR FROM printed_at AT TIME ZONE 'America/New_York')::integer AS hour,
      COUNT(*) AS count
    FROM base
    GROUP BY EXTRACT(HOUR FROM printed_at AT TIME ZONE 'America/New_York')
    ORDER BY count DESC
    LIMIT 1
  ),
  last_print AS (
    SELECT MAX(printed_at) AS last_time FROM shipments WHERE printed = true AND printed_at IS NOT NULL
  ),
  leaderboard AS (
    SELECT p.email, COUNT(*) AS cnt
    FROM base b
    JOIN profiles p ON p.id = b.printed_by_user_id
    WHERE b.printed_by_user_id IS NOT NULL
    GROUP BY p.email
    ORDER BY cnt DESC
  )
  SELECT (SELECT cnt FROM total) INTO v_total_printed;

  result := jsonb_build_object(
    'total_printed', v_total_printed,
    'daily_goal', daily_goal,
    'hourly_breakdown', (SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hour, 'count', count) ORDER BY hour), '[]'::jsonb) FROM hourly),
    'last_hour_count', (SELECT cnt FROM last_hour),
    'unprinted_count', (SELECT cnt FROM unprinted),
    'avg_per_hour', ROUND((SELECT avg FROM working_hours), 1),
    'peak_hour', COALESCE((SELECT jsonb_build_object('hour', hour, 'count', count) FROM peak), jsonb_build_object('hour', 0, 'count', 0)),
    'last_print_time', (SELECT last_time FROM last_print),
    'goal_percentage', CASE WHEN daily_goal > 0 THEN ROUND((v_total_printed::numeric / daily_goal * 100), 1) ELSE 0 END,
    'printer_leaderboard', COALESCE((SELECT jsonb_agg(jsonb_build_object('email', email, 'count', cnt) ORDER BY cnt DESC) FROM leaderboard), '[]'::jsonb)
  );

  RETURN result;
END;
$function$