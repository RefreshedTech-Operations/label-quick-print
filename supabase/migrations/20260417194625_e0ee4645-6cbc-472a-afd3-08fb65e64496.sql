DROP FUNCTION IF EXISTS public.search_all_shipments(text, date, boolean, text, integer, integer, boolean, text, boolean);

CREATE OR REPLACE FUNCTION public.search_all_shipments(
  search_term text DEFAULT NULL::text,
  p_show_date date DEFAULT NULL::date,
  p_printed boolean DEFAULT NULL::boolean,
  p_filter text DEFAULT 'all'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_include_archive boolean DEFAULT false,
  p_channel text DEFAULT NULL::text,
  p_strict boolean DEFAULT true
)
RETURNS TABLE(
  id uuid, order_id text, uid text, location_id text, buyer text,
  product_name text, quantity integer, price text, tracking text,
  address_full text, show_date date, printed boolean,
  printed_at timestamp with time zone, printed_by_user_id uuid,
  bundle boolean, cancelled text, order_group_id uuid,
  group_id_printed boolean, group_id_printed_at timestamp with time zone,
  group_id_printed_by_user_id uuid, label_url text, manifest_url text,
  created_at timestamp with time zone, user_id uuid,
  printed_by_email text, group_id_printed_by_email text,
  is_archived boolean, channel text, unit_id text, shipping_cost numeric,
  packed boolean, packed_at timestamp with time zone,
  packed_by_name text, pack_station_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH combined_shipments AS (
    SELECT 
      s.id, s.order_id, s.uid, s.location_id, s.buyer,
      s.product_name, s.quantity, s.price, s.tracking,
      s.address_full, s.show_date, s.printed,
      s.printed_at, s.printed_by_user_id,
      s.bundle, s.cancelled, s.order_group_id,
      s.group_id_printed, s.group_id_printed_at,
      s.group_id_printed_by_user_id, s.label_url, s.manifest_url,
      s.created_at, s.user_id, s.search_vector, s.channel, s.unit_id,
      false as is_archived, s.shipping_cost,
      s.packed, s.packed_at, s.packed_by_name, s.pack_station_id
    FROM shipments s
    
    UNION ALL
    
    SELECT 
      sa.id, sa.order_id, sa.uid, sa.location_id, sa.buyer,
      sa.product_name, sa.quantity, sa.price, sa.tracking,
      sa.address_full, sa.show_date, sa.printed,
      sa.printed_at, sa.printed_by_user_id,
      sa.bundle, sa.cancelled, sa.order_group_id,
      sa.group_id_printed, sa.group_id_printed_at,
      sa.group_id_printed_by_user_id, sa.label_url, sa.manifest_url,
      sa.created_at, sa.user_id, sa.search_vector, sa.channel, sa.unit_id,
      true as is_archived, sa.shipping_cost,
      sa.packed, sa.packed_at, sa.packed_by_name, sa.pack_station_id
    FROM shipments_archive sa
    WHERE p_include_archive = true
  )
  SELECT 
    cs.id, cs.order_id, cs.uid, cs.location_id, cs.buyer,
    cs.product_name, cs.quantity, cs.price, cs.tracking,
    cs.address_full, cs.show_date, cs.printed,
    cs.printed_at, cs.printed_by_user_id,
    cs.bundle, cs.cancelled, cs.order_group_id,
    cs.group_id_printed, cs.group_id_printed_at,
    cs.group_id_printed_by_user_id, cs.label_url, cs.manifest_url,
    cs.created_at, cs.user_id,
    p.email as printed_by_email,
    p2.email as group_id_printed_by_email,
    cs.is_archived,
    cs.channel,
    cs.unit_id,
    cs.shipping_cost,
    cs.packed,
    cs.packed_at,
    cs.packed_by_name,
    ps.name as pack_station_name
  FROM combined_shipments cs
  LEFT JOIN profiles p ON cs.printed_by_user_id = p.id
  LEFT JOIN profiles p2 ON cs.group_id_printed_by_user_id = p2.id
  LEFT JOIN pack_stations ps ON cs.pack_station_id = ps.id
  WHERE 
    (p_show_date IS NULL OR cs.show_date = p_show_date)
    AND (p_channel IS NULL OR cs.channel = p_channel)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND cs.printed = true)
      OR (p_filter = 'unprinted' AND (cs.printed = false OR cs.printed IS NULL))
      OR (p_filter = 'bundled' AND cs.bundle = true)
      OR (p_filter = 'non_bundled' AND (cs.bundle = false OR cs.bundle IS NULL))
      OR (p_filter = 'non_bundled_unprinted' AND (cs.bundle = false OR cs.bundle IS NULL) AND (cs.printed = false OR cs.printed IS NULL))
      OR (p_filter = 'exceptions' AND (
        (cs.manifest_url IS NULL OR cs.manifest_url = '') 
        OR (cs.cancelled IS NOT NULL AND cs.cancelled != '' AND LOWER(cs.cancelled) = 'yes')
      ))
    )
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR (p_strict = true AND (
        UPPER(TRIM(COALESCE(cs.uid, ''))) = UPPER(TRIM(search_term))
        OR UPPER(TRIM(COALESCE(cs.order_id, ''))) = UPPER(TRIM(search_term))
        OR UPPER(TRIM(COALESCE(cs.buyer, ''))) = UPPER(TRIM(search_term))
        OR UPPER(TRIM(COALESCE(cs.tracking, ''))) = UPPER(TRIM(search_term))
        OR UPPER(TRIM(COALESCE(cs.unit_id, ''))) = UPPER(TRIM(search_term))
        OR UPPER(TRIM(COALESCE(cs.location_id, ''))) = UPPER(TRIM(search_term))
      ))
      OR (p_strict = false AND (
        cs.search_vector @@ plainto_tsquery('english', search_term)
        OR COALESCE(cs.uid, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.order_id, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.order_group_id::text, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.buyer, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.tracking, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.product_name, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.location_id, '') ILIKE '%' || search_term || '%'
        OR COALESCE(cs.address_full, '') ILIKE '%' || search_term || '%'
      ))
    )
  ORDER BY cs.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;