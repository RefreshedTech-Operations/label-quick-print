

## Add Editable UID Field When Unit ID Present but UID Missing

**What changes**: When a shipment is found via `unit_id` and the `uid` field is empty, show an editable UID input field that the user must fill in before printing.

### Steps

**1. Add state for editable UID** (`src/pages/Scan.tsx`)
- Add `editingUid` state and `uidRequired` flag
- After a shipment is found in `handleScan`, if `selectedShipment.unit_id` is set and `selectedShipment.uid` is empty/null, set `uidRequired = true`
- Block printing until UID is entered and saved

**2. Update the shipment detail display** (`src/pages/Scan.tsx`, ~line 1396)
- Replace the static UID display with conditional logic:
  - If `uidRequired` (unit_id exists, uid is empty): show an `<Input>` field with a "Save UID" button, marked as required
  - Otherwise: show the current static display
- On save, update the shipment in the database (`supabase.from('shipments').update({ uid: newUid })`) and update local state

**3. Block print until UID is filled** (`src/pages/Scan.tsx`)
- In `handlePrint`, add a check: if the shipment has `unit_id` but no `uid`, show a toast error ("Please enter a UID first") and return early
- Also disable the Print button visually when UID is required but not yet entered

### Technical details
- The editable UID input should trim and uppercase the value before saving (consistent with existing UID conventions)
- After saving, update `selectedShipment` state with the new `uid` and clear `uidRequired`
- Auto-focus the UID input when it appears

