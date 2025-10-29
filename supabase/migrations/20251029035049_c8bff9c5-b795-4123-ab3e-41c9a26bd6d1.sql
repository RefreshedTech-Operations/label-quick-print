-- Add printnode_api_key column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN printnode_api_key TEXT;