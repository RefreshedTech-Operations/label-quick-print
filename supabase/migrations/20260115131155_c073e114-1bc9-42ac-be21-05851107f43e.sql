-- Enable trigram extension for efficient wildcard search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for efficient wildcard search on uid
CREATE INDEX IF NOT EXISTS idx_shipments_uid_trgm ON shipments USING GIN (uid gin_trgm_ops);