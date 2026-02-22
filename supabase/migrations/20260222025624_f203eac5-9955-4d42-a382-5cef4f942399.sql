
CREATE OR REPLACE FUNCTION public.get_archive_stats()
 RETURNS TABLE(active_count bigint, archived_count bigint, oldest_active_date date, newest_archived_date date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'shipments') as active_count,
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'shipments_archive') as archived_count,
    (SELECT MIN(show_date) FROM shipments) as oldest_active_date,
    (SELECT MAX(show_date) FROM shipments_archive) as newest_archived_date;
END;
$function$;
