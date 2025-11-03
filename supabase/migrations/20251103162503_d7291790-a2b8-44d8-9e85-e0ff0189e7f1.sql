-- Add location_id column to shipments table
ALTER TABLE public.shipments 
ADD COLUMN location_id text;