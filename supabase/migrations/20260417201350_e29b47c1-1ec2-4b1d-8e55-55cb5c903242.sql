-- Default pack goal config (idempotent)
INSERT INTO public.app_config (key, value)
VALUES ('daily_pack_goal', '1000')
ON CONFLICT (key) DO NOTHING;

-- Register new page in role defaults for admin and manager
INSERT INTO public.role_page_defaults (role, page_path)
VALUES ('admin', '/pack-tv-dashboard'), ('manager', '/pack-tv-dashboard')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_pack_tv_dashboard_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  daily_goal integer;
  v_total bigint;
  v_unpacked bigint;
  v_last_hour bigint;
  v_last_pack timestamptz;
  v_avg numeric;
  v_peak_hour integer;
  v_peak_count bigint;
  v_hourly jsonb;
  v_packers jsonb;
  v_stations jsonb;
  range_start timestamptz;
  range_end timestamptz;
BEGIN
  SELECT COALESCE(value::integer, 1000) INTO daily_goal
  FROM app_config WHERE key = 'daily_pack_goal' LIMIT 1;
  IF daily_goal IS NULL THEN daily_goal := 1000; END IF;

  range_start := (target_date::timestamp AT TIME ZONE 'America/New_York');
  range_end   := ((target_date + 1)::timestamp AT TIME ZONE 'America/New_York');

  WITH base AS (
    SELECT
      s.packed_at,
      s.packed_by_name,
      s.pack_station_id,
      EXTRACT(HOUR FROM s.packed_at AT TIME ZONE 'America/New_York')::int AS hr
    FROM shipments s
    WHERE s.packed = true
      AND s.packed_at >= range_start
      AND s.packed_at <  range_end
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE packed_at >= NOW() - INTERVAL '1 hour')::bigint AS last_hour,
      MAX(packed_at) AS last_pack,
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
  packer_lb AS (
    SELECT COALESCE(NULLIF(TRIM(packed_by_name), ''), 'Unknown') AS label, COUNT(*)::bigint AS cnt
    FROM base
    GROUP BY label
    ORDER BY cnt DESC
    LIMIT 20
  ),
  station_lb AS (
    SELECT COALESCE(ps.name, 'Unknown') AS label, COUNT(*)::bigint AS cnt
    FROM base b
    LEFT JOIN pack_stations ps ON ps.id = b.pack_station_id
    GROUP BY label
    ORDER BY cnt DESC
    LIMIT 10
  )
  SELECT
    a.total,
    a.last_hour,
    a.last_pack,
    CASE WHEN a.working_hours > 0 THEN ROUND(a.total::numeric / a.working_hours, 1) ELSE 0 END,
    COALESCE(pk.hr, 0),
    COALESCE(pk.cnt, 0),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hour, 'count', cnt) ORDER BY hour), '[]'::jsonb) FROM hourly_full),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) FROM packer_lb),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) FROM station_lb)
  INTO v_total, v_last_hour, v_last_pack, v_avg, v_peak_hour, v_peak_count, v_hourly, v_packers, v_stations
  FROM agg a LEFT JOIN peak pk ON true;

  SELECT COUNT(*) INTO v_unpacked
  FROM shipments
  WHERE printed = true AND (packed = false OR packed IS NULL);

  result := jsonb_build_object(
    'total_packed', COALESCE(v_total, 0),
    'daily_goal', daily_goal,
    'hourly_breakdown', COALESCE(v_hourly, '[]'::jsonb),
    'last_hour_count', COALESCE(v_last_hour, 0),
    'unpacked_count', COALESCE(v_unpacked, 0),
    'avg_per_hour', COALESCE(v_avg, 0),
    'peak_hour', jsonb_build_object('hour', v_peak_hour, 'count', v_peak_count),
    'last_pack_time', v_last_pack,
    'goal_percentage', CASE WHEN daily_goal > 0 THEN ROUND((COALESCE(v_total,0)::numeric / daily_goal * 100), 1) ELSE 0 END,
    'packer_leaderboard', COALESCE(v_packers, '[]'::jsonb),
    'station_leaderboard', COALESCE(v_stations, '[]'::jsonb)
  );

  RETURN result;
END;
$function$;