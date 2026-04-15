

## Replace Camera Scanner Library for Reliable Barcode Detection

**Problem**: `react-zxing` (wrapping `@zxing/library` v0.20.0) is notoriously poor at detecting 1D barcodes from live video streams. Despite stabilizing the hints Map and tuning resolution, the fundamental decoder struggles with real-world barcode images from webcams and phone cameras. This is a known limitation of the ZXing JS port.

**Solution**: Replace `react-zxing` with `html5-qrcode`, which leverages the **native `BarcodeDetector` API** (available in Chrome, Edge, and Safari 17+) with an automatic ZXing fallback. The native API is dramatically better at 1D barcode recognition from camera feeds.

### Changes

**1. Swap dependencies**
- Remove: `react-zxing`
- Add: `html5-qrcode`

**2. Rewrite camera scanner in `src/pages/Pack.tsx`**

Replace the `useZxing` hook with a manual `Html5Qrcode` instance managed via `useEffect`:

- On `cameraMode = true`: create an `Html5Qrcode` instance, call `.start()` with `{ facingMode: "environment" }`, configure for 1D formats only (`Html5QrcodeSupportedFormats.CODE_128`, `CODE_39`, `ITF`, `CODABAR`)
- On successful decode: run the same `isLikelyTrackingBarcode` → `processTracking` pipeline with cooldown logic
- On `cameraMode = false` or unmount: call `.stop()` and `.clear()`
- Render a target `<div id="pack-camera-reader">` instead of a `<video>` element (html5-qrcode manages its own video)

**3. Keep existing logic untouched**
- `stripPrefix`, `isLikelyTrackingBarcode`, `processTracking`, cooldown, reticle overlay, recent packs list — all stay the same
- The red targeting reticle built into html5-qrcode's scanner region replaces our custom overlay (or we keep ours on top)

**4. Camera config for mobile-first**
- `facingMode: "environment"` (rear camera on phones, default on desktop)
- `fps: 10` for smooth scanning without excessive CPU
- `qrbox: { width: 300, height: 100 }` — narrow horizontal scan region optimized for 1D barcodes
- `aspectRatio: 1.333` for 4:3 video on mobile

### Technical details

```text
html5-qrcode detection chain:
  1. Check if native BarcodeDetector API exists (Chrome 83+, Safari 17+)
  2. If yes → use hardware-accelerated native detection (fast, reliable)
  3. If no  → fall back to ZXing JS (same as current, but with better frame handling)
```

No backend or database changes needed.

