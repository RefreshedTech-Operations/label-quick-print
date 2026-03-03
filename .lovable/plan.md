

# Add "All / Unprinted" Toggle for Non-Bundled Items Filter

## What will change

When the "Non-Bundled Items" filter is active, a small toggle will appear next to the filter dropdown letting users switch between seeing **all** non-bundled items or only **unprinted** non-bundled items.

## Technical Details

### 1. New state in `src/pages/Orders.tsx`
- Add `nonBundledSubFilter` state: `'all' | 'unprinted'` (default `'all'`)
- Reset it when the main filter changes away from `non_bundled`

### 2. UI change (near line ~1219)
- After the filter `<Select>`, conditionally render a `ToggleGroup` (single-select) with two options: "All" and "Unprinted" — only visible when `filter === 'non_bundled'`

### 3. New database filter values
- Add `non_bundled_unprinted` as a valid `p_filter` value in both `search_all_shipments` and `get_shipments_stats_with_archive` database functions
- Filter condition: `(s.bundle = false OR s.bundle IS NULL) AND (s.printed = false OR s.printed IS NULL)`

### 4. Query integration
- When `filter === 'non_bundled'` and `nonBundledSubFilter === 'unprinted'`, pass `'non_bundled_unprinted'` as `p_filter` to the RPC calls
- Include `nonBundledSubFilter` in React Query keys so cache updates correctly

### 5. Migration
- Single SQL migration updating `search_all_shipments` and `get_shipments_stats_with_archive` to handle the new `'non_bundled_unprinted'` filter value

