-- Function to get location occupancy status with bundle details
CREATE OR REPLACE FUNCTION public.get_location_occupancy()
RETURNS TABLE(
  location_code text,
  category text,
  sort_order integer,
  is_active boolean,
  is_occupied boolean,
  order_group_id uuid,
  buyer text,
  printed_count bigint,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bl.location_code,
    bl.category,
    bl.sort_order,
    bl.is_active,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM shipments s
        WHERE s.location_id = bl.location_code
          AND s.bundle = true
          AND (s.printed = false OR s.printed IS NULL)
      ) THEN true
      ELSE false
    END as is_occupied,
    (
      SELECT s.order_group_id
      FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND (s.printed = false OR s.printed IS NULL)
      LIMIT 1
    ) as order_group_id,
    (
      SELECT s.buyer
      FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND (s.printed = false OR s.printed IS NULL)
      LIMIT 1
    ) as buyer,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE s.printed = true)
      FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND s.order_group_id = (
          SELECT s2.order_group_id
          FROM shipments s2
          WHERE s2.location_id = bl.location_code
            AND s2.bundle = true
            AND (s2.printed = false OR s2.printed IS NULL)
          LIMIT 1
        )
    ), 0)::bigint as printed_count,
    COALESCE((
      SELECT COUNT(*)
      FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND s.order_group_id = (
          SELECT s2.order_group_id
          FROM shipments s2
          WHERE s2.location_id = bl.location_code
            AND s2.bundle = true
            AND (s2.printed = false OR s2.printed IS NULL)
          LIMIT 1
        )
    ), 0)::bigint as total_count
  FROM bundle_locations bl
  ORDER BY bl.sort_order;
END;
$function$;