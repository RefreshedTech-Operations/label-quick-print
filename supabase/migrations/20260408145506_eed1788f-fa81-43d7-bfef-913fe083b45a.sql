CREATE OR REPLACE FUNCTION public.get_generated_label_date_counts(p_channel text DEFAULT NULL)
RETURNS TABLE(show_date date, count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.show_date, COUNT(*)::int AS count
  FROM public.shipments s
  WHERE s.label_url IS NOT NULL
    AND s.label_url != ''
    AND s.show_date IS NOT NULL
    AND (p_channel IS NULL OR s.channel = p_channel)
  GROUP BY s.show_date
  ORDER BY s.show_date DESC
  LIMIT 5;
$$;