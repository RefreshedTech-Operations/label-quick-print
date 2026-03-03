

# Fix Analytics Page -- Function Overload Resolution

## Problem

The analytics RPC functions each have two overloaded versions: one with `p_user_id` and one without. When the code calls them without `p_user_id` (no employee filter selected), PostgREST returns `PGRST203` because it can't disambiguate between the two signatures.

The network requests confirm this -- all 5 fallback RPC calls (`get_analytics_kpis`, `get_daily_analytics`, `get_printer_performance`, `get_print_status_breakdown`, `get_hourly_print_rate`) return status 300 with the overload resolution error.

## Solution

Two-part fix:

### 1. Database migration -- Drop the no-user overloads

Drop the 2-parameter versions of all 5 functions, keeping only the versions that accept `p_user_id`. Alter those to default `p_user_id` to `NULL` so they work when no user filter is applied.

Functions to update:
- `get_analytics_kpis(start_date, end_date, p_user_id DEFAULT NULL)`
- `get_daily_analytics(start_date, end_date, p_user_id DEFAULT NULL)`
- `get_printer_performance(start_date, end_date, top_limit DEFAULT 10, p_user_id DEFAULT NULL)`
- `get_print_status_breakdown(start_date, end_date, p_user_id DEFAULT NULL)`
- `get_hourly_print_rate(start_date, end_date, p_user_id DEFAULT NULL)`

### 2. Code change in `useAnalyticsData.ts`

In the fallback branch, always pass `p_user_id` (as `null` when no employee is selected) so PostgREST always resolves to the correct function:

```typescript
const userParam = { p_user_id: userId || null }
```

This ensures calls always include the `p_user_id` parameter regardless of whether a user is filtered.

