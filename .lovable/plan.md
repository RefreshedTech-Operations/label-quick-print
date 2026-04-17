

## Plan — Show pack info on All Orders (admin/manager only)

### Investigation

Pack data already lives on `shipments`: `packed`, `packed_at`, `packed_by_name`, `pack_station_id`, plus `packed_by_user_id`. Need to surface these on the Orders page row, gated to admin/manager roles.

The `search_all_shipments` RPC currently doesn't return pack columns or the station name — needs to be extended (or fetched separately). Cleanest is to extend the RPC to include `packed`, `packed_at`, `packed_by_name`, and join `pack_stations.name` as `pack_station_name`.

### Changes

**1. DB migration**
- Replace `search_all_shipments` to additionally return: `packed boolean`, `packed_at timestamptz`, `packed_by_name text`, `pack_station_name text` (LEFT JOIN `pack_stations`). Same for both `shipments` + `shipments_archive` branches of the UNION. No other logic changes.

**2. `src/types/index.ts`**
- Add to `Shipment`: `packed?`, `packed_at?`, `packed_by_name?`, `pack_station_name?`.

**3. `src/pages/Orders.tsx`**
- Use `useUserPermissions`/role check to determine if current user is `admin` or `manager`.
- Add a new "Pack" column (only rendered for admin/manager) showing:
  - If `packed`: green badge with packer name + station name + relative time, tooltip with full timestamp (EST per project standard).
  - If not packed: muted "—" or "Not packed" text.
- Include the new column in the existing column resize/visibility system if Orders uses one (will mirror existing column patterns).
- Make column sortable/filterable only if trivial; otherwise read-only display this round.

**4. Optional (small)**: add a "Packed" filter chip (Packed / Unpacked / All) — only if Orders already has a filter row pattern that fits cleanly. Will confirm during implementation; if it adds scope, skip.

### Files to change
- New migration replacing `search_all_shipments`.
- `src/types/index.ts`
- `src/pages/Orders.tsx`

### Validation
- Admin sees Pack column with name/station/timestamp on packed rows; non-admin/manager doesn't see the column.
- Unpacked rows show placeholder.
- Archived rows also show pack info if present.

