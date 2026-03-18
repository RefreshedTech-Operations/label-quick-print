
-- Add p_channel parameter to search_all_shipments
CREATE OR REPLACE FUNCTION public.search_all_shipments(
  search_term text DEFAULT NULL::text,
  p_show_date date DEFAULT NULL::date,
  p_printed boolean DEFAULT NULL::boolean,
  p_filter text DEFAULT 'all'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_include_archive boolean DEFAULT false,
  p_channel text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, order_id text, uid text, location_id text, buyer text, product_name text, quantity integer, price text, tracking text, address_full text, show_date date, printed boolean, printed_at timestamp with time zone, printed_by_user_id uuid, bundle boolean, cancelled text, order_group_id uuid, group_id_printed boolean, group_id_printed_at timestamp with time zone, group_id_printed_by_user_id uuid, label_url text, manifest_url text, created_at timestamp with time zone, user_id uuid, printed_by_email text, group_id_printed_by_email text, is_archived boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
      s.created_at, s.user_id, s.search_vector, s.channel,
      false as is_archived
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
      sa.created_at, sa.user_id, sa.search_vector, sa.channel,
      true as is_archived
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
    cs.is_archived
  FROM combined_shipments cs
  LEFT JOIN profiles p ON cs.printed_by_user_id = p.id
  LEFT JOIN profiles p2 ON cs.group_id_printed_by_user_id = p2.id
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
      OR cs.search_vector @@ plainto_tsquery('english', search_term)
      OR COALESCE(cs.uid, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.order_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.order_group_id::text, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.buyer, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.tracking, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.product_name, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.location_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(cs.address_full, '') ILIKE '%' || search_term || '%'
    )
  ORDER BY cs.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- Add p_channel parameter to get_shipments_stats_with_archive
CREATE OR REPLACE FUNCTION public.get_shipments_stats_with_archive(
  search_term text DEFAULT NULL::text,
  p_show_date date DEFAULT NULL::date,
  p_printed boolean DEFAULT NULL::boolean,
  p_filter text DEFAULT 'all'::text,
  p_include_archive boolean DEFAULT false,
  p_channel text DEFAULT NULL::text
)
RETURNS TABLE(total bigint, printed bigint, unprinted bigint, exceptions bigint, archived bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH combined AS (
    SELECT s.printed, s.manifest_url, s.cancelled, s.show_date, s.bundle, s.order_group_id,
           s.search_vector, s.uid, s.order_id, s.buyer, s.tracking, s.product_name, 
           s.location_id, s.address_full, s.channel, false as is_archived
    FROM shipments s
    
    UNION ALL
    
    SELECT sa.printed, sa.manifest_url, sa.cancelled, sa.show_date, sa.bundle, sa.order_group_id,
           sa.search_vector, sa.uid, sa.order_id, sa.buyer, sa.tracking, sa.product_name,
           sa.location_id, sa.address_full, sa.channel, true as is_archived
    FROM shipments_archive sa
    WHERE p_include_archive = true
  )
  SELECT 
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE c.printed = true)::bigint as printed,
    COUNT(*) FILTER (WHERE c.printed = false OR c.printed IS NULL)::bigint as unprinted,
    COUNT(*) FILTER (WHERE 
      (c.manifest_url IS NULL OR c.manifest_url = '') 
      OR (c.cancelled IS NOT NULL AND c.cancelled != '' AND LOWER(c.cancelled) = 'yes')
    )::bigint as exceptions,
    COUNT(*) FILTER (WHERE c.is_archived = true)::bigint as archived
  FROM combined c
  WHERE 
    (p_show_date IS NULL OR c.show_date = p_show_date)
    AND (p_channel IS NULL OR c.channel = p_channel)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND c.printed = true)
      OR (p_filter = 'unprinted' AND (c.printed = false OR c.printed IS NULL))
      OR (p_filter = 'bundled' AND c.bundle = true)
      OR (p_filter = 'non_bundled' AND (c.bundle = false OR c.bundle IS NULL))
      OR (p_filter = 'non_bundled_unprinted' AND (c.bundle = false OR c.bundle IS NULL) AND (c.printed = false OR c.printed IS NULL))
      OR (p_filter = 'exceptions' AND (
        (c.manifest_url IS NULL OR c.manifest_url = '') 
        OR (c.cancelled IS NOT NULL AND c.cancelled != '' AND LOWER(c.cancelled) = 'yes')
      ))
    )
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR c.search_vector @@ plainto_tsquery('english', search_term)
      OR COALESCE(c.uid, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.order_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.order_group_id::text, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.buyer, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.tracking, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.product_name, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.location_id, '') ILIKE '%' || search_term || '%'
      OR COALESCE(c.address_full, '') ILIKE '%' || search_term || '%'
    );
END;
$function$;

-- Add p_channel parameter to search_shipments
CREATE OR REPLACE FUNCTION public.search_shipments(
  search_term text,
  p_show_date date DEFAULT NULL::date,
  p_printed boolean DEFAULT NULL::boolean,
  p_filter text DEFAULT 'all'::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_channel text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, order_id text, uid text, location_id text, buyer text, product_name text, quantity integer, price text, tracking text, address_full text, show_date date, printed boolean, printed_at timestamp with time zone, printed_by_user_id uuid, bundle boolean, cancelled text, order_group_id uuid, group_id_printed boolean, group_id_printed_at timestamp with time zone, group_id_printed_by_user_id uuid, label_url text, manifest_url text, created_at timestamp with time zone, user_id uuid, printed_by_email text, group_id_printed_by_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    s.created_at, s.user_id,
    p.email as printed_by_email,
    p2.email as group_id_printed_by_email
  FROM shipments s
  LEFT JOIN profiles p ON s.printed_by_user_id = p.id
  LEFT JOIN profiles p2 ON s.group_id_printed_by_user_id = p2.id
  WHERE 
    (p_show_date IS NULL OR s.show_date = p_show_date)
    AND (p_channel IS NULL OR s.channel = p_channel)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND s.printed = true)
      OR (p_filter = 'unprinted' AND (s.printed = false OR s.printed IS NULL))
      OR (p_filter = 'bundled' AND s.bundle = true)
      OR (p_filter = 'non_bundled' AND (s.bundle = false OR s.bundle IS NULL))
      OR (p_filter = 'exceptions' AND (
        (s.manifest_url IS NULL OR s.manifest_url = '') 
        OR (s.cancelled IS NOT NULL AND s.cancelled != '' AND LOWER(s.cancelled) = 'yes')
      ))
      OR (p_filter = 'incomplete_bundles' AND s.bundle = true AND s.order_group_id IN (
        SELECT sg.order_group_id
        FROM shipments sg
        WHERE sg.bundle = true AND sg.order_group_id IS NOT NULL
        GROUP BY sg.order_group_id
        HAVING COUNT(*) FILTER (WHERE sg.printed = true) > 0 
           AND COUNT(*) FILTER (WHERE sg.printed = false OR sg.printed IS NULL) > 0
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
      OR COALESCE(p.email, '') ILIKE '%' || search_term || '%'
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
