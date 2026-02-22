
-- Pack stations table
CREATE TABLE public.pack_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pack_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stations" ON public.pack_stations
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view stations" ON public.pack_stations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add pack columns to shipments
ALTER TABLE public.shipments
  ADD COLUMN packed boolean DEFAULT false,
  ADD COLUMN packed_at timestamptz,
  ADD COLUMN packed_by_user_id uuid,
  ADD COLUMN pack_station_id uuid REFERENCES public.pack_stations(id);

-- Add pack columns to shipments_archive
ALTER TABLE public.shipments_archive
  ADD COLUMN packed boolean DEFAULT false,
  ADD COLUMN packed_at timestamptz,
  ADD COLUMN packed_by_user_id uuid,
  ADD COLUMN pack_station_id uuid;

-- Update role_page_defaults: replace /batches with /pack
UPDATE public.role_page_defaults SET page_path = '/pack' WHERE page_path = '/batches';

-- Update user_page_permissions: replace /batches with /pack
UPDATE public.user_page_permissions SET page_path = '/pack' WHERE page_path = '/batches';

-- Update archive function to include pack columns
CREATE OR REPLACE FUNCTION public.archive_shipments_batch(days_to_keep integer, batch_size integer DEFAULT 1000)
 RETURNS TABLE(batch_archived bigint, total_remaining bigint, has_more boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff_date date;
  v_batch_count bigint;
  v_remaining bigint;
BEGIN
  IF days_to_keep < 1 THEN
    RAISE EXCEPTION 'days_to_keep must be at least 1';
  END IF;
  
  IF batch_size < 1 OR batch_size > 5000 THEN
    batch_size := 1000;
  END IF;

  v_cutoff_date := CURRENT_DATE - days_to_keep;
  
  WITH to_archive AS (
    SELECT id FROM shipments
    WHERE show_date IS NOT NULL AND show_date < v_cutoff_date
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  archived AS (
    INSERT INTO shipments_archive (
      id, order_id, uid, buyer, label_url, tracking, address_full,
      product_name, price, quantity, raw, printed, printed_at,
      created_at, user_id, show_date, printed_by_user_id, bundle,
      order_group_id, group_id_printed, group_id_printed_at,
      group_id_printed_by_user_id, search_vector, batch_id,
      batch_scanned_at, batch_scanned_by_user_id, has_issue,
      issue_marked_at, issue_marked_by_user_id, cancelled,
      manifest_url, location_id, channel,
      packed, packed_at, packed_by_user_id, pack_station_id
    )
    SELECT 
      s.id, s.order_id, s.uid, s.buyer, s.label_url, s.tracking, s.address_full,
      s.product_name, s.price, s.quantity, s.raw, s.printed, s.printed_at,
      s.created_at, s.user_id, s.show_date, s.printed_by_user_id, s.bundle,
      s.order_group_id, s.group_id_printed, s.group_id_printed_at,
      s.group_id_printed_by_user_id, s.search_vector, s.batch_id,
      s.batch_scanned_at, s.batch_scanned_by_user_id, s.has_issue,
      s.issue_marked_at, s.issue_marked_by_user_id, s.cancelled,
      s.manifest_url, s.location_id, s.channel,
      s.packed, s.packed_at, s.packed_by_user_id, s.pack_station_id
    FROM shipments s
    WHERE s.id IN (SELECT id FROM to_archive)
    RETURNING id
  )
  DELETE FROM shipments WHERE id IN (SELECT id FROM archived);
  
  GET DIAGNOSTICS v_batch_count = ROW_COUNT;
  
  SELECT COUNT(*) INTO v_remaining 
  FROM shipments 
  WHERE show_date IS NOT NULL AND show_date < v_cutoff_date;
  
  RETURN QUERY SELECT v_batch_count, v_remaining, (v_remaining > 0);
END;
$function$;
