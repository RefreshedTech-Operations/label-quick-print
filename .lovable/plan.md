

## Fix Show Date Filter in Generated Labels Tab

**Problem**: The recent show dates query fetches all shipments with labels but hits Supabase's default 1000-row limit, causing unreliable date counts and missing dates. Additionally, `unprintedCount` is set equal to `count`, which is meaningless for generated labels.

### Root Cause

The query on line 675 does `.select('show_date')` without overriding the 1000-row default limit. If there are more than 1000 labeled shipments, some dates get truncated or lost entirely, making the "last 5 shows" unreliable.

### Solution

Replace the client-side counting approach with a server-side SQL RPC that uses `GROUP BY` to get accurate counts, or use a smarter direct query approach.

**`src/pages/ShippingLabels.tsx`** — Generated Labels `recentDates` query (lines 671-693):

1. **Replace the fetch-all-and-count approach** with a direct query that selects distinct `show_date` values ordered descending, limited to 5, using a database RPC or a restructured query that avoids the 1000-row cap.

2. **Create a new database RPC** `get_generated_label_date_counts` that runs:
   ```sql
   SELECT show_date as date, 
          COUNT(*)::int as count
   FROM shipments
   WHERE label_url IS NOT NULL 
     AND label_url != ''
     AND show_date IS NOT NULL
     AND (p_channel IS NULL OR channel = p_channel)
   GROUP BY show_date
   ORDER BY show_date DESC
   LIMIT 5
   ```

3. **Update the ShowDateFilter display** for generated labels — show just the total count per date (not an "unprinted/total" split, since all have labels). Set `unprintedCount = count` so the display shows one number cleanly, or adjust the `ShowDateFilter` component to handle this case.

### Technical Details

| Step | Change |
|------|--------|
| Database migration | Create `get_generated_label_date_counts(p_channel text DEFAULT NULL)` RPC |
| `src/pages/ShippingLabels.tsx` | Replace lines 671-693 with RPC call |

The missing labels tab query (lines 383+) should also be checked — it may use `get_show_date_counts` which could have the same 1000-row issue if it's also doing client-side aggregation.

