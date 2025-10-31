-- Add group ID printed tracking columns to shipments table
ALTER TABLE public.shipments 
ADD COLUMN group_id_printed boolean DEFAULT false,
ADD COLUMN group_id_printed_at timestamp with time zone,
ADD COLUMN group_id_printed_by_user_id uuid;