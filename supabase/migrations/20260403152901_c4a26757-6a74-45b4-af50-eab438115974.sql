ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS upload_id uuid;
CREATE INDEX IF NOT EXISTS idx_shipments_upload_id ON public.shipments(upload_id);