

## Skip Errors During Bulk Label Generation

**Problem**: When a label fails (usually due to an address issue), the error handling in `handleBulkGenerate` counts it but the failed shipment stays selected and mixed in with the queue. After bulk generation completes, the selection is cleared and there's no easy way to find/retry just the failed ones.

**Solution**: Track failed shipment IDs during bulk generation, skip them gracefully, and after completion present a summary with the option to select only the failed ones for review/retry.

### Changes — `src/pages/ShippingLabels.tsx`

1. **Add `failedIds` state** to track which shipments errored during the last bulk run:
   ```ts
   const [bulkFailedIds, setBulkFailedIds] = useState<Set<string>>(new Set());
   ```

2. **Update `handleBulkGenerate`** (~lines 481-509):
   - Collect failed IDs as errors occur
   - After completion, set `selectedIds` to only the failed IDs (instead of clearing)
   - Store failed IDs in `bulkFailedIds` for the UI banner
   - Only clear selection if everything succeeded

3. **Add a "failed summary" banner** after bulk generation completes with failures:
   - Show count of failed labels with a dismissible alert
   - "Select All Failed" button that re-selects just the failed shipments
   - "Retry Failed" button to re-run generation on only the errored ones
   - Failed rows already have inline error messages via `rowErrors` state, so users can see and fix addresses before retrying

4. **Keep the queue moving**: The current `Promise.allSettled` already prevents one failure from blocking others within a batch. The key change is in the post-completion UX — don't lose track of which ones failed.

### Implementation detail

The updated `handleBulkGenerate` will:
```
- Run all batches (errors don't block)  ← already works
- Collect failedIds from rowErrors     ← new
- If failures > 0: set selectedIds = failedIds, show banner  ← new  
- If all succeeded: clear selection     ← current behavior
```

The banner will appear above the table when `bulkFailedIds.size > 0` and auto-dismiss when the user navigates away or starts a new bulk run.

| File | Change |
|------|--------|
| `src/pages/ShippingLabels.tsx` | Add `bulkFailedIds` state, update bulk handler to track/select failures, add failed-summary banner with retry button |

