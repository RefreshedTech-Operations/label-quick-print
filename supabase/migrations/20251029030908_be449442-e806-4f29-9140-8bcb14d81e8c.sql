-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view their org shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can update shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can view their org print jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Users can insert print jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Users can view their org mappings" ON public.column_mappings;
DROP POLICY IF EXISTS "Users can insert mappings" ON public.column_mappings;
DROP POLICY IF EXISTS "Users can update mappings" ON public.column_mappings;

-- Add user_id columns and remove org_id
ALTER TABLE public.shipments DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.shipments ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.print_jobs DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.print_jobs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.column_mappings DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.column_mappings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update unique constraint on shipments
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_org_id_uid_key;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_user_id_uid_key UNIQUE (user_id, uid);

-- Recreate indexes
DROP INDEX IF EXISTS idx_shipments_org_uid;
DROP INDEX IF EXISTS idx_shipments_org_printed;
CREATE INDEX idx_shipments_user_uid ON public.shipments(user_id, uid);
CREATE INDEX idx_shipments_user_printed ON public.shipments(user_id, printed, created_at DESC);

-- New RLS policies for shipments
CREATE POLICY "Users can view their own shipments"
  ON public.shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipments"
  ON public.shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments"
  ON public.shipments FOR UPDATE
  USING (auth.uid() = user_id);

-- New RLS policies for print_jobs
CREATE POLICY "Users can view their own print jobs"
  ON public.print_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own print jobs"
  ON public.print_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- New RLS policies for column_mappings
CREATE POLICY "Users can view their own mappings"
  ON public.column_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mappings"
  ON public.column_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mappings"
  ON public.column_mappings FOR UPDATE
  USING (auth.uid() = user_id);

-- Drop org-related tables (cascades will clean up foreign keys)
DROP TABLE IF EXISTS public.org_members CASCADE;
DROP TABLE IF EXISTS public.orgs CASCADE;