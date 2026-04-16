

## TikTok Sheet Prep — Implementation Plan

I cannot read .xlsx contents in plan mode (parser returned empty), so step 1 of implementation will be inspecting both your sample files via script before coding the mappings.

### Step 1 — Inspect both sample files
Run a one-off script to print sheet names, columns, and 2-3 sample rows from:
- `To_Ship_order-2026-04-16-08_01.xlsx` (raw TikTok seller-center export)
- `TikTok_LabelApp_2026-04-16.xlsx` (your manually-prepped output)

This locks the exact source columns, target columns, header row offset, and any dropped/renamed/derived fields.

### Step 2 — Build the TikTok prep transform in `src/pages/SheetPrep.tsx`
Replace the placeholder `applyPrepRules` for `prepType === 'tiktok'` with a transform that:
1. **Drops cancelled/failed rows** (case-insensitive match on TikTok's cancellation status column — exact column name confirmed in Step 1).
2. **Maps raw columns → processed columns** to exactly match the structure of `TikTok_LabelApp_2026-04-16.xlsx` (so the output is drop-in identical to what you produce by hand today).
3. **Trims whitespace** and normalizes obvious value formatting (e.g. quantity to integer, address concatenation if needed).
4. **De-dupes** if the prepped file shows dedupe behavior (confirmed in Step 1).
5. Outputs in the same column order as your prepped file.

### Step 3 — Output options
Keep the existing **Download CSV** button. Also add a **Download XLSX** button so the prepped output can match your current xlsx workflow, using the `xlsx` library already installed in the project (`src/lib/csv.ts` already imports it).

### Step 4 — Preview
The existing 10-row preview table in `SheetPrep.tsx` will automatically reflect the processed columns/values — no changes needed there.

### Files to change
- `src/pages/SheetPrep.tsx` — TikTok rules + xlsx download.
- No backend / DB / memory changes.

### Validation
- Upload `To_Ship_order-2026-04-16-08_01.xlsx`, run TikTok prep, and diff the output against `TikTok_LabelApp_2026-04-16.xlsx` (same row count after cancellations dropped, same columns, same values per row).

