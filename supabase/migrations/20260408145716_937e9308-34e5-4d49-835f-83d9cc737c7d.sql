CREATE OR REPLACE FUNCTION public.get_missing_label_date_counts(limit_rows int DEFAULT 5)
RETURNS TABLE(show_date date, total_count int, missing_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.show_date,
    COUNT(*)::int AS total_count,
    COUNT(*) FILTER (
      WHERE (s.label_url IS NULL OR s.label_url = '')
        AND (s.tracking IS NULL OR s.tracking = '')
    )::int AS missing_count
  FROM public.shipments s
  WHERE s.show_date IS NOT NULL
  GROUP BY s.show_date
  HAVING COUNT(*) FILTER (
    WHERE (s.label_url IS NULL OR s.label_url = '')
      AND (s.tracking IS NULL OR s.tracking = '')
  ) > 0
  ORDER BY s.show_date DESC
  LIMIT limit_rows;
$$;