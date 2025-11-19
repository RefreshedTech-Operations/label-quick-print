-- Create a materialized view for analytics KPIs to improve performance
CREATE OR REPLACE FUNCTION get_analytics_kpis(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE(
  total_orders bigint,
  printed_orders bigint,
  bundle_orders bigint,
  cancelled_orders bigint,
  total_print_jobs bigint,
  successful_prints bigint
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE s.created_at >= start_date AND s.created_at <= end_date;
END;
$$;

-- Create function to get daily aggregated data for charts
CREATE OR REPLACE FUNCTION get_daily_analytics(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE(
  date date,
  total_orders bigint,
  printed_orders bigint,
  unprinted_orders bigint,
  cancelled_orders bigint,
  bundle_orders bigint,
  print_jobs_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(s.created_at) as date,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE s.printed = true)::bigint as printed_orders,
    COUNT(*) FILTER (WHERE s.printed = false OR s.printed IS NULL)::bigint as unprinted_orders,
    COUNT(*) FILTER (WHERE s.cancelled IS NOT NULL AND LOWER(s.cancelled) = 'yes')::bigint as cancelled_orders,
    COUNT(*) FILTER (WHERE s.bundle = true)::bigint as bundle_orders,
    (SELECT COUNT(*)::bigint FROM print_jobs WHERE DATE(created_at) = DATE(s.created_at)) as print_jobs_count
  FROM shipments s
  WHERE s.created_at >= start_date AND s.created_at <= end_date
  GROUP BY DATE(s.created_at)
  ORDER BY DATE(s.created_at) ASC;
END;
$$;

-- Create function to get printer performance data
CREATE OR REPLACE FUNCTION get_printer_performance(
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  top_limit integer DEFAULT 10
)
RETURNS TABLE(
  printer_id text,
  job_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pj.printer_id,
    COUNT(*)::bigint as job_count
  FROM print_jobs pj
  WHERE pj.created_at >= start_date 
    AND pj.created_at <= end_date
    AND pj.printer_id IS NOT NULL
  GROUP BY pj.printer_id
  ORDER BY job_count DESC
  LIMIT top_limit;
END;
$$;

-- Create function to get print status breakdown
CREATE OR REPLACE FUNCTION get_print_status_breakdown(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS TABLE(
  status text,
  count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pj.status, 'unknown') as status,
    COUNT(*)::bigint as count
  FROM print_jobs pj
  WHERE pj.created_at >= start_date AND pj.created_at <= end_date
  GROUP BY pj.status
  HAVING COUNT(*) > 0;
END;
$$;