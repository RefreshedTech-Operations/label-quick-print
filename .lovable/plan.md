

## Plan — Pack TV Dashboard

### Goal
A second TV-style dashboard mirroring the print TV Dashboard, but focused on **packing** activity (uses `shipments.packed`, `packed_at`, `packed_by_name`, `pack_station_id`).

### Investigation notes
- Print dashboard: `/tv-dashboard` → `TVDashboard.tsx` → `useTVDashboardData` → RPC `get_tv_dashboard_stats`.
- Pack columns exist on both `shipments` and `shipments_archive`. `pack_stations.name` joins via `pack_station_id`.
- Packer identity: `packed_by_name` (free-text from Pack page) — use this directly for leaderboard (not `profiles`, since pack name is independent of auth user).
- EST timezone standard applies (per memory).

### Changes

**1. DB migration — new RPC `get_pack_tv_dashboard_stats(target_date date)`**
Returns JSONB with:
- `total_packed` — count where `packed=true` and `packed_at` in EST day
- `daily_goal` — from `app_config` key `daily_pack_goal` (fallback 1000)
- `goal_percentage`
- `unpacked_count` — shipments with `printed=true AND (packed=false OR null)` (i.e. printed-but-not-packed backlog)
- `last_hour_count`, `last_pack_time`, `avg_per_hour`, `peak_hour`
- `hourly_breakdown` — 0–23 hourly counts
- `packer_leaderboard` — top 20 by `packed_by_name` with count
- `station_leaderboard` — top 10 by `pack_stations.name` with count (join via `pack_station_id`)

Mirrors structure of `get_tv_dashboard_stats` so frontend pattern is identical.

**2. New hook `src/hooks/usePackTVDashboardData.ts`**
Mirror of `useTVDashboardData`, calls new RPC, returns typed data including `packer_leaderboard` and `station_leaderboard`.

**3. New page `src/pages/PackTVDashboard.tsx`**
Mirror of `TVDashboard.tsx` styling:
- Header: "Packing Dashboard" + Exit button
- KPI row 1 (2 cards): "Packed Today" (with last-hour activity) | "Daily Pack Goal" (with projected)
- "Unpacked Backlog" small KPI inline in first card
- Two leaderboards side-by-side below: **Top Packers** and **Top Stations**

**4. New component `src/components/tv-dashboard/PackerLeaderboard.tsx` + `StationLeaderboard.tsx`**
Or reuse `PrinterLeaderboard` pattern with a generic prop. Cleanest: create one generic `LeaderboardCard` taking `title` + entries `{label, count}[]`, used by both new dashboards.

**5. Routing — `src/App.tsx`**
Add `/pack-tv-dashboard` route.

**6. Navigation entry**
Add link in `Layout.tsx` sidebar (gated by same permission pattern as existing TV Dashboard) and a new `page_path` row in `role_page_defaults` for relevant roles (admin, manager).

### Files
- Migration: new `get_pack_tv_dashboard_stats` + insert default `daily_pack_goal` config row + insert role_page_defaults rows
- `src/hooks/usePackTVDashboardData.ts` (new)
- `src/pages/PackTVDashboard.tsx` (new)
- `src/components/tv-dashboard/LeaderboardCard.tsx` (new generic — refactor `PrinterLeaderboard` to use it, optional)
- `src/App.tsx` (route)
- `src/components/Layout.tsx` (nav link)
- `src/lib/pagePermissions.ts` (register page path if needed)

### Validation
- Open `/pack-tv-dashboard` → today's packed count, goal %, hourly chart, top packers (by name), top stations all populate.
- Auto-refreshes every 30s like the print dashboard.
- Numbers reconcile with Pack page activity for today.

