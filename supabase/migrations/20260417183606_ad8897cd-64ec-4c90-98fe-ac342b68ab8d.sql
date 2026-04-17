ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS packed_by_name text;
ALTER TABLE public.shipments_archive ADD COLUMN IF NOT EXISTS packed_by_name text;