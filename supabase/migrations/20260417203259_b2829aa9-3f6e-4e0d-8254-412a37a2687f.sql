CREATE OR REPLACE FUNCTION public.get_analytics_overview(
  p_start_ts timestamptz,
  p_end_ts timestamptz,
  p_prev_start_ts timestamptz,
  p_prev_end_ts timestamptz,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_printed bigint;
  v_printed_prev bigint;
  v_packed bigint;
  v_packed_prev bigint;
  v_backlog bigint;
  v_uploaded bigint;
  v_shipped bigint;
  v_active_hours numeric;
  v_throughput numeric;
  v_open_issues bigint;
  v_cancelled bigint;
  v_stale_unpacked bigint;
  v_hourly jsonb;
  v_printer_lb jsonb;
  v_packer_lb jsonb;
BEGIN
  -- Combined shipments view (active + archive)
  WITH all_ship AS (
    SELECT id, printed, printed_at, printed_by_user_id, packed, packed_at, packed_by_name, pack_station_id, has_issue, cancelled, tracking, created_at
    FROM shipments
    UNION ALL
    SELECT id, printed, printed_at, printed_by_user_id, packed, packed_at, packed_by_name, pack_station_id, has_issue, cancelled, tracking, created_at
    FROM shipments_archive
  )
  SELECT
    COUNT(*) FILTER (WHERE printed = true AND printed_at >= p_start_ts AND printed_at < p_end_ts AND (p_user_id IS NULL OR printed_by_user_id = p_user_id)),
    COUNT(*) FILTER (WHERE packed = true AND packed_at >= p_start_ts AND packed_at < p_end_ts),
    COUNT(*) FILTER (WHERE created_at >= p_start_ts AND created_at < p_end_ts),
    COUNT(*) FILTER (WHERE tracking IS NOT NULL AND tracking <> '' AND created_at >= p_start_ts AND created_at < p_end_ts),
    COUNT(*) FILTER (WHERE has_issue = true AND created_at >= p_start_ts AND created_at < p_end_ts),
    COUNT(*) FILTER (WHERE LOWER(COALESCE(cancelled,'')) IN ('yes','true','1','y') AND created_at >= p_start_ts AND created_at < p_end_ts)
  INTO v_printed, v_packed, v_uploaded, v_shipped, v_open_issues, v_cancelled
  FROM all_ship;

  -- Previous period
  SELECT
    COUNT(*) FILTER (WHERE printed = true AND printed_at >= p_prev_start_ts AND printed_at < p_prev_end_ts AND (p_user_id IS NULL OR printed_by_user_id = p_user_id)),
    COUNT(*) FILTER (WHERE packed = true AND packed_at >= p_prev_start_ts AND packed_at < p_prev_end_ts)
  INTO v_printed_prev, v_packed_prev
  FROM (
    SELECT printed, printed_at, printed_by_user_id, packed, packed_at FROM shipments
    UNION ALL
    SELECT printed, printed_at, printed_by_user_id, packed, packed_at FROM shipments_archive
  ) p;

  -- Live backlog (printed but not packed, not cancelled)
  SELECT COUNT(*) INTO v_backlog
  FROM shipments
  WHERE printed = true
    AND COALESCE(packed, false) = false
    AND (cancelled IS NULL OR LOWER(cancelled) NOT IN ('yes','true','1','y'));

  -- Stale unpacked (printed >48h ago, not packed)
  SELECT COUNT(*) INTO v_stale_unpacked
  FROM shipments
  WHERE printed = true
    AND COALESCE(packed, false) = false
    AND printed_at < (now() - interval '48 hours')
    AND (cancelled IS NULL OR LOWER(cancelled) NOT IN ('yes','true','1','y'));

  -- Throughput: prints / active hours within window (cap at 8a-8p EST hours that have elapsed in window)
  v_active_hours := GREATEST(EXTRACT(EPOCH FROM (LEAST(p_end_ts, now()) - p_start_ts)) / 3600.0, 1);
  v_throughput := ROUND((v_printed::numeric / v_active_hours)::numeric, 1);

  -- Hourly breakdown (EST)
  WITH hours AS (SELECT generate_series(0,23) AS h),
  prints AS (
    SELECT EXTRACT(HOUR FROM printed_at AT TIME ZONE 'America/New_York')::int AS h, COUNT(*) AS c
    FROM (SELECT printed_at, printed_by_user_id FROM shipments WHERE printed = true UNION ALL SELECT printed_at, printed_by_user_id FROM shipments_archive WHERE printed = true) x
    WHERE printed_at >= p_start_ts AND printed_at < p_end_ts
      AND (p_user_id IS NULL OR printed_by_user_id = p_user_id)
    GROUP BY 1
  ),
  packs AS (
    SELECT EXTRACT(HOUR FROM packed_at AT TIME ZONE 'America/New_York')::int AS h, COUNT(*) AS c
    FROM (SELECT packed_at FROM shipments WHERE packed = true UNION ALL SELECT packed_at FROM shipments_archive WHERE packed = true) x
    WHERE packed_at >= p_start_ts AND packed_at < p_end_ts
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object('hour', h, 'printed', COALESCE(pr.c,0), 'packed', COALESCE(pk.c,0)) ORDER BY h)
  INTO v_hourly
  FROM hours
  LEFT JOIN prints pr USING (h)
  LEFT JOIN packs pk USING (h);

  -- Printer leaderboard (by user email)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
  INTO v_printer_lb
  FROM (
    SELECT COALESCE(SPLIT_PART(p.email,'@',1),'Unknown') AS name, COUNT(*) AS c
    FROM (
      SELECT printed_by_user_id FROM shipments WHERE printed = true AND printed_at >= p_start_ts AND printed_at < p_end_ts
      UNION ALL
      SELECT printed_by_user_id FROM shipments_archive WHERE printed = true AND printed_at >= p_start_ts AND printed_at < p_end_ts
    ) s
    LEFT JOIN profiles p ON p.id = s.printed_by_user_id
    WHERE s.printed_by_user_id IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) t;

  -- Packer leaderboard (by packed_by_name + stations array)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', c, 'stations', stations) ORDER BY c DESC), '[]'::jsonb)
  INTO v_packer_lb
  FROM (
    SELECT
      COALESCE(s.packed_by_name, 'Unknown') AS name,
      COUNT(*) AS c,
      COALESCE(jsonb_agg(DISTINCT ps.name) FILTER (WHERE ps.name IS NOT NULL), '[]'::jsonb) AS stations
    FROM (
      SELECT packed_by_name, pack_station_id FROM shipments WHERE packed = true AND packed_at >= p_start_ts AND packed_at < p_end_ts
      UNION ALL
      SELECT packed_by_name, pack_station_id FROM shipments_archive WHERE packed = true AND packed_at >= p_start_ts AND packed_at < p_end_ts
    ) s
    LEFT JOIN pack_stations ps ON ps.id = s.pack_station_id
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) t;

  v_result := jsonb_build_object(
    'kpis', jsonb_build_object(
      'printed', v_printed,
      'printed_prev', v_printed_prev,
      'packed', v_packed,
      'packed_prev', v_packed_prev,
      'backlog', v_backlog,
      'throughput_per_hr', v_throughput
    ),
    'hourly', COALESCE(v_hourly, '[]'::jsonb),
    'printer_leaderboard', v_printer_lb,
    'packer_leaderboard', v_packer_lb,
    'funnel', jsonb_build_object(
      'uploaded', v_uploaded,
      'printed', v_printed,
      'packed', v_packed,
      'shipped', v_shipped
    ),
    'exceptions', jsonb_build_object(
      'open_issues', v_open_issues,
      'cancelled', v_cancelled,
      'stale_unpacked', v_stale_unpacked
    )
  );

  RETURN v_result;
END;
$$;