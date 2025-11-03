-- First, update any NULL order_ids to a generated value
UPDATE public.shipments 
SET order_id = 'UNKNOWN_' || id::text
WHERE order_id IS NULL;

-- For duplicate order_ids, keep the earliest created one and update the rest
WITH duplicates AS (
  SELECT id, order_id,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at ASC) as rn
  FROM public.shipments
  WHERE order_id IS NOT NULL
)
UPDATE public.shipments s
SET order_id = s.order_id || '_DUP_' || s.id::text
FROM duplicates d
WHERE s.id = d.id AND d.rn > 1;

-- Now add the NOT NULL constraint
ALTER TABLE public.shipments 
ALTER COLUMN order_id SET NOT NULL;

-- Add the UNIQUE constraint
ALTER TABLE public.shipments 
ADD CONSTRAINT shipments_order_id_unique UNIQUE (order_id);