
CREATE TABLE public.role_page_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  page_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, page_path)
);

ALTER TABLE public.role_page_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view role defaults"
  ON public.role_page_defaults FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage role defaults"
  ON public.role_page_defaults FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.role_page_defaults (role, page_path) VALUES
  ('admin', '/'), ('admin', '/upload'), ('admin', '/orders'),
  ('admin', '/print-jobs'), ('admin', '/batches'), ('admin', '/tv-dashboard'),
  ('admin', '/messages'), ('admin', '/customers'), ('admin', '/settings'), ('admin', '/admin'),
  ('moderator', '/'), ('moderator', '/upload'), ('moderator', '/orders'),
  ('moderator', '/print-jobs'), ('moderator', '/batches'), ('moderator', '/tv-dashboard'),
  ('moderator', '/settings'),
  ('user', '/'), ('user', '/upload'), ('user', '/orders'),
  ('user', '/print-jobs'), ('user', '/batches'), ('user', '/tv-dashboard'),
  ('user', '/settings'),
  ('messaging', '/messages'), ('messaging', '/customers');
