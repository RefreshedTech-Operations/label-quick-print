-- Add printed_by_user_id to shipments table to track who printed the label
ALTER TABLE public.shipments
ADD COLUMN printed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;