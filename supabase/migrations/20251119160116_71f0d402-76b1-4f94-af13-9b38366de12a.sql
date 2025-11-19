-- Add indexes for performance optimization
-- These indexes will dramatically improve query performance on large datasets

-- Index on show_date for filtering by date
CREATE INDEX IF NOT EXISTS idx_shipments_show_date ON public.shipments(show_date DESC);

-- Index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments(created_at DESC);

-- Index on printed for filtering printed/unprinted orders
CREATE INDEX IF NOT EXISTS idx_shipments_printed ON public.shipments(printed);

-- Index on bundle for filtering bundled items
CREATE INDEX IF NOT EXISTS idx_shipments_bundle ON public.shipments(bundle);

-- Index on uid for searching
CREATE INDEX IF NOT EXISTS idx_shipments_uid ON public.shipments(uid);

-- Composite index for common query patterns (show_date + created_at)
CREATE INDEX IF NOT EXISTS idx_shipments_show_date_created_at ON public.shipments(show_date DESC, created_at DESC);

-- Composite index for filtering by printed status and ordering
CREATE INDEX IF NOT EXISTS idx_shipments_printed_created_at ON public.shipments(printed, created_at DESC);