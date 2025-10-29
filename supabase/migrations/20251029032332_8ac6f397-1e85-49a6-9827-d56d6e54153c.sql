-- Add show_date column to shipments table
ALTER TABLE public.shipments 
ADD COLUMN show_date DATE;

-- Add an index for better query performance
CREATE INDEX idx_shipments_show_date ON public.shipments(show_date);