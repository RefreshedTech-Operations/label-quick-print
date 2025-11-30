-- Add issue tracking columns to shipments table
ALTER TABLE shipments 
  ADD COLUMN has_issue boolean DEFAULT false,
  ADD COLUMN issue_marked_at timestamp with time zone,
  ADD COLUMN issue_marked_by_user_id uuid;

-- Add index for faster lookups when scanning
CREATE INDEX idx_shipments_has_issue ON shipments(has_issue) WHERE has_issue = true;