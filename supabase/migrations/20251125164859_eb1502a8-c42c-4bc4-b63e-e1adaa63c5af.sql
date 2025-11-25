-- Create bundle_locations table
CREATE TABLE public.bundle_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code text UNIQUE NOT NULL,
  category text NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bundle_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view locations"
ON public.bundle_locations
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage locations"
ON public.bundle_locations
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed Main locations (1-135)
INSERT INTO public.bundle_locations (location_code, category, sort_order)
SELECT 
  i::text,
  'main',
  i
FROM generate_series(1, 135) AS i;

-- Seed C2B locations (C2B1-C2B15)
INSERT INTO public.bundle_locations (location_code, category, sort_order)
SELECT 
  'C2B' || i::text,
  'c2b',
  135 + i
FROM generate_series(1, 15) AS i;

-- Seed Misfit locations (Misfit 1-10)
INSERT INTO public.bundle_locations (location_code, category, sort_order)
SELECT 
  'Misfit ' || i::text,
  'misfit',
  150 + i
FROM generate_series(1, 10) AS i;

-- Function: Get next available location
CREATE OR REPLACE FUNCTION public.get_next_available_location()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bl.location_code
  FROM bundle_locations bl
  WHERE bl.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.location_id = bl.location_code
        AND s.bundle = true
        AND (s.printed = false OR s.printed IS NULL)
    )
  ORDER BY bl.sort_order
  LIMIT 1;
$$;

-- Function: Assign location to entire bundle group
CREATE OR REPLACE FUNCTION public.assign_location_to_bundle(
  p_order_group_id uuid,
  p_location_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE shipments
  SET location_id = p_location_code
  WHERE order_group_id = p_order_group_id;
END;
$$;