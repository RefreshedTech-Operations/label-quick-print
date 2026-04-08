

## Add Show Date Quick Filters + Custom Date to Missing Labels Tab

**What**: Replace the plain date input on line 511 with the `ShowDateFilter` component, which already includes both quick-select buttons AND a custom date picker calendar. The `ShowDateFilter` component has a built-in "Custom Date" popover with a full calendar, so no functionality is lost.

### Changes

**`src/pages/ShippingLabels.tsx`** — `MissingLabelsTab`:

1. **Add a query for recent show dates** (after line 381): Query distinct `show_date` values from `shipments` where labels are missing, with counts and unprinted counts, ordered descending, limited to 5. This provides the data for the quick-select buttons.

2. **Replace the date input** (line 511): Remove `<Input type="date" .../>` and add `<ShowDateFilter>` on its own row below the search bar. This component renders:
   - "All Dates" button
   - "Today" button  
   - Last 5 show dates with counts
   - **"Custom Date" button** with a calendar popover for picking any date

3. **Import `ShowDateFilter`** at the top of the file.

| File | Change |
|------|--------|
| `src/pages/ShippingLabels.tsx` | Add recent-dates query; replace date input with `ShowDateFilter` component |

The `ShowDateFilter` component already supports custom date selection via its built-in calendar popover, so both quick filters and arbitrary date picking will work.

