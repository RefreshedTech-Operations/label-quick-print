

## Bulk Add and Bulk Delete Locations

### What's Changing
Two new buttons will be added to the Locations tab header (admin-only), next to the existing "Add Location" button:

1. **Bulk Add** -- Enter a numeric range (e.g. start: 200, end: 250) and all locations in that range get created at once.
2. **Bulk Delete** -- Enter a numeric range (e.g. start: 100, end: 150) and all matching locations in that range get deleted at once. Occupied locations will be skipped with a warning.

### User Experience

- **Bulk Add dialog**: Two number inputs for "From" and "To". Preview shows how many will be created. Clicking "Add" inserts them all.
- **Bulk Delete dialog**: Two number inputs for "From" and "To". Preview shows how many will be deleted and warns if any are occupied (those get skipped). Clicking "Delete" removes all non-occupied locations in the range.

### Technical Details

**File modified:** `src/components/BundleLocationsTab.tsx`

**Bulk Add logic:**
- Generate location codes from the start to end range
- Filter out any that already exist (by comparing against current `locations` state)
- Insert all new locations in a single Supabase `.insert()` call with incrementing `sort_order`
- Refresh the list after completion

**Bulk Delete logic:**
- Filter current locations to find those with numeric codes in the specified range
- Skip any that are currently occupied (show a warning toast listing skipped ones)
- Delete all eligible locations in a single `.delete().in('location_code', codes)` call
- Refresh the list after completion

**UI additions:**
- Two new admin-only buttons in the header: "Bulk Add" and "Bulk Delete"
- Two new Dialog components with range inputs (From/To number fields)
- Preview count shown before confirming the action

No database changes needed -- uses existing `bundle_locations` table operations.
