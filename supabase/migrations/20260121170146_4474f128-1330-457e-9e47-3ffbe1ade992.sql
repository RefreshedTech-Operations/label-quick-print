-- Replace archive function with batched version to avoid timeouts
CREATE OR REPLACE FUNCTION archive_old_shipments(days_to_keep integer DEFAULT 10, batch_size integer DEFAULT 5000)
RETURNS TABLE(archived_count bigint, remaining_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_archived bigint := 0;
  v_batch_archived bigint := 0;
  v_remaining_count bigint;
  v_cutoff_date date;
BEGIN
  v_cutoff_date := CURRENT_DATE - (days_to_keep || ' days')::interval;
  
  -- Process in batches until no more records to archive
  LOOP
    -- Move batch to archive and delete from source
    WITH to_archive AS (
      SELECT id FROM shipments
      WHERE show_date < v_cutoff_date
        AND show_date IS NOT NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    ),
    archived AS (
      INSERT INTO shipments_archive (
        id, order_id, uid, location_id, buyer, product_name, quantity, price,
        tracking, address_full, show_date, printed, printed_at, printed_by_user_id,
        bundle, cancelled, order_group_id, group_id_printed, group_id_printed_at,
        group_id_printed_by_user_id, label_url, manifest_url, created_at, user_id,
        raw, search_vector, batch_id, batch_scanned_at, batch_scanned_by_user_id,
        has_issue, issue_marked_at, issue_marked_by_user_id, channel, archived_at
      )
      SELECT 
        s.id, s.order_id, s.uid, s.location_id, s.buyer, s.product_name, s.quantity, s.price,
        s.tracking, s.address_full, s.show_date, s.printed, s.printed_at, s.printed_by_user_id,
        s.bundle, s.cancelled, s.order_group_id, s.group_id_printed, s.group_id_printed_at,
        s.group_id_printed_by_user_id, s.label_url, s.manifest_url, s.created_at, s.user_id,
        s.raw, s.search_vector, s.batch_id, s.batch_scanned_at, s.batch_scanned_by_user_id,
        s.has_issue, s.issue_marked_at, s.issue_marked_by_user_id, s.channel, now()
      FROM shipments s
      WHERE s.id IN (SELECT id FROM to_archive)
      RETURNING id
    )
    DELETE FROM shipments WHERE id IN (SELECT id FROM archived);
    
    GET DIAGNOSTICS v_batch_archived = ROW_COUNT;
    v_total_archived := v_total_archived + v_batch_archived;
    
    -- Exit when no more records to process
    EXIT WHEN v_batch_archived = 0;
  END LOOP;
  
  -- Get remaining count
  SELECT COUNT(*) INTO v_remaining_count FROM shipments;
  
  RETURN QUERY SELECT v_total_archived, v_remaining_count;
END;
$$;