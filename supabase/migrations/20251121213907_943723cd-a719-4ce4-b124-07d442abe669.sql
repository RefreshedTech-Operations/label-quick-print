-- Fix get_daily_analytics function with proper LEFT JOIN
CREATE OR REPLACE FUNCTION public.get_daily_analytics(
  start_date date,
  end_date date
)
RETURNS TABLE (
  date date,
  total_orders bigint,
  printed_orders bigint,
  unprinted_orders bigint,
  bundle_orders bigint,
  cancelled_orders bigint,
  print_jobs_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(s.created_at) as date,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE s.printed = true)::bigint as printed_orders,
    COUNT(*) FILTER (WHERE s.printed = false OR s.printed IS NULL)::bigint as unprinted_orders,
    COUNT(*) FILTER (WHERE s.bundle = true)::bigint as bundle_orders,
    COUNT(*) FILTER (WHERE s.cancelled IS NOT NULL AND s.cancelled != '' AND s.cancelled != 'no')::bigint as cancelled_orders,
    COALESCE(pj.job_count, 0)::bigint as print_jobs_count
  FROM shipments s
  LEFT JOIN (
    SELECT 
      DATE(created_at) as job_date,
      COUNT(*)::bigint as job_count
    FROM print_jobs
    WHERE created_at >= start_date 
      AND created_at < end_date + INTERVAL '1 day'
    GROUP BY DATE(created_at)
  ) pj ON DATE(s.created_at) = pj.job_date
  WHERE 
    s.created_at >= start_date 
    AND s.created_at < end_date + INTERVAL '1 day'
  GROUP BY DATE(s.created_at), pj.job_count
  ORDER BY date ASC;
END;
$$;