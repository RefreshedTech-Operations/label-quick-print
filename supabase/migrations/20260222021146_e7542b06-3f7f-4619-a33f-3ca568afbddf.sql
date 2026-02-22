
-- Table for per-user page permission overrides
CREATE TABLE public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_path text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_path)
);

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage page permissions
CREATE POLICY "Admins can manage page permissions"
ON public.user_page_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own page permissions
CREATE POLICY "Users can view own page permissions"
ON public.user_page_permissions
FOR SELECT
USING (auth.uid() = user_id);
