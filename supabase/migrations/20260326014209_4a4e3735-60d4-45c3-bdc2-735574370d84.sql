
-- Add unit_id column to shipments and shipments_archive
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS unit_id text DEFAULT NULL;
ALTER TABLE public.shipments_archive ADD COLUMN IF NOT EXISTS unit_id text DEFAULT NULL;

-- Update find_shipment_by_uid to fallback to unit_id
CREATE OR REPLACE FUNCTION public.find_shipment_by_uid(p_uid text)
 RETURNS SETOF shipments
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  upper_uid text := UPPER(p_uid);
  result shipments%ROWTYPE;
BEGIN
  -- Step 1: Exact match on uid
  SELECT * INTO result FROM shipments WHERE uid = upper_uid LIMIT 1;
  IF FOUND THEN RETURN NEXT result; RETURN; END IF;

  -- Step 2: Prefix match on uid
  SELECT * INTO result FROM shipments WHERE uid ILIKE upper_uid || '%' LIMIT 1;
  IF FOUND THEN RETURN NEXT result; RETURN; END IF;

  -- Step 3: Suffix match on uid
  SELECT * INTO result FROM shipments WHERE uid ILIKE '%' || upper_uid LIMIT 1;
  IF FOUND THEN RETURN NEXT result; RETURN; END IF;

  -- Step 4: Exact match on unit_id
  SELECT * INTO result FROM shipments WHERE unit_id = upper_uid LIMIT 1;
  IF FOUND THEN RETURN NEXT result; RETURN; END IF;

  -- Step 5: Prefix match on unit_id
  SELECT * INTO result FROM shipments WHERE unit_id ILIKE upper_uid || '%' LIMIT 1;
  IF FOUND THEN RETURN NEXT result; RETURN; END IF;

  -- Step 6: Suffix match on unit_id
  SELECT * INTO result FROM shipments WHERE unit_id ILIKE '%' || upper_uid LIMIT 1;
  IF FOUND THEN RETURN NEXT result; RETURN; END IF;

  RETURN;
END;
$function$;

-- Update search_all_shipments to include unit_id
DROP FUNCTION IF EXISTS public.search_all_shipments(text, date, boolean, text, integer, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.search_all_shipments(
  search_term text DEFAULT NULL,
  p_show_date date DEFAULT NULL,
  p_printed boolean DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_include_archive boolean DEFAULT false,
  p_channel text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, order_id text, uid text, location_id text, buyer text,
  product_name text, quantity integer, price text, tracking text,
  address_full text, show_date date, printed boolean,
  printed_at timestamptz, printed_by_user_id uuid,
  bundle boolean, cancelled text, order_group_id uuid,
  group_id_printed boolean, group_id_printed_at timestamptz,
  group_id_printed_by_user_id uuid, label_url text, manifest_url text,
  created_at timestamptz, user_id uuid,
  printed_by_email text, group_id_printed_by_email text,
  is_archived boolean, channel text, unit_id text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
      sa.created_at, sa.user_id, sa.search_vector, sa.channel, sa.unit_id,
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
    cs.is_archived,
    cs.channel,
    cs.unit_id
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

-- Update archive function to include unit_id
CREATE OR REPLACE FUNCTION public.archive_shipments_batch(days_to_keep integer, batch_size integer DEFAULT 1000)
 RETURNS TABLE(batch_archived bigint, total_remaining bigint, has_more boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff_date date;
  v_batch_count bigint;
  v_remaining bigint;
BEGIN
  IF days_to_keep < 1 THEN
    RAISE EXCEPTION 'days_to_keep must be at least 1';
  END IF;
  
  IF batch_size < 1 OR batch_size > 5000 THEN
    batch_size := 1000;
  END IF;

  v_cutoff_date := CURRENT_DATE - days_to_keep;
  
  WITH to_archive AS (
    SELECT id FROM shipments
    WHERE show_date IS NOT NULL AND show_date < v_cutoff_date
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  archived AS (
    INSERT INTO shipments_archive (
      id, order_id, uid, buyer, label_url, tracking, address_full,
      product_name, price, quantity, raw, printed, printed_at,
      created_at, user_id, show_date, printed_by_user_id, bundle,
      order_group_id, group_id_printed, group_id_printed_at,
      group_id_printed_by_user_id, search_vector, batch_id,
      batch_scanned_at, batch_scanned_by_user_id, has_issue,
      issue_marked_at, issue_marked_by_user_id, cancelled,
      manifest_url, location_id, channel,
      packed, packed_at, packed_by_user_id, pack_station_id,
      shipengine_label_id, shipping_provider, shipping_cost, unit_id
    )
    SELECT 
      s.id, s.order_id, s.uid, s.buyer, s.label_url, s.tracking, s.address_full,
      s.product_name, s.price, s.quantity, s.raw, s.printed, s.printed_at,
      s.created_at, s.user_id, s.show_date, s.printed_by_user_id, s.bundle,
      s.order_group_id, s.group_id_printed, s.group_id_printed_at,
      s.group_id_printed_by_user_id, s.search_vector, s.batch_id,
      s.batch_scanned_at, s.batch_scanned_by_user_id, s.has_issue,
      s.issue_marked_at, s.issue_marked_by_user_id, s.cancelled,
      s.manifest_url, s.location_id, s.channel,
      s.packed, s.packed_at, s.packed_by_user_id, s.pack_station_id,
      s.shipengine_label_id, s.shipping_provider, s.shipping_cost, s.unit_id
    FROM shipments s
    WHERE s.id IN (SELECT id FROM to_archive)
    RETURNING id
  )
  DELETE FROM shipments WHERE id IN (SELECT id FROM archived);
  
  GET DIAGNOSTICS v_batch_count = ROW_COUNT;
  
  SELECT COUNT(*) INTO v_remaining 
  FROM shipments 
  WHERE show_date IS NOT NULL AND show_date < v_cutoff_date;
  
  RETURN QUERY SELECT v_batch_count, v_remaining, (v_remaining > 0);
END;
$function$;
