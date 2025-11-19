-- Phase 1: Database Performance Indexes (Fixed)

-- Add standalone UID index for instant UID lookups
CREATE INDEX IF NOT EXISTS idx_shipments_uid ON public.shipments USING btree (uid);

-- Add pattern indexes for faster ILIKE searches on TEXT columns only
CREATE INDEX IF NOT EXISTS idx_shipments_uid_pattern ON public.shipments USING btree (upper(uid) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_pattern ON public.shipments USING btree (upper(tracking) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_shipments_location_pattern ON public.shipments USING btree (upper(location_id) text_pattern_ops);

-- Add index for order_group_id (UUID column - no upper() needed)
CREATE INDEX IF NOT EXISTS idx_shipments_order_group_id ON public.shipments USING btree (order_group_id);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shipments_printed_created ON public.shipments USING btree (printed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_cancelled_created ON public.shipments USING btree (cancelled, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_bundle_created ON public.shipments USING btree (bundle, created_at DESC);