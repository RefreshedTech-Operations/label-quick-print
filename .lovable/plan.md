

## Speed Up Pack Page Tracking Lookup

Add a 5-day `created_at` filter and switch from `.ilike()` to `.eq()` for the tracking query.

### Changes to `src/pages/Pack.tsx`

In `processTracking`, update the query from:
```typescript
.ilike('tracking', tracking)
.limit(1)
```
to:
```typescript
.eq('tracking', tracking)
.gte('created_at', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
.limit(1)
```

This narrows the scan to recent rows and uses an exact match instead of case-insensitive pattern matching, eliminating the statement timeout on the 87K+ row table.

### Database migration

Add a composite index to support this query pattern:
```sql
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_created
ON public.shipments (tracking, created_at DESC);
```

