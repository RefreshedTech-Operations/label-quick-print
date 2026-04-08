

## Show Full Order Number in Missing Labels Tab

**Problem**: The order number column in the Missing Labels table has `truncate` CSS classes that cut off long order IDs.

**Fix**: Remove the `truncate` class from the order ID cell and its inner div, and allow text to wrap or break instead.

### Changes

**`src/pages/ShippingLabels.tsx`** (lines 587-589):
- Remove `truncate` from the `TableCell` class on line 587
- Replace `truncate` with `break-all` on the order ID `div` (line 588) so long IDs wrap within the cell
- Keep `truncate` on the UID line below since that's secondary info

| File | Lines | Change |
|------|-------|--------|
| `src/pages/ShippingLabels.tsx` | 587-588 | Remove `truncate`, add `break-all` to allow full order ID display |

