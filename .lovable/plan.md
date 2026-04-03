

## Fix Double-Printing of Labels

**Problem**: In both `Scan.tsx` (line 777) and `Orders.tsx` (line 515), after printing the manifest, the code checks `if (shipment.label_url)` and prints the label as a second job. For Label Only orders (where `label_url === manifest_url`), this sends the same PDF to the printer twice.

**Fix**: Skip the second label print when the label URL is the same as the manifest URL.

### Changes

**`src/pages/Scan.tsx`** (line ~777):
- Change `if (shipment.label_url)` to `if (shipment.label_url && shipment.label_url !== shipment.manifest_url)`

**`src/pages/Orders.tsx`** (line ~515):
- Change `if (shipment.label_url)` to `if (shipment.label_url && shipment.label_url !== shipment.manifest_url)`

| File | Change |
|------|--------|
| `src/pages/Scan.tsx` | Skip label print when label_url equals manifest_url |
| `src/pages/Orders.tsx` | Skip label print when label_url equals manifest_url |

This is a two-line fix that prevents the duplicate print job while preserving correct behavior for regular orders (where label and manifest are different PDFs).

