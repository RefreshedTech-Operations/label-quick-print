-- Phase 1: Remove redundant auto_bundle trigger (logic already in upload code)
DROP TRIGGER IF EXISTS trigger_auto_bundle ON shipments;
DROP FUNCTION IF EXISTS auto_bundle_on_insert();

-- Phase 2: Consolidate redundant indexes
-- idx_shipments_order_id is duplicate of shipments_order_id_unique
DROP INDEX IF EXISTS idx_shipments_order_id;

-- idx_shipments_printed_created is identical to idx_shipments_printed_created_at
DROP INDEX IF EXISTS idx_shipments_printed_created;

-- idx_shipments_bundle overlaps with idx_shipments_bundle_created
DROP INDEX IF EXISTS idx_shipments_bundle;

-- idx_shipments_cancelled overlaps with idx_shipments_cancelled_created
DROP INDEX IF EXISTS idx_shipments_cancelled;