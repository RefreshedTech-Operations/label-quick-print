-- Fix exception logic in get_shipments_stats function
CREATE OR REPLACE FUNCTION public.get_shipments_stats(
  search_term text DEFAULT NULL::text, 
  p_show_date date DEFAULT NULL::date, 
  p_printed boolean DEFAULT NULL::boolean, 
  p_filter text DEFAULT 'all'::text
)
RETURNS TABLE(total bigint, printed bigint, unprinted bigint, exceptions bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE s.printed = true)::bigint as printed,
    COUNT(*) FILTER (WHERE s.printed = false OR s.printed IS NULL)::bigint as unprinted,
    COUNT(*) FILTER (WHERE 
      (s.manifest_url IS NULL OR s.manifest_url = '') 
      OR (s.cancelled IS NOT NULL AND s.cancelled != '' AND LOWER(s.cancelled) = 'yes')
    )::bigint as exceptions
  FROM shipments s
  WHERE 
    (p_show_date IS NULL OR s.show_date = p_show_date)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND s.printed = true)
      OR (p_filter = 'unprinted' AND (s.printed = false OR s.printed IS NULL))
      OR (p_filter = 'bundled' AND s.bundle = true)
      OR (p_filter = 'exceptions' AND (
        (s.manifest_url IS NULL OR s.manifest_url = '') 
        OR (s.cancelled IS NOT NULL AND s.cancelled != '' AND LOWER(s.cancelled) = 'yes')
      ))
      OR (p_printed IS NOT NULL AND s.printed = p_printed)
    )
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR s.search_vector @@ plainto_tsquery('english', search_term)
      OR COALESCE(s.uid, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.order_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.order_group_id::text, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.buyer, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.tracking, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.product_name, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.location_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.address_full, '') ILIKE '%' || search_term || '%'
    );
END;
$function$;

-- Fix exception logic in search_shipments function
CREATE OR REPLACE FUNCTION public.search_shipments(
  search_term text, 
  p_show_date date DEFAULT NULL::date, 
  p_printed boolean DEFAULT NULL::boolean, 
  p_filter text DEFAULT 'all'::text, 
  p_limit integer DEFAULT 25, 
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, order_id text, uid text, location_id text, buyer text,
  product_name text, quantity integer, price text, tracking text,
  address_full text, show_date date, printed boolean,
  printed_at timestamp with time zone, printed_by_user_id uuid,
  bundle boolean, cancelled text, order_group_id uuid,
  group_id_printed boolean, group_id_printed_at timestamp with time zone,
  group_id_printed_by_user_id uuid, label_url text, manifest_url text,
  created_at timestamp with time zone, user_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, s.order_id, s.uid, s.location_id, s.buyer,
    s.product_name, s.quantity, s.price, s.tracking,
    s.address_full, s.show_date, s.printed,
    s.printed_at, s.printed_by_user_id,
    s.bundle, s.cancelled, s.order_group_id,
    s.group_id_printed, s.group_id_printed_at,
    s.group_id_printed_by_user_id, s.label_url, s.manifest_url,
    s.created_at, s.user_id
  FROM shipments s
  WHERE 
    (p_show_date IS NULL OR s.show_date = p_show_date)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND s.printed = true)
      OR (p_filter = 'unprinted' AND (s.printed = false OR s.printed IS NULL))
      OR (p_filter = 'bundled' AND s.bundle = true)
      OR (p_filter = 'exceptions' AND (
        (s.manifest_url IS NULL OR s.manifest_url = '') 
        OR (s.cancelled IS NOT NULL AND s.cancelled != '' AND LOWER(s.cancelled) = 'yes')
      ))
      OR (p_printed IS NOT NULL AND s.printed = p_printed)
    )
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR s.search_vector @@ plainto_tsquery('english', search_term)
      OR COALESCE(s.uid, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.order_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.order_group_id::text, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.buyer, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.tracking, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.product_name, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.location_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(s.address_full, '') ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE WHEN search_term IS NULL OR search_term = '' 
      THEN s.created_at 
      ELSE NULL 
    END DESC NULLS LAST,
    CASE 
      WHEN search_term IS NOT NULL AND search_term != '' 
      THEN ts_rank(s.search_vector, plainto_tsquery('english', search_term))
      ELSE 0
    END DESC,
    s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;