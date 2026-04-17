

## Plan — Speed up TV Dashboard load

### Investigation

The dashboard calls a single RPC `get_tv_dashboard_stats(target_date)` from `useTVDashboardData`. The query returns instantly when there's no data, so the slowness is almost certainly the RPC scanning `shipments` without good index support for today's filters (printed_at range, unprinted count, hourly bucketing, leaderboard group-by).

I need to confirm in implementation mode by:
1. Reading the RPC source (`supabase--read_query` on `pg_proc`) to see the exact SQL.
2. `EXPLAIN ANALYZE` it for today's date to see which scans are slow.
3. Checking existing indexes on `shipments(printed, printed_at, printed_by_user_id, channel)`.

### Likely fixes (apply the ones the EXPLAIN confirms)

1. **Add partial / composite indexes** on `shipments`:
   - `(printed_at) WHERE printed = true` — powers total, hourly, last-hour, leaderboard.
   - `(printed) WHERE printed = false` — powers unprinted count.
   - `(printed_by_user_id, printed_at) WHERE printed = true` — powers leaderboard group-by.
2. **Rewrite the RPC** to compute all aggregates in a single pass over today's printed rows (CTE → `filter` clauses) instead of multiple separate scans.
3. **Cap leaderboard** to top 20 in SQL (not in JS) to avoid a full sort.
4. **Frontend cache**: add `staleTime: 25_000` to the query so the 30s refetch interval doesn't show "Loading…" between polls — keep showing previous data while refetching (`placeholderData: keepPreviousData`).
5. **Skeleton instead of full-screen "Loading Dashboard…"** so first paint feels instant on subsequent visits.

### Out of scope
- No queue/worker architecture — the RPC should comfortably return in <500ms once indexed; queueing is overkill here.
- No schema changes to `shipments` columns.

### Files to change
- New migration: indexes + rewritten `get_tv_dashboard_stats` function.
- `src/hooks/useTVDashboardData.ts` — add `staleTime` and `placeholderData`.
- `src/pages/TVDashboard.tsx` — only show "Loading…" when there's no cached data; otherwise render with prior data while refetching.

### Validation
- Reload `/tv-dashboard` cold → first paint < 1s.
- Subsequent 30s refetches don't flash "Loading…".
- `EXPLAIN ANALYZE` of the RPC shows index scans, total time < 200ms.

