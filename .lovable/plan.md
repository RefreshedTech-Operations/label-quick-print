

## Fix Upload Management Grouping

**Problem**: When you upload a file with many shipments, they get inserted in batches of 100. Each batch gets a different `created_at` timestamp from the database, so the Upload Management section shows one upload as multiple separate entries with small counts (e.g., a 500-record upload shows as five 100-record entries).

**Solution**: Add an `upload_id` column to the `shipments` table. Generate a single UUID per upload session and attach it to every record in that upload. Then group by `upload_id` instead of `created_at` in the Upload Management view.

### Changes

**1. Database migration** -- Add `upload_id` column to `shipments` table
```sql
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS upload_id uuid;
CREATE INDEX IF NOT EXISTS idx_shipments_upload_id ON public.shipments(upload_id);
```

**2. Upload page** (`src/pages/Upload.tsx`) -- Generate one `upload_id` per upload session
- At the start of `processAndUpload`, generate `const uploadId = crypto.randomUUID()`
- Include `upload_id: uploadId` on every shipment record sent to the database
- Also apply to the automation API paths (`__uploadCSV`, `__submitCSV`)

**3. Settings page** (`src/pages/Settings.tsx`) -- Group by `upload_id` instead of `created_at`
- Update `loadRecentUploads` to query distinct `upload_id` values with counts, show dates, and timestamps
- For older records without an `upload_id`, fall back to `created_at` grouping
- Update `handleDeleteUpload` to delete by `upload_id` instead of `created_at`
- Show the upload timestamp (from the earliest `created_at` in the group), record count, and show date

