-- Create a function to search shipments with text casting support for UUIDs
CREATE OR REPLACE FUNCTION public.search_shipments(
  search_term text,
  p_show_date date DEFAULT NULL,
  p_printed boolean DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
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
SET search_path = public
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
    AND (p_printed IS NULL OR s.printed = p_printed)
    AND (
      search_term IS NULL 
      OR search_term = ''
      OR s.uid ILIKE '%' || search_term || '%'
      OR s.order_id ILIKE '%' || search_term || '%'
      OR s.order_group_id::text ILIKE '%' || search_term || '%'
      OR s.buyer ILIKE '%' || search_term || '%'
      OR s.tracking ILIKE '%' || search_term || '%'
      OR s.product_name ILIKE '%' || search_term || '%'
      OR s.location_id ILIKE '%' || search_term || '%'
      OR s.address_full ILIKE '%' || search_term || '%'
      OR s.price ILIKE '%' || search_term || '%'
      OR s.cancelled ILIKE '%' || search_term || '%'
    )
  ORDER BY s.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;