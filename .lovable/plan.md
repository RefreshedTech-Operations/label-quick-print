

# Replace Batches with Pack Page

## Overview
Remove the Batches page and replace it with a new **Pack** page. The Pack page lets users scan tracking numbers to find orders and mark them as "packed." Each pack event records the user, timestamp, and which packing station was used. Station IDs are managed by admins in a predefined list.

## Database Changes

### 1. New table: `pack_stations`
Stores the predefined list of packing stations that admins manage.
- `id` (uuid, PK)
- `name` (text, not null, unique) -- e.g. "Station 1", "Table A"
- `is_active` (boolean, default true)
- `sort_order` (integer)
- `created_at` (timestamptz)

RLS: Admins can manage (ALL), authenticated users can view (SELECT).

### 2. Add columns to `shipments` table
- `packed` (boolean, default false)
- `packed_at` (timestamptz, nullable)
- `packed_by_user_id` (uuid, nullable)
- `pack_station_id` (uuid, nullable, FK to pack_stations.id)

### 3. Add same columns to `shipments_archive` table
To keep schema parity for archiving.

## Frontend Changes

### 1. New page: `src/pages/Pack.tsx`
- **Station selector** at the top -- dropdown of active stations from `pack_stations`. Selection persists in localStorage for the session.
- **Tracking scan input** -- text field with auto-focus. On submit:
  - Apply same prefix-stripping logic as batch scanning (strip first 12 chars if length > 22)
  - Look up shipment by tracking number (case-insensitive)
  - If not found: show error toast
  - If already packed: show warning with who packed it and when
  - If found and not packed: mark as packed (update `packed`, `packed_at`, `packed_by_user_id`, `pack_station_id`)
  - Show success toast with order details
- **Recent packs list** -- table of recently packed items in current session showing tracking, buyer, product, time

### 2. Update routing
- `src/App.tsx`: Replace `/batches` route with `/pack` pointing to new Pack page
- `src/components/Layout.tsx`: Change nav item from "Batches" to "Pack" at `/pack`, keep `Package2` icon
- `src/lib/pagePermissions.ts`: Update `ALL_PAGES` -- replace `/batches` entry with `/pack`

### 3. Admin station management
- Add a "Pack Stations" section in the existing **Admin Tools** page (`src/pages/AdminTools.tsx`) or in **Settings** where admins can add/edit/deactivate stations

### 4. Update `role_page_defaults`
- Insert data to replace `/batches` with `/pack` for any roles that had batch access

## Technical Details

### Migration SQL (single migration)
```sql
-- Pack stations table
CREATE TABLE public.pack_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pack_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stations" ON public.pack_stations
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view stations" ON public.pack_stations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add pack columns to shipments
ALTER TABLE public.shipments
  ADD COLUMN packed boolean DEFAULT false,
  ADD COLUMN packed_at timestamptz,
  ADD COLUMN packed_by_user_id uuid,
  ADD COLUMN pack_station_id uuid REFERENCES public.pack_stations(id);

-- Add pack columns to shipments_archive
ALTER TABLE public.shipments_archive
  ADD COLUMN packed boolean DEFAULT false,
  ADD COLUMN packed_at timestamptz,
  ADD COLUMN packed_by_user_id uuid,
  ADD COLUMN pack_station_id uuid;

-- Update role_page_defaults: replace /batches with /pack
UPDATE public.role_page_defaults SET page_path = '/pack' WHERE page_path = '/batches';

-- Update user_page_permissions: replace /batches with /pack
UPDATE public.user_page_permissions SET page_path = '/pack' WHERE page_path = '/batches';
```

### Pack page core logic
```typescript
const packOrder = async () => {
  // 1. Strip prefix if needed
  // 2. Query shipments by tracking (ilike)
  // 3. Check if already packed
  // 4. Update: packed=true, packed_at=now, packed_by_user_id=user.id, pack_station_id=selected
  // 5. Show success, add to recent list, clear input
};
```

### Files to create
- `src/pages/Pack.tsx` -- main pack page

### Files to modify
- `src/App.tsx` -- swap route
- `src/components/Layout.tsx` -- swap nav item
- `src/lib/pagePermissions.ts` -- swap page entry
- `src/pages/AdminTools.tsx` -- add station management section
- `src/types/batch.ts` -- can be removed or repurposed

### Files to remove
- `src/pages/BatchManagement.tsx` -- replaced by Pack page

### Update archive function
The `archive_shipments_batch` DB function will need updating to include the new pack columns in the INSERT...SELECT statement.
