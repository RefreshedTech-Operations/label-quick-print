-- Drop the unique constraint on user_id and uid to allow duplicate UIDs per user
ALTER TABLE public.shipments 
DROP CONSTRAINT IF EXISTS shipments_user_id_uid_key;