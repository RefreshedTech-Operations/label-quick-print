-- Add channel column to shipments table
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS channel text DEFAULT 'regular';

-- Add check constraint to ensure valid channel values
ALTER TABLE shipments ADD CONSTRAINT shipments_channel_check 
  CHECK (channel IN ('regular', 'misfits'));

-- Add index for channel filtering
CREATE INDEX IF NOT EXISTS idx_shipments_channel ON shipments(channel);