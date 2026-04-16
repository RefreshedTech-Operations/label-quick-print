
Fix USPS camera scanning

What I found
- Manual/text lookup already works, so the database query and 15-character USPS extraction are not the main blocker now.
- The remaining problem is camera-specific. In `src/pages/Pack.tsx`, the scanner uses a very small fixed scan box (`qrbox: { width: 300, height: 100 }`) plus the library’s default detector behavior. That combination is often weak for long, dense USPS GS1-128 / Code 128 labels.
- The camera path also assumes the decoded value is already clean. USPS camera reads can include extra GS1/AIM prefixes like `]C1`, so valid scans may still be rejected or trimmed incorrectly.
- I also found the tracking memory note is out of sync and still mentions the older 12-character rule.

Implementation plan
1. Harden normalization in `src/pages/Pack.tsx`
   - Replace the current `stripPrefix` helper with one shared normalizer for both camera and text input.
   - Strip whitespace/control chars and GS1/AIM prefixes like `]C1` first.
   - Keep UPS `1Z...` values unchanged.
   - For long USPS numeric scans starting with `420`, extract the actual tracking value robustly by keeping the trailing 22 digits, which matches your required result: `9336220762600012328842`.

2. Improve camera decoding reliability
   - Remove or significantly widen the fixed `qrbox` so long USPS barcodes are not clipped.
   - Configure `html5-qrcode` to use the library decoder path instead of relying on the browser detector, which should improve GS1-128 / Code 128 scanning consistency.
   - Keep the scanner limited to 1D barcodes to preserve the current warehouse workflow.

3. Tighten the scan callback
   - Normalize first, then validate.
   - Use the normalized value consistently for duplicate protection, cooldown, lookup, and recent-pack display.
   - Keep the current cooldown behavior and avoid adding heavy UI work in the scan loop.

4. Sync documentation
   - Update the tracking-prefix memory entry so it matches the final USPS rule and no longer references the stale 12-character behavior.

Validation after implementation
- Test camera scanning with the USPS label flow and confirm the lookup uses `9336220762600012328842`.
- Re-test UPS camera scanning to confirm `1Z` labels still work unchanged.
- Re-test manual USPS entry to confirm no regression.
- Toggle Camera/Type a few times to confirm the earlier scanner cleanup error does not return.

Technical details
- Likely weak point now: `qrbox: { width: 300, height: 100 }`
- Likely normalization gap: no handling for camera-added GS1/AIM prefixes before USPS extraction
- Files to update: `src/pages/Pack.tsx` and the tracking-prefix memory entry
- No backend/database changes needed
