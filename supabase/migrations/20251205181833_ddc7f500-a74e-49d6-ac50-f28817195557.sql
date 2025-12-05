-- Fix get_next_available_location to check if bundle has ANY unprinted items
CREATE OR REPLACE FUNCTION public.get_next_available_location()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT bl.location_code
  FROM bundle_locations bl
  WHERE bl.is_active = true
    AND NOT EXISTS (
      -- A location is occupied if there's any shipment at this location
      -- that belongs to a bundle with at least one unprinted item
      SELECT 1 FROM shipments s1
      WHERE s1.location_id = bl.location_code
        AND s1.bundle = true
        AND s1.order_group_id IS NOT NULL
        AND EXISTS (
          -- Check if the bundle (same order_group_id) has unprinted items
          SELECT 1 FROM shipments s2
          WHERE s2.order_group_id = s1.order_group_id
            AND s2.bundle = true
            AND (s2.printed = false OR s2.printed IS NULL)
        )
    )
  ORDER BY bl.sort_order
  LIMIT 1;
$$;

-- Fix get_location_occupancy to use consistent occupancy logic
CREATE OR REPLACE FUNCTION public.get_location_occupancy()
 RETURNS TABLE(location_code text, category text, sort_order integer, is_active boolean, is_occupied boolean, order_group_id uuid, buyer text, printed_count bigint, total_count bigint)
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
    -- Location is occupied if ANY shipment there belongs to a bundle with unprinted items
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM shipments s1
        WHERE s1.location_id = bl.location_code
          AND s1.bundle = true
          AND s1.order_group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM shipments s2
            WHERE s2.order_group_id = s1.order_group_id
              AND s2.bundle = true
              AND (s2.printed = false OR s2.printed IS NULL)
          )
      ) THEN true
      ELSE false
    END as is_occupied,
    (
      SELECT s1.order_group_id
      FROM shipments s1
      WHERE s1.location_id = bl.location_code
        AND s1.bundle = true
        AND s1.order_group_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM shipments s2
          WHERE s2.order_group_id = s1.order_group_id
            AND s2.bundle = true
            AND (s2.printed = false OR s2.printed IS NULL)
        )
      LIMIT 1
    ) as order_group_id,
    (
      SELECT s1.buyer
      FROM shipments s1
      WHERE s1.location_id = bl.location_code
        AND s1.bundle = true
        AND s1.order_group_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM shipments s2
          WHERE s2.order_group_id = s1.order_group_id
            AND s2.bundle = true
            AND (s2.printed = false OR s2.printed IS NULL)
        )
      LIMIT 1
    ) as buyer,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE s.printed = true)
      FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND s.order_group_id = (
          SELECT s1.order_group_id
          FROM shipments s1
          WHERE s1.location_id = bl.location_code
            AND s1.bundle = true
            AND s1.order_group_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM shipments s2
              WHERE s2.order_group_id = s1.order_group_id
                AND s2.bundle = true
                AND (s2.printed = false OR s2.printed IS NULL)
            )
          LIMIT 1
        )
    ), 0)::bigint as printed_count,
    COALESCE((
      SELECT COUNT(*)
      FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND s.order_group_id = (
          SELECT s1.order_group_id
          FROM shipments s1
          WHERE s1.location_id = bl.location_code
            AND s1.bundle = true
            AND s1.order_group_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM shipments s2
              WHERE s2.order_group_id = s1.order_group_id
                AND s2.bundle = true
                AND (s2.printed = false OR s2.printed IS NULL)
            )
          LIMIT 1
        )
    ), 0)::bigint as total_count
  FROM bundle_locations bl
  ORDER BY bl.sort_order;
END;
$function$;