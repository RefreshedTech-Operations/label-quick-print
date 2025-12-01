-- Create function to get incomplete bundles for a specific show date
CREATE OR REPLACE FUNCTION get_incomplete_bundles_for_date(
  p_show_date date,
  p_printed_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  tracking text,
  buyer text,
  printed_today_count bigint,
  unprinted_count bigint,
  total_count bigint,
  printed_items jsonb,
  unprinted_items jsonb
) 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH bundle_stats AS (
    SELECT 
      s.tracking,
      s.buyer,
      COUNT(*) FILTER (
        WHERE s.printed = true 
        AND DATE(s.printed_at AT TIME ZONE 'America/New_York') = p_printed_date
      )::bigint as printed_today,
      COUNT(*) FILTER (WHERE s.printed = false OR s.printed IS NULL)::bigint as unprinted,
      COUNT(*)::bigint as total
    FROM shipments s
    WHERE s.show_date = p_show_date
      AND s.tracking IS NOT NULL
      AND s.tracking != ''
    GROUP BY s.tracking, s.buyer
    HAVING 
      COUNT(*) FILTER (
        WHERE s.printed = true 
        AND DATE(s.printed_at AT TIME ZONE 'America/New_York') = p_printed_date
      ) > 0
      AND COUNT(*) FILTER (WHERE s.printed = false OR s.printed IS NULL) > 0
  )
  SELECT 
    bs.tracking,
    bs.buyer,
    bs.printed_today as printed_today_count,
    bs.unprinted as unprinted_count,
    bs.total as total_count,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'uid', s.uid,
          'product_name', s.product_name,
          'price', s.price,
          'order_id', s.order_id,
          'printed_at', s.printed_at
        )
      )
      FROM shipments s
      WHERE s.tracking = bs.tracking
        AND s.show_date = p_show_date
        AND s.printed = true
        AND DATE(s.printed_at AT TIME ZONE 'America/New_York') = p_printed_date
    ) as printed_items,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'uid', s.uid,
          'product_name', s.product_name,
          'price', s.price,
          'order_id', s.order_id,
          'label_url', s.label_url
        )
      )
      FROM shipments s
      WHERE s.tracking = bs.tracking
        AND s.show_date = p_show_date
        AND (s.printed = false OR s.printed IS NULL)
    ) as unprinted_items
  FROM bundle_stats bs
  ORDER BY bs.unprinted DESC, bs.tracking;
END;
$$;