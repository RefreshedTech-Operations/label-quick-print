-- Add performance indexes for analytics queries
-- These indexes significantly improve query performance for date-based filtering

-- Index for shipments table (most common queries)
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON public.shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_printed ON public.shipments(printed) WHERE printed = true;
CREATE INDEX IF NOT EXISTS idx_shipments_bundle ON public.shipments(bundle) WHERE bundle = true;
CREATE INDEX IF NOT EXISTS idx_shipments_cancelled ON public.shipments(cancelled) WHERE cancelled = 'yes';

-- Composite index for date range + status queries
CREATE INDEX IF NOT EXISTS idx_shipments_created_printed ON public.shipments(created_at DESC, printed);

-- Index for print_jobs table
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON public.print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON public.print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_id ON public.print_jobs(printer_id) WHERE printer_id IS NOT NULL;

-- Composite index for date range + status queries
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_status ON public.print_jobs(created_at DESC, status);

-- Analyze tables to update statistics for query planner
ANALYZE public.shipments;
ANALYZE public.print_jobs;