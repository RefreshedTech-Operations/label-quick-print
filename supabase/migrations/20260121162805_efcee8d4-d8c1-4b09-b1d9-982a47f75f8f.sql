-- Create archive table with identical schema to shipments
CREATE TABLE public.shipments_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text NOT NULL,
  uid text,
  location_id text,
  buyer text,
  product_name text,
  quantity integer,
  price text,
  tracking text,
  address_full text,
  show_date date,
  printed boolean DEFAULT false,
  printed_at timestamp with time zone,
  printed_by_user_id uuid,
  bundle boolean DEFAULT false,
  cancelled text,
  order_group_id uuid,
  group_id_printed boolean DEFAULT false,
  group_id_printed_at timestamp with time zone,
  group_id_printed_by_user_id uuid,
  label_url text,
  manifest_url text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  raw jsonb,
  search_vector tsvector,
  batch_id uuid,
  batch_scanned_at timestamp with time zone,
  batch_scanned_by_user_id uuid,
  has_issue boolean DEFAULT false,
  issue_marked_at timestamp with time zone,
  issue_marked_by_user_id uuid,
  channel text DEFAULT 'regular'::text,
  archived_at timestamp with time zone DEFAULT now()
);

-- Create indexes for archive table (subset of main table indexes for search)
CREATE INDEX idx_shipments_archive_show_date ON public.shipments_archive(show_date);
CREATE INDEX idx_shipments_archive_order_id ON public.shipments_archive(order_id);
CREATE INDEX idx_shipments_archive_uid ON public.shipments_archive(uid);
CREATE INDEX idx_shipments_archive_tracking ON public.shipments_archive(tracking);
CREATE INDEX idx_shipments_archive_buyer ON public.shipments_archive(buyer);
CREATE INDEX idx_shipments_archive_search_vector ON public.shipments_archive USING gin(search_vector);

-- Enable RLS on archive table
ALTER TABLE public.shipments_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies for archive table (same as shipments)
CREATE POLICY "Authenticated users can view archived shipments" 
ON public.shipments_archive FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert archived shipments" 
ON public.shipments_archive FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can delete archived shipments" 
ON public.shipments_archive FOR DELETE USING (true);

