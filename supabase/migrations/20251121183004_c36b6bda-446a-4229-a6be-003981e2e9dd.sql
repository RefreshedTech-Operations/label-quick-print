-- Create batches table first
CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'scanning',
  show_date date,
  package_count integer NOT NULL DEFAULT 0,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  shipped_at timestamp with time zone,
  notes text,
  CONSTRAINT valid_status CHECK (status IN ('scanning', 'complete', 'shipped'))
);

-- Enable RLS on batches table
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batches table
CREATE POLICY "Authenticated users can view all batches"
  ON public.batches
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create batches"
  ON public.batches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Batch creators can update their batches"
  ON public.batches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id)
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Batch creators can delete their batches"
  ON public.batches
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- Now add batch tracking columns to shipments table
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS batch_scanned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS batch_scanned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Function to get batch statistics
CREATE OR REPLACE FUNCTION public.get_batch_stats(batch_uuid uuid)
RETURNS TABLE (
  total_packages bigint,
  scanned_packages bigint,
  remaining_packages bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(b.package_count, 0)::bigint as total_packages,
    COUNT(s.id)::bigint as scanned_packages,
    (COALESCE(b.package_count, 0) - COUNT(s.id))::bigint as remaining_packages
  FROM batches b
  LEFT JOIN shipments s ON s.batch_id = b.id
  WHERE b.id = batch_uuid
  GROUP BY b.id, b.package_count;
END;
$$;

-- Function to increment batch package count
CREATE OR REPLACE FUNCTION public.increment_batch_count(batch_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE batches
  SET package_count = package_count + 1
  WHERE id = batch_uuid;
END;
$$;

-- Function to get scan-eligible shipments
CREATE OR REPLACE FUNCTION public.get_scan_eligible_shipments(
  p_show_date date,
  p_batch_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  tracking text,
  order_id text,
  buyer text,
  product_name text,
  printed boolean,
  batch_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.tracking,
    s.order_id,
    s.buyer,
    s.product_name,
    s.printed,
    s.batch_id
  FROM shipments s
  WHERE 
    (p_show_date IS NULL OR s.show_date = p_show_date)
    AND s.tracking IS NOT NULL
    AND s.tracking != ''
    AND (p_batch_id IS NULL OR s.batch_id = p_batch_id OR s.batch_id IS NULL)
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_batch_id ON public.shipments(batch_id);
CREATE INDEX IF NOT EXISTS idx_shipments_batch_scanned_at ON public.shipments(batch_scanned_at);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_show_date ON public.batches(show_date);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_batches_status_created_at ON public.batches(status, created_at DESC);

-- Partial indexes for active batches
CREATE INDEX IF NOT EXISTS idx_batches_scanning ON public.batches(created_at DESC) WHERE status = 'scanning';
CREATE INDEX IF NOT EXISTS idx_batches_complete ON public.batches(created_at DESC) WHERE status = 'complete';