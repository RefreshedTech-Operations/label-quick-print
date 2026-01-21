
-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.archive_old_shipments(integer, integer);

-- Create new single-batch function for client-side iteration
CREATE OR REPLACE FUNCTION public.archive_shipments_batch(
  days_to_keep integer,
  batch_size integer DEFAULT 1000
)
RETURNS TABLE(batch_archived bigint, total_remaining bigint, has_more boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff_date date;
  v_batch_count bigint;
  v_remaining bigint;
BEGIN
  -- Validate input
  IF days_to_keep < 1 THEN
    RAISE EXCEPTION 'days_to_keep must be at least 1';
  END IF;
  
  IF batch_size < 1 OR batch_size > 5000 THEN
    batch_size := 1000;
  END IF;

  v_cutoff_date := CURRENT_DATE - days_to_keep;
  
  -- Archive one batch using CTE
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
      manifest_url, location_id, channel
    )
    SELECT 
      s.id, s.order_id, s.uid, s.buyer, s.label_url, s.tracking, s.address_full,
      s.product_name, s.price, s.quantity, s.raw, s.printed, s.printed_at,
      s.created_at, s.user_id, s.show_date, s.printed_by_user_id, s.bundle,
      s.order_group_id, s.group_id_printed, s.group_id_printed_at,
      s.group_id_printed_by_user_id, s.search_vector, s.batch_id,
      s.batch_scanned_at, s.batch_scanned_by_user_id, s.has_issue,
      s.issue_marked_at, s.issue_marked_by_user_id, s.cancelled,
      s.manifest_url, s.location_id, s.channel
    FROM shipments s
    WHERE s.id IN (SELECT id FROM to_archive)
    RETURNING id
  )
  DELETE FROM shipments WHERE id IN (SELECT id FROM archived);
  
  GET DIAGNOSTICS v_batch_count = ROW_COUNT;
  
  -- Count remaining eligible records
  SELECT COUNT(*) INTO v_remaining 
  FROM shipments 
  WHERE show_date IS NOT NULL AND show_date < v_cutoff_date;
  
  RETURN QUERY SELECT v_batch_count, v_remaining, (v_remaining > 0);
END;
$$;

-- Update get_archive_stats to also return eligible count for a given days_to_keep
CREATE OR REPLACE FUNCTION public.get_archive_stats()
RETURNS TABLE(
  active_count bigint,
  archived_count bigint,
  oldest_active_date date,
  newest_archived_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM shipments)::bigint,
    (SELECT COUNT(*) FROM shipments_archive)::bigint,
    (SELECT MIN(show_date) FROM shipments),
    (SELECT MAX(show_date) FROM shipments_archive);
END;
$$;
