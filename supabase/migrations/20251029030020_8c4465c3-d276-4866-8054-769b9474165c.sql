-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE IF NOT EXISTS public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- Org members table
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Column mappings table
CREATE TABLE IF NOT EXISTS public.column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mapping JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;

-- Shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  order_id TEXT,
  uid TEXT,
  buyer TEXT,
  label_url TEXT,
  tracking TEXT,
  address_full TEXT,
  product_name TEXT,
  quantity INTEGER,
  price TEXT,
  cancelled TEXT,
  manifest_url TEXT,
  raw JSONB,
  printed BOOLEAN DEFAULT false,
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, uid)
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_org_uid ON public.shipments(org_id, uid);
CREATE INDEX IF NOT EXISTS idx_shipments_org_printed ON public.shipments(org_id, printed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);

-- Print jobs table
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
  uid TEXT,
  order_id TEXT,
  printer_id TEXT,
  printnode_job_id BIGINT,
  label_url TEXT,
  status TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orgs
CREATE POLICY "Users can view their own orgs"
  ON public.orgs FOR SELECT
  USING (id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert orgs"
  ON public.orgs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for org_members
CREATE POLICY "Users can view org members"
  ON public.org_members FOR SELECT
  USING (user_id = auth.uid() OR org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert org members"
  ON public.org_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for column_mappings
CREATE POLICY "Users can view their org mappings"
  ON public.column_mappings FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert mappings"
  ON public.column_mappings FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update mappings"
  ON public.column_mappings FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- RLS Policies for shipments
CREATE POLICY "Users can view their org shipments"
  ON public.shipments FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert shipments"
  ON public.shipments FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update shipments"
  ON public.shipments FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- RLS Policies for print_jobs
CREATE POLICY "Users can view their org print jobs"
  ON public.print_jobs FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert print jobs"
  ON public.print_jobs FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));