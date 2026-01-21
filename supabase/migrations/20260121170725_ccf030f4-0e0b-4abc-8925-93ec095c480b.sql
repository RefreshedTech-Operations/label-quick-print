-- Drop the old 1-parameter version that conflicts with the batched version
DROP FUNCTION IF EXISTS archive_old_shipments(integer);