-- Create a function to efficiently get show_date counts
CREATE OR REPLACE FUNCTION get_show_date_counts(limit_rows int DEFAULT 5)
RETURNS TABLE (show_date date, count bigint) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    shipments.show_date,
    COUNT(*) as count
  FROM shipments
  WHERE shipments.show_date IS NOT NULL
  GROUP BY shipments.show_date
  ORDER BY shipments.show_date DESC
  LIMIT limit_rows;
$$;