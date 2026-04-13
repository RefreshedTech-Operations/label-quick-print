

## Increase Bulk Label Generation Concurrency to 10

**Current state**: The `handleBulkGenerate` function in `src/pages/ShippingLabels.tsx` processes labels in batches of 3 (`BATCH_SIZE = 3`).

**Change**: Update `BATCH_SIZE` from `3` to `10` on line 487.

| File | Change |
|------|--------|
| `src/pages/ShippingLabels.tsx` (line 487) | Change `const BATCH_SIZE = 3` → `const BATCH_SIZE = 10` |

This is a single constant change — 10 label generation requests will fire in parallel per batch instead of 3.

