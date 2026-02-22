
-- Drop function CASCADE (takes policies with it)
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Change column type
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;

-- Drop the enum
DROP TYPE IF EXISTS public.app_role;

-- Recreate has_role with text
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Recreate all dropped policies
CREATE POLICY "Batch creators and admins can update batches" ON public.batches
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by_user_id OR has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by_user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Batch creators and admins can delete batches" ON public.batches
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by_user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage locations" ON public.bundle_locations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert kit devices" ON public.kit_devices
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update kit devices" ON public.kit_devices
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete kit devices" ON public.kit_devices
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Messaging users can view customers" ON public.customers
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can view conversations" ON public.sms_conversations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can insert conversations" ON public.sms_conversations
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can update conversations" ON public.sms_conversations
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can view messages" ON public.sms_messages
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Messaging users can insert messages" ON public.sms_messages
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'messaging'));

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage page permissions" ON public.user_page_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage role defaults" ON public.role_page_defaults
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
