CREATE OR REPLACE FUNCTION public.get_next_available_location()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT bl.location_code
  FROM bundle_locations bl
  WHERE bl.is_active = true
    AND NOT EXISTS (
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
    )
  ORDER BY random()
  LIMIT 1;
$function$