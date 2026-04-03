

## Add "View Label" Button for Admins on All Orders Page

**What**: Add a "View" button next to the Print button in the Actions column that opens the label PDF in a new tab, visible only to admin users.

### Changes

**`src/pages/Orders.tsx`** -- Add a View button in the Actions cell (lines ~1629-1640):
- After the existing Print button, add a second button (only when `isAdmin` is true and `shipment.label_url` exists)
- The button opens the label URL via the `shipengine-label-download` proxy in a new browser tab
- Uses the `Eye` icon from lucide-react
- Implementation: fetch the label as a blob through the edge function proxy, create an object URL, and open it via `window.open()`
- Compact layout: stack the two buttons vertically with a small gap

**Label URL handling**: Labels are accessed through the `shipengine-label-download` edge function to attach the API key. The view button will call this proxy, receive the PDF blob, and open it in a new tab.

| File | Change |
|------|--------|
| `src/pages/Orders.tsx` | Add admin-only "View" button in Actions column |

