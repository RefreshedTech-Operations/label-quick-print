
-- Add optional p_user_id parameter to analytics functions

CREATE OR REPLACE FUNCTION public.get_analytics_kpis(start_date timestamp with time zone, end_date timestamp with time zone, p_user_id uuid DEFAULT NULL)
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
    (SELECT COUNT(*)::bigint FROM print_jobs WHERE created_at >= start_date AND created_at <= end_date AND (p_user_id IS NULL OR user_id = p_user_id)) as total_print_jobs,
    (SELECT COUNT(*)::bigint FROM print_jobs WHERE created_at >= start_date AND created_at <= end_date AND status = 'done' AND (p_user_id IS NULL OR user_id = p_user_id)) as successful_prints
  FROM shipments s
  WHERE s.printed_at >= start_date AND s.printed_at <= end_date AND s.printed_at IS NOT NULL
    AND (p_user_id IS NULL OR s.printed_by_user_id = p_user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_analytics(start_date date, end_date date, p_user_id uuid DEFAULT NULL)
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
      AND (p_user_id IS NULL OR user_id = p_user_id)
    GROUP BY DATE(created_at)
  ) pj ON DATE(s.printed_at) = pj.job_date
  WHERE 
    s.printed_at >= start_date 
    AND s.printed_at < end_date + INTERVAL '1 day'
    AND s.printed_at IS NOT NULL
    AND (p_user_id IS NULL OR s.printed_by_user_id = p_user_id)
  GROUP BY DATE(s.printed_at), pj.job_count
  ORDER BY date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_printer_performance(start_date timestamp with time zone, end_date timestamp with time zone, top_limit integer DEFAULT 10, p_user_id uuid DEFAULT NULL)
 RETURNS TABLE(printer_id text, job_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pj.printer_id,
    COUNT(*)::bigint as job_count
  FROM print_jobs pj
  WHERE pj.created_at >= start_date 
    AND pj.created_at <= end_date
    AND pj.printer_id IS NOT NULL
    AND (p_user_id IS NULL OR pj.user_id = p_user_id)
  GROUP BY pj.printer_id
  ORDER BY job_count DESC
  LIMIT top_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_print_status_breakdown(start_date timestamp with time zone, end_date timestamp with time zone, p_user_id uuid DEFAULT NULL)
 RETURNS TABLE(status text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pj.status, 'unknown') as status,
    COUNT(*)::bigint as count
  FROM print_jobs pj
  WHERE pj.created_at >= start_date AND pj.created_at <= end_date
    AND (p_user_id IS NULL OR pj.user_id = p_user_id)
  GROUP BY pj.status
  HAVING COUNT(*) > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_hourly_print_rate(start_date timestamp with time zone, end_date timestamp with time zone, p_user_id uuid DEFAULT NULL)
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
      AND (p_user_id IS NULL OR printed_by_user_id = p_user_id)
    GROUP BY EXTRACT(HOUR FROM printed_at)
  )
  SELECT 
    h.hour,
    COALESCE(p.count, 0)::bigint as print_count
  FROM hours h
  LEFT JOIN prints p ON h.hour = p.hour
  ORDER BY h.hour;
END;
$function$;
