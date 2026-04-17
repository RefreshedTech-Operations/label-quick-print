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
  v_unprinted bigint;
  v_last_hour bigint;
  v_last_print timestamptz;
  v_avg numeric;
  v_peak_hour integer;
  v_peak_count bigint;
  v_hourly jsonb;
  v_leaderboard jsonb;
  range_start timestamptz;
  range_end timestamptz;
BEGIN
  SELECT COALESCE(value::integer, 1000) INTO daily_goal
  FROM app_config WHERE key = 'daily_print_goal' LIMIT 1;
  IF daily_goal IS NULL THEN daily_goal := 1000; END IF;

  range_start := (target_date::timestamp AT TIME ZONE 'America/New_York');
  range_end   := ((target_date + 1)::timestamp AT TIME ZONE 'America/New_York');

  WITH base AS (
    SELECT
      s.printed_at,
      s.printed_by_user_id,
      EXTRACT(HOUR FROM s.printed_at AT TIME ZONE 'America/New_York')::int AS hr
    FROM shipments s
    WHERE s.printed = true
      AND s.printed_at >= range_start
      AND s.printed_at <  range_end
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE printed_at >= NOW() - INTERVAL '1 hour')::bigint AS last_hour,
      MAX(printed_at) AS last_print,
      COUNT(DISTINCT hr) FILTER (WHERE hr BETWEEN 8 AND 18) AS working_hours
    FROM base
  ),
  hourly_agg AS (
    SELECT hr, COUNT(*)::bigint AS cnt FROM base GROUP BY hr
  ),
  hourly_full AS (
    SELECT h.hour, COALESCE(ha.cnt, 0) AS cnt
    FROM generate_series(0,23) AS h(hour)
    LEFT JOIN hourly_agg ha ON ha.hr = h.hour
  ),
  peak AS (
    SELECT hr, COUNT(*)::bigint AS cnt
    FROM base GROUP BY hr ORDER BY cnt DESC LIMIT 1
  ),
  leaderboard AS (
    SELECT p.email, COUNT(*)::bigint AS cnt
    FROM base b
    JOIN profiles p ON p.id = b.printed_by_user_id
    WHERE b.printed_by_user_id IS NOT NULL
    GROUP BY p.email
    ORDER BY cnt DESC
    LIMIT 20
  )
  SELECT
    a.total,
    a.last_hour,
    a.last_print,
    CASE WHEN a.working_hours > 0 THEN ROUND(a.total::numeric / a.working_hours, 1) ELSE 0 END,
    COALESCE(pk.hr, 0),
    COALESCE(pk.cnt, 0),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hour, 'count', cnt) ORDER BY hour), '[]'::jsonb) FROM hourly_full),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('email', email, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) FROM leaderboard)
  INTO v_total_printed, v_last_hour, v_last_print, v_avg, v_peak_hour, v_peak_count, v_hourly, v_leaderboard
  FROM agg a LEFT JOIN peak pk ON true;

  SELECT COUNT(*) INTO v_unprinted
  FROM shipments WHERE printed = false OR printed IS NULL;

  result := jsonb_build_object(
    'total_printed', COALESCE(v_total_printed, 0),
    'daily_goal', daily_goal,
    'hourly_breakdown', COALESCE(v_hourly, '[]'::jsonb),
    'last_hour_count', COALESCE(v_last_hour, 0),
    'unprinted_count', COALESCE(v_unprinted, 0),
    'avg_per_hour', COALESCE(v_avg, 0),
    'peak_hour', jsonb_build_object('hour', v_peak_hour, 'count', v_peak_count),
    'last_print_time', v_last_print,
    'goal_percentage', CASE WHEN daily_goal > 0 THEN ROUND((COALESCE(v_total_printed,0)::numeric / daily_goal * 100), 1) ELSE 0 END,
    'printer_leaderboard', COALESCE(v_leaderboard, '[]'::jsonb)
  );

  RETURN result;
END;
$function$;