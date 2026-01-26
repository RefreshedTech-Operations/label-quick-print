

## Fix: Update Database Constraint for "Outlet" Channel

### Problem Identified
The upload is failing because the `shipments` table has a CHECK constraint that only allows two channel values:
```sql
CHECK ((channel = ANY (ARRAY['regular'::text, 'misfits'::text])))
```

When I added the "Outlet" channel option to the UI, I didn't update this database constraint. Every upload attempt is being rejected because the constraint doesn't include `'outlet'`.

### Solution
Update the database constraint to include `'outlet'` as a valid channel value.

### Database Migration Required

**Drop the old constraint and create a new one:**

```sql
-- Drop the existing constraint
ALTER TABLE public.shipments 
DROP CONSTRAINT shipments_channel_check;

-- Add updated constraint with outlet channel
ALTER TABLE public.shipments 
ADD CONSTRAINT shipments_channel_check 
CHECK (channel = ANY (ARRAY['regular'::text, 'misfits'::text, 'outlet'::text]));
```

### Files to Modify
None - this is a database-only fix.

### After the Fix
Once the constraint is updated, your CSV upload will work correctly. The file you uploaded has 726 rows and will be processed normally.

