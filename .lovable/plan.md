

## Plan: Parallel Label Generation

### What Changes
Modify `handleBulkGenerate` in `src/pages/ShippingLabels.tsx` to process multiple labels concurrently instead of one-by-one.

### Approach
- Process labels in parallel batches of **3** (a safe concurrency level that avoids overwhelming ShipEngine's rate limits while being 3x faster).
- Use a simple chunking approach: take 3 IDs at a time, run them with `Promise.allSettled`, update progress after each batch completes.
- The progress indicator will still work — it will update after each batch of 3 finishes rather than after each individual label.
- No changes to the edge function or backend needed.

### File Modified
- `src/pages/ShippingLabels.tsx` — Replace the sequential `for` loop in `handleBulkGenerate` with a batched `Promise.allSettled` loop (concurrency = 3).

