-- Create function to get shipment statistics without pagination
CREATE OR REPLACE FUNCTION public.get_shipments_stats(
  search_term text DEFAULT NULL,
  p_show_date date DEFAULT NULL
)
RETURNS TABLE (
  total bigint,
  printed bigint,
  unprinted bigint,
  exceptions bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
    );
END;
$$;