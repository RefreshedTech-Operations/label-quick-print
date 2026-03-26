

## Add Strict/Fuzzy Search Toggle to Orders Page

**What changes**: Add a Switch next to the search bar that defaults to "Strict" search mode. When strict, search uses exact equality matching on key fields (uid, order_id, buyer, tracking, unit_id, location_id). When toggled off (fuzzy), it uses the current ILIKE/full-text search behavior.

### Steps

**1. Add `p_strict` parameter to `search_all_shipments` RPC** (database migration)
- Add `p_strict boolean DEFAULT true` parameter
- When `p_strict = true`, replace the fuzzy ILIKE/tsquery search block with exact equality checks:
  ```sql
  UPPER(TRIM(cs.uid)) = UPPER(TRIM(search_term))
  OR UPPER(TRIM(cs.order_id)) = UPPER(TRIM(search_term))
  OR UPPER(TRIM(cs.buyer)) = UPPER(TRIM(search_term))
  OR UPPER(TRIM(cs.tracking)) = UPPER(TRIM(search_term))
  OR UPPER(TRIM(cs.unit_id)) = UPPER(TRIM(search_term))
  OR UPPER(TRIM(cs.location_id)) = UPPER(TRIM(search_term))
  ```
- When `p_strict = false`, keep existing fuzzy logic (ILIKE + tsquery)
- Do the same for `get_shipments_stats_with_archive` if it also has a search_term parameter

**2. Add strict search state and UI toggle** (`src/pages/Orders.tsx`)
- Add `const [strictSearch, setStrictSearch] = useState(true)`
- Next to the search Input (~line 1306), add a Switch with a label like "Strict"
- Pass `p_strict: strictSearch` to both the `search_all_shipments` and `get_shipments_stats_with_archive` RPC calls
- Add `strictSearch` to the React Query keys so toggling triggers a refetch
- Update search placeholder text to reflect mode (e.g. "Exact match by UID, Order ID..." vs "Search by UID, Order ID...")

### Technical details
- The `search_all_shipments` function currently has 8 parameters — adding `p_strict` makes 9. The old function signature must be dropped first.
- The stats RPC needs the same parameter for consistency.
- Switch defaults to `true` (strict) per user request.

