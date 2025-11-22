-- ========================================
-- STEP 1: Find Your Last Upload
-- ========================================
-- Run this first to see what will be deleted
SELECT 
  created_at as upload_time,
  COUNT(*) as record_count,
  COUNT(DISTINCT order_group_id) as bundle_groups,
  COUNT(*) FILTER (WHERE bundle = true) as bundled_orders,
  MIN(order_id) as sample_order_1,
  MAX(order_id) as sample_order_2
FROM shipments
WHERE created_at = (
  SELECT MAX(created_at)
  FROM shipments
)
GROUP BY created_at;

-- ========================================
-- STEP 2: Delete the Upload (CAREFUL!)
-- ========================================
-- Copy the upload_time from Step 1 and paste it below
-- Replace 'YOUR_TIMESTAMP_HERE' with the actual timestamp

-- First, delete related print jobs
DELETE FROM print_jobs
WHERE shipment_id IN (
  SELECT id FROM shipments
  WHERE created_at = 'YOUR_TIMESTAMP_HERE'  -- ⚠️ REPLACE THIS
);

-- Then, delete the shipments
DELETE FROM shipments
WHERE created_at = 'YOUR_TIMESTAMP_HERE';  -- ⚠️ REPLACE THIS

-- ========================================
-- STEP 3: Verify Deletion
-- ========================================
-- Run this to confirm the records are gone
SELECT 
  created_at as upload_time,
  COUNT(*) as record_count
FROM shipments
GROUP BY created_at
ORDER BY created_at DESC
LIMIT 5;
