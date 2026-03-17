ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_channel_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_channel_check CHECK (channel IN ('regular', 'misfits', 'outlet', 'tiktok'));