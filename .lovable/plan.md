

## Add Show Date Filter to Generated Labels Tab

### What
Replace the plain date input on the Generated Labels tab with the existing `ShowDateFilter` component, showing quick-select buttons for recent show dates (same UX as the Orders page).

### How

**File: `src/pages/ShippingLabels.tsx` (GeneratedLabelsTab function)**

1. Fetch recent show dates specific to generated labels using a query that aggregates distinct `show_date` values from shipments that have a `label_url` (not null/empty). This will show dates relevant to generated labels rather than all shipments.

2. Replace the `<Input type="date">` (line 652) with the `<ShowDateFilter>` component, passing:
   - `selectedDate={selectedShowDate}`
   - `recentDates` from the new query
   - `onDateSelect` handler (already exists)

3. The recent dates query will select from `shipments` where `label_url` is not null/empty, group by `show_date`, count total and provide counts. Since this tab doesn't track "unprinted", the unprinted count will just mirror total count or be set to 0.

4. Reset page to 0 when show date changes (already handled).

### Technical Details

- Reuses the existing `ShowDateFilter` component from `src/components/ShowDateFilter.tsx`
- New query: `SELECT show_date, count(*) FROM shipments WHERE label_url IS NOT NULL AND label_url != '' GROUP BY show_date ORDER BY show_date DESC LIMIT 5`
- Uses direct Supabase query (no new RPC needed) since this is a simple aggregation
- Import `ShowDateFilter` at the top of ShippingLabels.tsx

