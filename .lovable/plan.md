

# Speeding Up the Scan Page

## Current Bottlenecks

1. **Sequential DB calls on every scan**: `findShipmentByUid` makes up to 3 sequential queries (exact → prefix → suffix). Each round-trip adds ~50-100ms latency.

2. **`supabase.auth.getUser()` called repeatedly**: Called during `handlePrint`, `handleKitItemsConfirm`, and other flows — each is a network request to verify the token. This should be fetched once and cached.

3. **Bundle scans trigger multiple sequential queries**: After finding the shipment, bundle orders fetch group items + kit devices (already parallelized with `Promise.all` — good), but then may also call `get_next_available_location` RPC, adding another round-trip.

4. **Print flow re-queries group status**: `handlePrint` re-fetches group shipments from DB to check unprinted count, even though `groupItems` state already has this data.

5. **Config loaded on every mount**: `loadAppConfig` and `loadUserSettings` run on every mount — these rarely change and could be cached.

---

## Proposed Optimizations

### 1. Single-query UID lookup (biggest win)
Replace the 3-step `findShipmentByUid` with a single database function that does exact → prefix → suffix in one round-trip on the server side.

**Migration**: Create `find_shipment_by_uid(p_uid text)` RPC that returns the first match using the same tiered logic but in a single SQL function.

### 2. Cache the authenticated user
Fetch `supabase.auth.getUser()` once on mount and store in a ref. Reuse it across all handlers instead of making repeated auth calls.

### 3. Use local `groupItems` state in `handlePrint`
Skip the re-query of group shipments in `handlePrint` when `groupItems` is already populated from the scan step. Only fall back to DB if state is empty.

### 4. Prefetch/cache app config and user settings
Store `printnodeApiKey` and user settings in the app store (already partially done via `useAppStore`) so they persist across navigations without re-fetching.

### 5. Optimistic UI updates
After marking a shipment as printed, update local state immediately rather than waiting for DB confirmation.

---

## Implementation Plan

### Database migration
- Create `find_shipment_by_uid(p_uid text)` function that performs all 3 lookup tiers in one call

### Frontend changes (`src/pages/Scan.tsx`)
- Replace `findShipmentByUid` with single RPC call
- Cache `user` in a ref on mount, remove repeated `getUser()` calls
- Use existing `groupItems` state in `handlePrint` instead of re-querying
- Apply optimistic state updates after print

### Estimated impact
- **UID lookup**: ~150-300ms → ~50ms (single round-trip)
- **Print flow**: removes 1-2 extra network calls (~100-200ms saved)
- **Auth calls**: removes 2-3 redundant calls per scan cycle (~100-150ms each)

