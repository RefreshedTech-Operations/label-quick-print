

# Cross-App Performance Optimizations

## 1. Cache User Permissions Globally

**Problem**: `Layout.tsx` fetches `user_roles`, `user_page_permissions`, and `role_page_defaults` on every page navigation — 3 DB calls each time.

**Solution**: Add permissions state to `useAppStore` (roles, allowedPages, loaded flag). Fetch once, reuse everywhere. Both `Layout.tsx` and `useUserPermissions.ts` read from the store instead of querying independently.

**Changes**: `src/stores/useAppStore.ts`, `src/components/Layout.tsx`, `src/hooks/useUserPermissions.ts`

---

## 2. Optimize TV Dashboard DB Function with CTEs

**Problem**: `get_tv_dashboard_stats` runs 7+ sequential queries against the `shipments` table, each scanning independently.

**Solution**: Rewrite as a single query using CTEs. One base CTE filters `shipments` for the target date, then all metrics (total, hourly breakdown, leaderboard, unprinted count, peak hour) derive from it.

**Changes**: New database migration to replace `get_tv_dashboard_stats`

---

## 3. Cache `show_date_counts` with Longer Stale Time

**Problem**: `get_show_date_counts` is fetched with a 2-minute stale time on the Orders page. This data changes slowly (only on upload).

**Solution**: Increase stale time to 5 minutes (matches `app-config`). Already using React Query — just a config tweak.

**Changes**: `src/pages/Orders.tsx` line 212

---

## 4. Deduplicate `getUser()` on Orders Page

**Problem**: Orders page calls `supabase.auth.getUser()` in 3 places independently: admin check (line 127), user-settings query (line 182), and shipments query (line 252).

**Solution**: Use a single React Query for the user session (`queryKey: ['auth-user']`) with a long stale time. Reference it in dependent queries via `queryClient.getQueryData`.

**Changes**: `src/pages/Orders.tsx`

---

## Summary of Impact

| Optimization | Saves |
|---|---|
| Global permission cache | ~3 DB calls per navigation |
| TV Dashboard CTEs | ~6 redundant table scans |
| Show date stale time | Fewer refetches |
| Deduplicate getUser | ~2 auth calls per Orders load |

