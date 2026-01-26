-- Drop the existing constraint
ALTER TABLE public.shipments 
DROP CONSTRAINT shipments_channel_check;

-- Add updated constraint with outlet channel
ALTER TABLE public.shipments 
ADD CONSTRAINT shipments_channel_check 
CHECK (channel = ANY (ARRAY['regular'::text, 'misfits'::text, 'outlet'::text]));