
# Pack Page: Duplicate Scan Prevention and Visual Feedback

## What will change

The Pack page will be enhanced with three improvements:

1. **Duplicate scan prevention** -- Once a package is successfully packed, scanning the same tracking number again will show an error (it already does this via the "Already packed" check, but we'll also track scans locally in the session to catch rapid re-scans before the DB is even queried).

2. **Camera cooldown (5 seconds)** -- After the camera scanner decodes a barcode, it will pause for 5 seconds before accepting another scan. This prevents the same label from being read repeatedly while still in view.

3. **Visual feedback with color flash** -- The scan card background will briefly flash **green** on a successful pack and **red** on any error (already packed, not found, etc.), then fade back to normal.

---

## Technical Details

All changes are in `src/pages/Pack.tsx`:

### New state
- `scanStatus: 'idle' | 'success' | 'error'` -- drives the background color of the scan card
- `lastScannedTracking: string | null` + `cooldownActive: boolean` -- for camera cooldown logic

### `processTracking` changes
- Returns a result (`'success' | 'error'`) so callers can react
- On any error path (not found, already packed, failed update), sets `scanStatus` to `'error'`
- On success, sets `scanStatus` to `'success'`
- After 2 seconds, resets `scanStatus` back to `'idle'` (auto-fade)

### Camera cooldown
- After `onDecodeResult` fires and `processTracking` completes, set `cooldownActive = true` and store the decoded tracking number
- Ignore any `onDecodeResult` calls while cooldown is active or if the decoded text matches the last scanned tracking
- After 5 seconds, reset `cooldownActive` to `false` and clear `lastScannedTracking`

### Visual feedback on the scan Card
- Apply a CSS transition class to the scan `Card` based on `scanStatus`:
  - `'success'` -- green background (`bg-green-500/20 border-green-500`)
  - `'error'` -- red background (`bg-red-500/20 border-red-500`)
  - `'idle'` -- default styling
- Use `transition-colors duration-500` for a smooth fade effect
