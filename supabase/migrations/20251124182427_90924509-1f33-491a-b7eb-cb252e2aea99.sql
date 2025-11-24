-- Update get_show_date_counts to return unprinted_count
CREATE OR REPLACE FUNCTION public.get_show_date_counts(limit_rows integer DEFAULT 5)
RETURNS TABLE(show_date date, count bigint, unprinted_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    shipments.show_date,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE printed = false OR printed IS NULL) as unprinted_count
  FROM shipments
  WHERE shipments.show_date IS NOT NULL
  GROUP BY shipments.show_date
  ORDER BY shipments.show_date DESC
  LIMIT limit_rows;
$function$;