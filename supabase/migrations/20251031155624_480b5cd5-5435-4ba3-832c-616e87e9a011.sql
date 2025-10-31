-- Add columns to support order grouping
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS bundle boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS order_group_id uuid;

-- Create index for faster grouping queries
CREATE INDEX IF NOT EXISTS idx_shipments_order_group_id ON public.shipments(order_group_id);
CREATE INDEX IF NOT EXISTS idx_shipments_buyer ON public.shipments(buyer);