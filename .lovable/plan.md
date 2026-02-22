

# TV Dashboard Redesign with User Leaderboard

## What's Changing

The dashboard will keep all its current stats but get a cleaner layout and a new **Printer Leaderboard** showing who printed the most labels today, ranked by count.

## New Layout

The page will be reorganized into a more balanced 2-column layout for the bottom section:

- **Top**: Header with clock and exit button (same as now)
- **KPI Row**: 4 cards across -- Labels Printed Today, Daily Goal %, Hourly Average, Projected Total (same data, slightly refined)
- **Bottom Left (wider)**: Hourly Print Rate bar chart (same as now)
- **Bottom Right**: Printer Leaderboard card -- ranked list of team members with their print count for today, showing a trophy icon for #1, medal colors for top 3, and a progress bar relative to the top printer

The 3 bottom stat cards (Peak Hour, Remaining Unprinted, Last Print) will be condensed into a slim horizontal strip between the KPI row and the chart/leaderboard section.

## Technical Details

### 1. Database: Update `get_tv_dashboard_stats` function

Add a `printer_leaderboard` field to the returned JSON. This will query `shipments` joined with `profiles` to get each user's email and print count for the target date:

```sql
-- New section in get_tv_dashboard_stats
SELECT jsonb_agg(
  jsonb_build_object(
    'email', p.email,
    'count', sub.cnt
  ) ORDER BY sub.cnt DESC
)
FROM (
  SELECT printed_by_user_id, COUNT(*) as cnt
  FROM shipments
  WHERE printed = true
    AND DATE(printed_at AT TIME ZONE 'America/New_York') = target_date
  GROUP BY printed_by_user_id
) sub
JOIN profiles p ON p.id = sub.printed_by_user_id
```

This adds a ranked list of printers to the existing RPC response with no extra round trips.

### 2. Hook: Update `useTVDashboardData.ts`

- Add `printer_leaderboard` to the `TVDashboardData` interface as `{ email: string; count: number }[]`
- Parse it from the RPC result

### 3. Frontend: Rewrite `TVDashboard.tsx`

- Keep the same 4 KPI cards at top
- Add a compact stats strip (Peak Hour, Unprinted, Last Print) as inline badges
- Replace the full-width chart with a 2-column grid: chart on the left (~60%), leaderboard on the right (~40%)
- Leaderboard shows ranked rows with:
  - Position number (gold/silver/bronze styling for top 3)
  - Username (extracted from email, before the @)
  - Print count
  - Horizontal progress bar relative to the top printer's count
