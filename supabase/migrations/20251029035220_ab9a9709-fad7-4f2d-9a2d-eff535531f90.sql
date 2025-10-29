-- Remove printnode_api_key column from user_settings table
ALTER TABLE public.user_settings 
DROP COLUMN printnode_api_key;