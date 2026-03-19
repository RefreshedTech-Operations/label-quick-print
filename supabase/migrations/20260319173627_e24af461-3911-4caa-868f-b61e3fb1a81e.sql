ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS shipping_provider text;
ALTER TABLE public.shipments_archive ADD COLUMN IF NOT EXISTS shipping_provider text;