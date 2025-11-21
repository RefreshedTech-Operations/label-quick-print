-- Phase 1: Performance Optimization - Add Composite Index
CREATE INDEX IF NOT EXISTS idx_shipments_show_date_printed_created_at 
ON shipments (show_date DESC, printed, created_at DESC)
WHERE show_date IS NOT NULL;

ANALYZE shipments;

-- Phase 1: Add Full-Text Search Infrastructure
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_shipments_search_vector 
ON shipments USING GIN(search_vector);

-- Create auto-update function for search vector
CREATE OR REPLACE FUNCTION generate_shipment_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.uid, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.order_id, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.buyer, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.tracking, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.product_name, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_id, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.address_full, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.order_group_id::text, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shipment_search_vector ON shipments;
CREATE TRIGGER update_shipment_search_vector
  BEFORE INSERT OR UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION generate_shipment_search_vector();

-- Backfill existing records in batches
DO $$
DECLARE
  batch_size INTEGER := 1000;
  updated_count INTEGER;
BEGIN
  LOOP
    UPDATE shipments
    SET search_vector = 
      setweight(to_tsvector('english', COALESCE(uid, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(order_id, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(buyer, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(tracking, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(product_name, '')), 'C') ||
      setweight(to_tsvector('english', COALESCE(location_id, '')), 'C') ||
      setweight(to_tsvector('english', COALESCE(address_full, '')), 'D') ||
      setweight(to_tsvector('english', COALESCE(order_group_id::text, '')), 'A')
    WHERE search_vector IS NULL
    AND id IN (
      SELECT id FROM shipments 
      WHERE search_vector IS NULL 
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    EXIT WHEN updated_count = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;

-- Phase 1: Update search_shipments function with p_filter and full-text search
CREATE OR REPLACE FUNCTION public.search_shipments(
  search_term text,
  p_show_date date DEFAULT NULL,
  p_printed boolean DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  order_id text,
  uid text,
  location_id text,
  buyer text,
  product_name text,
  quantity integer,
  price text,
  tracking text,
  address_full text,
  show_date date,
  printed boolean,
  printed_at timestamp with time zone,
  printed_by_user_id uuid,
  bundle boolean,
  cancelled text,
  order_group_id uuid,
  group_id_printed boolean,
  group_id_printed_at timestamp with time zone,
  group_id_printed_by_user_id uuid,
  label_url text,
  manifest_url text,
  created_at timestamp with time zone,
  user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.order_id,
    s.uid,
    s.location_id,
    s.buyer,
    s.product_name,
    s.quantity,
    s.price,
    s.tracking,
    s.address_full,
    s.show_date,
    s.printed,
    s.printed_at,
    s.printed_by_user_id,
    s.bundle,
    s.cancelled,
    s.order_group_id,
    s.group_id_printed,
    s.group_id_printed_at,
    s.group_id_printed_by_user_id,
    s.label_url,
    s.manifest_url,
    s.created_at,
    s.user_id
  FROM shipments s
  WHERE 
    (p_show_date IS NULL OR s.show_date = p_show_date)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND s.printed = true)
      OR (p_filter = 'unprinted' AND (s.printed = false OR s.printed IS NULL))
      OR (p_filter = 'bundled' AND s.bundle = true)
      OR (p_filter = 'exceptions' AND (s.manifest_url IS NULL OR s.cancelled IS NOT NULL))
      OR (p_printed IS NOT NULL AND s.printed = p_printed)
    )
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR (
        CASE 
          WHEN s.search_vector IS NOT NULL 
          THEN s.search_vector @@ plainto_tsquery('english', search_term)
          ELSE (
            COALESCE(s.uid, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.order_id, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.order_group_id::text, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.buyer, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.tracking, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.product_name, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.location_id, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.address_full, '') ILIKE '%' || search_term || '%'
          )
        END
      )
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
$$;

-- Phase 1: Update get_shipments_stats function with p_filter
CREATE OR REPLACE FUNCTION public.get_shipments_stats(
  search_term text DEFAULT NULL,
  p_show_date date DEFAULT NULL,
  p_printed boolean DEFAULT NULL,
  p_filter text DEFAULT 'all'
)
RETURNS TABLE(
  total bigint,
  printed bigint,
  unprinted bigint,
  exceptions bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE s.printed = true)::bigint as printed,
    COUNT(*) FILTER (WHERE s.printed = false OR s.printed IS NULL)::bigint as unprinted,
    COUNT(*) FILTER (WHERE s.manifest_url IS NULL OR s.cancelled IS NOT NULL)::bigint as exceptions
  FROM shipments s
  WHERE 
    (p_show_date IS NULL OR s.show_date = p_show_date)
    AND (
      p_filter = 'all'
      OR (p_filter = 'printed' AND s.printed = true)
      OR (p_filter = 'unprinted' AND (s.printed = false OR s.printed IS NULL))
      OR (p_filter = 'bundled' AND s.bundle = true)
      OR (p_filter = 'exceptions' AND (s.manifest_url IS NULL OR s.cancelled IS NOT NULL))
      OR (p_printed IS NOT NULL AND s.printed = p_printed)
    )
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR (
        CASE 
          WHEN s.search_vector IS NOT NULL 
          THEN s.search_vector @@ plainto_tsquery('english', search_term)
          ELSE (
            COALESCE(s.uid, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.order_id, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.order_group_id::text, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.buyer, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.tracking, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.product_name, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.location_id, '') ILIKE '%' || search_term || '%'
            OR COALESCE(s.address_full, '') ILIKE '%' || search_term || '%'
          )
        END
      )
    );
END;
$$;