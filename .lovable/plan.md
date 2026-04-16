

Validation passed. Here are the highest-value next steps for Sheet Prep — pick any to implement.

## Options

### 1. "Send to Upload" shortcut (recommended)
Add a button on Sheet Prep that pushes prepped rows directly into the Upload flow via the existing `window.__uploadCSV` programmatic API. Skips the download → re-upload round trip.

### 2. Processing summary panel
After Process runs, show a small stats card:
- Raw rows in
- Description row dropped
- Cancelled/failed dropped
- Final rows out
- Rows missing tracking / address

### 3. Add more prep types
The `applyPrepRules` switch is generic — easy to plug in:
- Whatnot export → upload format
- Misfits export → upload format
- Outlet export → upload format

### 4. Remember last-used prep type
Persist `prepType` in localStorage so it defaults to your most-used source.

### 5. Auto-detect prep type
Sniff source columns on file load (e.g. presence of `Buyer Username` + `Package ID` → TikTok) and preselect the matching prep type.

## Files involved
- `src/pages/SheetPrep.tsx` for UI/wiring
- `src/lib/tiktokPrep.ts` already in place; new prep types would each get their own `src/lib/<name>Prep.ts`

Tell me which one(s) to build and I'll switch to default mode and implement.

