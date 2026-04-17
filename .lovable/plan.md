

## Plan — Faster bulk label generation + auto-fix + "Needs review" queue

Two focused improvements based on your answers:

### A. Make bulk generation feel fast (not stuck)

**Current bottleneck**: 10 in-flight at a time, then *await the entire batch* before starting the next 10. Each call takes 2-13s, so the whole batch waits on its slowest call. Progress bar jumps in chunks of 10 and looks stalled.

**Changes (all in `src/pages/ShippingLabels.tsx → handleBulkGenerate`)**:
1. **Sliding window concurrency** instead of batch-and-wait. Keep exactly 10 requests in flight at all times — as soon as one finishes, start the next. Same ShipEngine load, ~30-50% faster wall time on mixed-latency batches.
2. **Live progress** — increment `current/succeeded/failed` after each individual completion (not per batch of 10). Bar moves smoothly.
3. **ETA + throughput** — show "X / Y · ~Zs remaining · ~N labels/min" under the progress bar using a rolling average of recent completions.
4. **In-flight indicator** — small "10 in flight" dot so you can see it's working when nothing has resolved yet.
5. **Cancel button** — stop dispatching new requests; let in-flight ones finish.

### B. Auto-fix obvious problems + "Needs review" queue

**Auto-fix in `supabase/functions/shipengine-proxy/index.ts`** (silent retries, no user prompt):
- **PO Box**: already partially handled — extend to also kick in if the *carrier rejection* message mentions "PO Box" / "post office box".
- **ZIP+4 → ZIP-5 retry**: if validation says zip invalid, retry with the 5-digit prefix.
- **State name vs code mismatch**: already handled by `normalizeState`; extend to retry once if ShipEngine returns a state-related validation error.
- **Country fallback**: if `country_code` parsed as something invalid, retry as `US`.
- **Phone too short**: if carrier rejects on phone, retry without phone (USPS allows it).
- Each auto-fix logs to a new response field `auto_fixes_applied: ['po_box→usps', 'zip+4→zip5']` so the UI can surface "Auto-corrected" badges.

**"Needs review" queue (frontend-only, no schema change)**:
- After a bulk run, any shipment whose error is *not* auto-fixable (bad address, missing street, unknown service, etc.) stays selected as failed (already happens) AND gets persisted to a tiny `localStorage` list `shippingLabels.needsReview` keyed by shipment id + error message + timestamp.
- New tab in Shipping Labels: **"Needs Review"** — shows just those rows with their last error message, an inline "Edit address" / "Override service" / "Mark manual" / "Retry" action, and a "Clear from queue" button. Auto-clears entries once a label is successfully generated.
- This means your bulk run never blocks on questions — failures get parked, you keep printing, you triage afterward.

### Files to change
- `supabase/functions/shipengine-proxy/index.ts` — auto-fix retry loop + report applied fixes.
- `src/pages/ShippingLabels.tsx` — sliding-window concurrency, live progress + ETA, cancel button, Needs Review tab + localStorage queue.

### Out of scope (this round)
- No DB schema changes. No new tables. No memory entries (this is operational UX, not policy).
- No carrier-rate shopping or service-code auto-selection beyond the PO Box rule.

### Validation
- Run a 50+ shipment bulk and confirm: progress bar moves continuously, ETA appears, cancel works, total wall time drops vs current.
- Force a PO Box address → label generates with `po_box_fallback: true` shown as "Auto-fixed" toast.
- Force a bad street → row lands in "Needs Review" tab with the error message and inline edit.

