-- Create app_config table for application-level configuration
CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printnode_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read the config
CREATE POLICY "Authenticated users can view app config" 
ON public.app_config 
FOR SELECT 
TO authenticated
USING (true);

-- Only allow the first user or admin to insert/update (you can modify this later)
CREATE POLICY "Authenticated users can update app config" 
ON public.app_config 
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert a single row for the configuration
INSERT INTO public.app_config (printnode_api_key) VALUES (NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();