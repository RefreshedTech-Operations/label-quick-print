

## Fix Camera Barcode Scanner Detection

**Root cause**: The `barcodeHints` Map is created fresh on every render, causing `useZxing` to continuously reinitialize the decoder — it never stabilizes long enough to read a barcode. Additionally, only CODE_128 is enabled, but UPS labels commonly use Code 39 or ITF formats.

### Changes to `src/pages/Pack.tsx`

1. **Move `barcodeHints` outside the component** — Create the hints Map as a module-level constant so it's stable across renders and doesn't trigger `useZxing` reinitialization.

2. **Add all common shipping barcode formats** — Include CODE_128, CODE_39, ITF, and CODABAR to cover UPS, USPS, and FedEx labels.

3. **Remove the `isMobile` gate on the Camera button** — Desktop users with webcams should also be able to use camera scanning.

4. **Simplify camera constraints for desktop** — Use `facingMode: { ideal: 'environment' }` which gracefully falls back to the default camera on desktops.

```typescript
// Module-level constant — stable reference, no re-renders
const BARCODE_HINTS = new Map();
BARCODE_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
]);
BARCODE_HINTS.set(DecodeHintType.TRY_HARDER, true);
```

Then reference `BARCODE_HINTS` in the `useZxing` call instead of the inline `barcodeHints`. Remove the `{isMobile && ...}` wrapper around the Camera/Type toggle button.

No backend changes needed.

