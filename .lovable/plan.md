

## Plan — Analytics Rebuild: Operations + Productivity

### Goal
Replace the current Analytics page with a focused, action-oriented dashboard for **operations health** and **employee productivity**, covering both **printing and packing**. Default view: **Today** with quick toggle to **Last 7 Days**.

### What's worth knowing (and what we're cutting)

**Cutting** (low signal): pie charts, generic "total orders" stack chart, raw print-status pie, bundle donut, daily activity bar of just print job counts.

**Keeping/upgrading**: hourly rate concept (now dual: print + pack), per-employee leaderboards.

### New layout

**Header**
- Title + period toggle: `Today` | `Last 7 Days` | custom range
- Optional employee filter (preserved from current)

**Section 1 — Operations Health (top row, 4 KPIs with trend deltas vs prior period)**
1. **Labels Printed** — count + Δ vs prior period
2. **Orders Packed** — count + Δ
3. **Pack Backlog** — printed but not packed (live count, not period-bound)
4. **Avg Throughput** — labels/hr during active hours (8a–8p EST)

**Section 2 — Today at a Glance (only when period = Today)**
- Hourly dual-bar chart: prints vs packs side-by-side per hour (replaces single hourly chart)
- Small inline stats: peak hour, last print, last pack, hours since last activity

**Section 3 — Employee Productivity**
- Two side-by-side leaderboard tables:
  - **Top Printers** — name, labels printed, % of total, prints/active-hr
  - **Top Packers** — name, packed count, % of total, station(s) used
- Sortable columns; top 10 each

**Section 4 — Workflow Funnel (single horizontal bar)**
- Uploaded → Printed → Packed → Shipped(tracking present), with conversion %s. Surfaces drop-offs (e.g. printed but never packed).

**Section 5 — Exceptions (small table, only shows if count > 0)**
- Open issues (`has_issue = true`)
- Cancelled in period
- Stale orders (printed >48h ago, not packed)

### Backend

**New RPC `get_analytics_overview(start_ts, end_ts, prev_start_ts, prev_end_ts, p_user_id)`** returning JSONB:
```
{
  kpis: { printed, printed_prev, packed, packed_prev, backlog, throughput_per_hr },
  hourly: [{ hour, printed, packed }],  // 0-23, EST
  printer_leaderboard: [{ name, count }],
  packer_leaderboard: [{ name, count, stations: [..] }],
  funnel: { uploaded, printed, packed, shipped },
  exceptions: { open_issues, cancelled, stale_unpacked }
}
```
Uses `shipments` + `shipments_archive` UNION, joins `profiles` for printer name and `pack_stations` for station name. EST-aware via `AT TIME ZONE 'America/New_York'`.

### Frontend

**Files**
- New: `src/hooks/useAnalyticsOverview.ts` (replaces `useAnalyticsData`)
- New components in `src/components/analytics/`:
  - `KPIStatCard.tsx` — value + delta arrow + sparkline-free, period-aware
  - `HourlyDualChart.tsx` — print vs pack bars
  - `EmployeeLeaderboardTable.tsx` — generic, used for both printers & packers
  - `WorkflowFunnel.tsx` — horizontal stacked bar with conversion labels
  - `ExceptionsPanel.tsx` — conditional table
- Rewrite: `src/pages/Analytics.tsx`
- Delete (no longer used): `DailyActivityChart`, `OrdersTimelineChart`, `BundleBreakdownChart`, `PrintStatusPieChart`, `StatusStackedBarChart`, `PrinterPerformanceChart`, `HourlyPrintRateChart`, old `useAnalyticsData.ts`

### Validation
- Today view shows current ops snapshot; Last 7 Days shows trend deltas
- Numbers reconcile with TV dashboards (label + pack)
- Backlog matches Pack TV Dashboard's "unpacked" count
- Employee filter still narrows leaderboards & KPIs

