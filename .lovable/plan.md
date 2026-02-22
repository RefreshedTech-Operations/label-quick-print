
# TV Dashboard Simplification + New Analytics Page

## Overview

Two changes:
1. **Simplify TV Dashboard** -- remove date picker, always show today's data with all metrics (printed, unprinted, goal, projected)
2. **Create new Analytics/Reporting page** -- detailed KPI reporting with single-day or date-range picker, using the existing analytics infrastructure

---

## 1. Simplify TV Dashboard (`src/pages/TVDashboard.tsx`)

- Remove all date picker UI (Calendar, Popover, "Back to Today" button)
- Remove `selectedDate` state -- always use today
- Remove conditional rendering -- always show unprinted count, daily goal, and projected total
- Always auto-refresh every 30 seconds
- Clean up unused imports (`Calendar`, `Popover`, `CalendarIcon`, `isToday`, `format`, `cn`)

---

## 2. New Analytics Page

### New file: `src/pages/Analytics.tsx`

A reporting page wrapped in the standard Layout with:

- **Date controls**: Toggle between "Single Day" and "Date Range" mode
  - Single Day: calendar date picker (defaults to today)
  - Date Range: uses the existing `DateRangeFilter` component with presets (Last 7 days, Last 30 days, etc.)
- **KPI Cards row**: Total Orders, Printed, Unprinted, Bundles, Cancelled, Print Jobs, Success Rate -- using the existing `KPICard` component
- **Charts section**: 
  - Daily Activity (`DailyActivityChart`)
  - Status Breakdown (`StatusStackedBarChart`)
  - Print Status Pie (`PrintStatusPieChart`)
  - Printer Performance (`PrinterPerformanceChart`)
  - Hourly Print Rate (`HourlyPrintRateChart`)
- **Printer Leaderboard**: Reuses the existing `PrinterLeaderboard` component
- Data fetched via the existing `useAnalyticsData` hook (which calls `get_all_analytics` or falls back to individual RPCs)

### Route and Navigation

- Add route `/analytics` in `App.tsx` wrapped in `<Layout>`
- Add "Analytics" nav item in `Layout.tsx` under the "Monitoring" group with a `BarChart3` icon

---

## Technical Details

### Files to modify:
- `src/pages/TVDashboard.tsx` -- strip date picker, simplify to today-only
- `src/App.tsx` -- add `/analytics` route
- `src/components/Layout.tsx` -- add Analytics nav item

### Files to create:
- `src/pages/Analytics.tsx` -- new reporting page

### No database changes needed
The existing `get_all_analytics` RPC (with fallback queries) and `get_tv_dashboard_stats` RPC already support everything needed.
