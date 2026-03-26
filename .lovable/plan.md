

## Add `unit_id` to Shipments: Store, Display, and Search Fallback

**What changes**: Add a `unit_id` text column to the database, import it from CSV/Excel files, display it on the Orders and Scan pages, and use it as a fallback search in the scan UID lookup when `uid` returns no match.

### Steps

**1. Database migration**
- Add `unit_id text DEFAULT NULL` to `shipments` and `shipments_archive` tables.
- Update `find_shipment_by_uid` RPC to add a Step 4: if no match found by `uid`, try exact match on `unit_id`, then prefix, then suffix on `unit_id`.
- Update `search_all_shipments` RPC to include `unit_id` in `RETURNS TABLE` and all `SELECT` statements.

**2. Update CSV parser (`src/lib/csv.ts`)**
- In `normalizeShipmentData`, extract `unit_id` via `getColumnValue(row, 'unit id', 'unit_id')` and include it in the returned object.

**3. Display on Orders page (`src/pages/Orders.tsx`)**
- Below the Order ID line (~line 1659), add a conditional line showing `Unit: {shipment.unit_id}` when present.

**4. Display on Scan page (`src/pages/Scan.tsx`)**
- In the shipment details grid (~line 1395), add a new cell for `Unit ID` below UID, showing `selectedShipment.unit_id` when present.

**5. Update TypeScript types (`src/types/index.ts`)**
- Add `unit_id?: string` to the `Shipment` interface.

### Technical detail: `find_shipment_by_uid` fallback logic

```sql
-- After existing Steps 1-3 (uid exact/prefix/suffix), add:

-- Step 4: Exact match on unit_id
SELECT * INTO result FROM shipments WHERE unit_id = upper_uid LIMIT 1;
IF FOUND THEN RETURN NEXT result; RETURN; END IF;

-- Step 5: Prefix match on unit_id
SELECT * INTO result FROM shipments WHERE unit_id ILIKE upper_uid || '%' LIMIT 1;
IF FOUND THEN RETURN NEXT result; RETURN; END IF;

-- Step 6: Suffix match on unit_id
SELECT * INTO result FROM shipments WHERE unit_id ILIKE '%' || upper_uid LIMIT 1;
IF FOUND THEN RETURN NEXT result; RETURN; END IF;
```

This ensures the scan box searches `uid` first, and only falls back to `unit_id` if no `uid` match is found. No frontend changes needed for the search logic — it's handled entirely in the RPC.

