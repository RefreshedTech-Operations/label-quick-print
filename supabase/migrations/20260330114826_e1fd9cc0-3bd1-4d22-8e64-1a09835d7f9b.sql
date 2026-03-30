ALTER TABLE public.shipments ADD COLUMN shipping_price text DEFAULT NULL;
ALTER TABLE public.shipments_archive ADD COLUMN shipping_price text DEFAULT NULL;