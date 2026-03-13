

# Further Scan Page Optimizations

## What we've already done
- Single-query UID lookup RPC
- Auth caching in ref
- Local groupItems reuse in handlePrint
- Optimistic UI updates

## What's left to optimize

### 1. Parallelize DB writes after printing
Currently, `handlePrint`, `handlePrintGroupId`, and `handlePrintAllGroupManifests` all do sequential operations: update shipment → insert print_job → (optionally) pick list print → insert pick list job. The shipment update and print_job insert are independent and can run in parallel with `Promise.all`.

**Impact**: Saves ~50-100ms per print action.

### 2. Cache `app_config` (PrintNode API key) in the store
`loadAppConfig` queries the database on every mount. The PrintNode API key rarely changes. Store it in `useAppStore` so it persists across navigations and skip the fetch if already loaded.

### 3. Parallelize `loadAppConfig` + `loadUserSettings` + `getUser`
These 3 calls run sequentially on mount. Wrap them in a single `Promise.all` to run concurrently.

**Impact**: Mount time reduced from ~300ms (3 sequential) to ~100ms (1 round-trip).

### 4. `loadUserSettings` calls `getUser()` redundantly
It fetches the user again even though `cachedUserRef` is being set in the same `useEffect`. Consolidate so the user is fetched once and passed to `loadUserSettings`.

### 5. Add a database index for `order_group_id`
Bundle scans query `shipments` by `order_group_id` multiple times. If no index exists, this is a sequential scan on a 70k+ row table.

**Impact**: Bundle lookups from ~50-100ms to ~5ms.

---

## Implementation Plan

### Database migration
- Add index on `shipments(order_group_id)` if not already present

### Frontend changes (`src/pages/Scan.tsx`)
- Consolidate mount: single `Promise.all` for user + app_config + user_settings
- Pass cached user to `loadUserSettings` instead of re-fetching
- Parallelize shipment update + print_job insert in all 3 print handlers
- Store `printnodeApiKey` in `useAppStore` to skip fetch on re-mount

### Estimated impact
- **Mount time**: ~300ms → ~100ms
- **Print action**: ~100-200ms faster per print
- **Bundle lookups**: faster with index

