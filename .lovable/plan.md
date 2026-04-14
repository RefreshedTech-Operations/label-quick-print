

## Fix: Scanning a printed UID shows "Not Found" instead of "Already Printed"

**Problem**: When a UID is scanned and that shipment has already been printed, the scan page shows "SHIPMENT NOT FOUND" instead of "ALREADY PRINTED". This happens because `findShipmentByUid` (line 222) filters results to only unprinted shipments, returning `null` when all matches are printed. The `handleScan` function then treats `null` as not found, never reaching the `already_printed` check on line 349.

**Fix**: Change `findShipmentByUid` to return the first matching shipment regardless of print status, so `handleScan` can properly detect and display "ALREADY PRINTED".

### Steps

1. **Update `findShipmentByUid` in `src/pages/Scan.tsx`** (line 221-222):
   - Instead of filtering to only unprinted, return the first unprinted match if one exists, otherwise return the first printed match
   - This lets `handleScan`'s existing `already_printed` check (line 349) work correctly

```typescript
// Before:
const candidates = (data || []) as Shipment[];
return candidates.find((item) => !item.printed) || null;

// After:
const candidates = (data || []) as Shipment[];
return candidates.find((item) => !item.printed) || candidates[0] || null;
```

This single-line change preserves the existing priority (unprinted first) while falling back to any printed match, allowing the already-printed UI feedback to display correctly.

