-- Update get_analytics_kpis to filter shipments by printed_at instead of created_at
CREATE OR REPLACE FUNCTION public.get_analytics_kpis(start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE(total_orders bigint, printed_orders bigint, bundle_orders bigint, cancelled_orders bigint, total_print_jobs bigint, successful_prints bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE s.printed = true)::bigint as printed_orders,
    COUNT(*) FILTER (WHERE s.bundle = true)::bigint as bundle_orders,
    COUNT(*) FILTER (WHERE s.cancelled IS NOT NULL AND LOWER(s.cancelled) = 'yes')::bigint as cancelled_orders,
    (SELECT COUNT(*)::bigint FROM print_jobs WHERE created_at >= start_date AND created_at <= end_date) as total_print_jobs,
    (SELECT COUNT(*)::bigint FROM print_jobs WHERE created_at >= start_date AND created_at <= end_date AND status = 'done') as successful_prints
  FROM shipments s
  WHERE s.printed_at >= start_date AND s.printed_at <= end_date AND s.printed_at IS NOT NULL;
END;
$function$;

-- Update get_daily_analytics to filter shipments by printed_at instead of created_at
CREATE OR REPLACE FUNCTION public.get_daily_analytics(start_date date, end_date date)
RETURNS TABLE(date date, total_orders bigint, printed_orders bigint, unprinted_orders bigint, bundle_orders bigint, cancelled_orders bigint, print_jobs_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(s.printed_at) as date,
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
  ) pj ON DATE(s.printed_at) = pj.job_date
  WHERE 
    s.printed_at >= start_date 
    AND s.printed_at < end_date + INTERVAL '1 day'
    AND s.printed_at IS NOT NULL
  GROUP BY DATE(s.printed_at), pj.job_count
  ORDER BY date ASC;
END;
$function$;