-- Function to archive old shipments (moves orders older than specified days)
CREATE OR REPLACE FUNCTION public.archive_old_shipments(days_to_keep integer DEFAULT 10)
RETURNS TABLE(archived_count bigint, remaining_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_archived_count bigint;
  v_remaining_count bigint;
BEGIN
  -- Insert old shipments into archive
  INSERT INTO shipments_archive (
    id, order_id, uid, location_id, buyer, product_name, quantity, price,
    tracking, address_full, show_date, printed, printed_at, printed_by_user_id,
    bundle, cancelled, order_group_id, group_id_printed, group_id_printed_at,
    group_id_printed_by_user_id, label_url, manifest_url, created_at, user_id,
    raw, search_vector, batch_id, batch_scanned_at, batch_scanned_by_user_id,
    has_issue, issue_marked_at, issue_marked_by_user_id, channel, archived_at
  )
  SELECT 
    id, order_id, uid, location_id, buyer, product_name, quantity, price,
    tracking, address_full, show_date, printed, printed_at, printed_by_user_id,
    bundle, cancelled, order_group_id, group_id_printed, group_id_printed_at,
    group_id_printed_by_user_id, label_url, manifest_url, created_at, user_id,
    raw, search_vector, batch_id, batch_scanned_at, batch_scanned_by_user_id,
    has_issue, issue_marked_at, issue_marked_by_user_id, channel, now()
  FROM shipments
  WHERE show_date < CURRENT_DATE - (days_to_keep || ' days')::interval
    AND show_date IS NOT NULL;
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  -- Delete archived shipments from main table
  DELETE FROM shipments
  WHERE show_date < CURRENT_DATE - (days_to_keep || ' days')::interval
    AND show_date IS NOT NULL;
  
  -- Get remaining count
  SELECT COUNT(*) INTO v_remaining_count FROM shipments;
  
  RETURN QUERY SELECT v_archived_count, v_remaining_count;
END;
$$;

-- Function to search across both active and archived shipments
CREATE OR REPLACE FUNCTION public.search_all_shipments(
  search_term text DEFAULT NULL,
  p_show_date date DEFAULT NULL,
  p_printed boolean DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_include_archive boolean DEFAULT false
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
  is_archived boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH combined_shipments AS (
    -- Active shipments
    SELECT 
      s.id, s.order_id, s.uid, s.location_id, s.buyer,
      s.product_name, s.quantity, s.price, s.tracking,
      s.address_full, s.show_date, s.printed,
      s.printed_at, s.printed_by_user_id,
      s.bundle, s.cancelled, s.order_group_id,
      s.group_id_printed, s.group_id_printed_at,
      s.group_id_printed_by_user_id, s.label_url, s.manifest_url,
      s.created_at, s.user_id, s.search_vector,
      false as is_archived
    FROM shipments s
    
    UNION ALL
    
    -- Archived shipments (only if include_archive is true)
    SELECT 
      sa.id, sa.order_id, sa.uid, sa.location_id, sa.buyer,
      sa.product_name, sa.quantity, sa.price, sa.tracking,
      sa.address_full, sa.show_date, sa.printed,
      sa.printed_at, sa.printed_by_user_id,
      sa.bundle, sa.cancelled, sa.order_group_id,
      sa.group_id_printed, sa.group_id_printed_at,
      sa.group_id_printed_by_user_id, sa.label_url, sa.manifest_url,
      sa.created_at, sa.user_id, sa.search_vector,
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
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND cs.printed = true)
      OR (p_filter = 'unprinted' AND (cs.printed = false OR cs.printed IS NULL))
      OR (p_filter = 'bundled' AND cs.bundle = true)
      OR (p_filter = 'non_bundled' AND (cs.bundle = false OR cs.bundle IS NULL))
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
$$;

-- Function to get stats including archive option
CREATE OR REPLACE FUNCTION public.get_shipments_stats_with_archive(
  search_term text DEFAULT NULL,
  p_show_date date DEFAULT NULL,
  p_printed boolean DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_include_archive boolean DEFAULT false
)
RETURNS TABLE(total bigint, printed bigint, unprinted bigint, exceptions bigint, archived bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH combined AS (
    SELECT s.printed, s.manifest_url, s.cancelled, s.show_date, s.bundle, s.order_group_id,
           s.search_vector, s.uid, s.order_id, s.buyer, s.tracking, s.product_name, 
           s.location_id, s.address_full, false as is_archived
    FROM shipments s
    
    UNION ALL
    
    SELECT sa.printed, sa.manifest_url, sa.cancelled, sa.show_date, sa.bundle, sa.order_group_id,
           sa.search_vector, sa.uid, sa.order_id, sa.buyer, sa.tracking, sa.product_name,
           sa.location_id, sa.address_full, true as is_archived
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
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND c.printed = true)
      OR (p_filter = 'unprinted' AND (c.printed = false OR c.printed IS NULL))
      OR (p_filter = 'bundled' AND c.bundle = true)
      OR (p_filter = 'non_bundled' AND (c.bundle = false OR c.bundle IS NULL))
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
$$;

-- Get archive statistics
CREATE OR REPLACE FUNCTION public.get_archive_stats()
RETURNS TABLE(
  active_count bigint,
  archived_count bigint,
  oldest_active_date date,
  newest_archived_date date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM shipments)::bigint as active_count,
    (SELECT COUNT(*) FROM shipments_archive)::bigint as archived_count,
    (SELECT MIN(show_date) FROM shipments) as oldest_active_date,
    (SELECT MAX(show_date) FROM shipments_archive) as newest_archived_date;
END;
$$;