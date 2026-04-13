

## Fix: Bulk Generation Error Tracking Race Condition

**Root cause**: `handleGenerateLabel` stores errors via `setRowErrors()` (React state), and then `handleBulkGenerate` tries to read those errors via `setRowErrors(prev => ...)` immediately after `Promise.allSettled`. Due to React 18's automatic batching, the state updates from the individual label calls may not be flushed yet, causing incorrect success/failure counts.

Additionally, if any unhandled exception escapes, it could break the batch loop entirely.

**Fix**: Instead of relying on React state to detect failures, collect results directly from the `Promise.allSettled` return values. Wrap each call so it returns a clear success/failure signal.

### Changes — `src/pages/ShippingLabels.tsx` (lines 493-506)

Replace the current batch loop with:

```typescript
for (let i = 0; i < ids.length; i += BATCH_SIZE) {
  const batch = ids.slice(i, i + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(async (id) => {
      try {
        await handleGenerateLabel(id);
        // Check if an error was set by handleGenerateLabel's catch block
        // We can't rely on state, so we return the id and check after
        return id;
      } catch {
        return Promise.reject(id);
      }
    })
  );

  results.forEach((result, idx) => {
    const id = batch[idx];
    if (result.status === 'fulfilled') {
      // Need to also verify no rowError was silently set — but since
      // handleGenerateLabel catches internally, we check differently
      succeeded++;
    } else {
      failed++;
      failedIdSet.add(id);
    }
  });

  const processed = Math.min(i + batch.length, total);
  setBulkProgress({ current: processed, total, succeeded, failed });
}
```

**Problem**: `handleGenerateLabel` catches its own errors and never rejects — so `Promise.allSettled` always sees "fulfilled". The real fix is to make `handleGenerateLabel` **return** a success/failure indicator instead of swallowing errors silently.

**Better approach**: Modify `handleGenerateLabel` to return `{ success: boolean }`, then use that return value directly:

1. **Update `handleGenerateLabel`** (line 446): Change return type to return `{ success: true }` on success and `{ success: false, error: string }` on failure (still sets rowErrors for the UI).

2. **Update `handleBulkGenerate`** (lines 493-506): Use the return value from each `handleGenerateLabel` call to determine success/failure directly, removing the unreliable `setRowErrors(prev => ...)` check.

```typescript
// handleGenerateLabel — add returns
try {
  // ... existing fetch logic ...
  return { success: true };
} catch (err: any) {
  const msg = err?.message || 'Failed to generate label';
  setRowErrors(prev => ({ ...prev, [shipmentId]: msg }));
  return { success: false, error: msg };
} finally {
  setGeneratingIds(prev => { const next = new Set(prev); next.delete(shipmentId); return next; });
}

// handleBulkGenerate — use return values
const results = await Promise.allSettled(
  batch.map(id => handleGenerateLabel(id))
);
results.forEach((result, idx) => {
  const id = batch[idx];
  if (result.status === 'fulfilled' && result.value.success) {
    succeeded++;
  } else {
    failed++;
    failedIdSet.add(id);
  }
});
```

This removes the dependency on React state for tracking results and ensures each of the 10 parallel labels is independently tracked — a failure in one never affects the other 9.

| File | Change |
|------|--------|
| `src/pages/ShippingLabels.tsx` | Make `handleGenerateLabel` return `{ success }`, update batch loop to use return values instead of reading `rowErrors` state |

