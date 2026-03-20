ALTER TABLE public.shipments ADD COLUMN shipping_cost numeric(10,2) DEFAULT NULL;
ALTER TABLE public.shipments_archive ADD COLUMN shipping_cost numeric(10,2) DEFAULT NULL;