

## Delete Today's TikTok Upload

**What's being removed:**
- 592 TikTok channel shipments uploaded today (April 3, 2026 ~12:05 UTC, show date April 2)
- 448 related print jobs

**How:** A single database migration that:
1. Deletes print jobs linked to the affected shipments
2. Deletes the shipments themselves

```sql
DELETE FROM print_jobs
WHERE shipment_id IN (
  SELECT id FROM shipments
  WHERE created_at::date = '2026-04-03'
    AND channel = 'tiktok'
);

DELETE FROM shipments
WHERE created_at::date = '2026-04-03'
  AND channel = 'tiktok';
```

| Action | Target |
|--------|--------|
| Migration | Delete 448 print_jobs + 592 shipments |

No code file changes needed — this is a data-only operation.

