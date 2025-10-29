-- Drop existing app_config table
DROP TABLE IF EXISTS public.app_config CASCADE;

-- Create generic app_config table with key-value pairs
CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read config
CREATE POLICY "Authenticated users can view app config" 
ON public.app_config 
FOR SELECT 
TO authenticated
USING (true);

-- Allow all authenticated users to update config
CREATE POLICY "Authenticated users can update app config" 
ON public.app_config 
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert default configuration values
INSERT INTO public.app_config (key, value) VALUES 
  ('printnode_api_key', NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();