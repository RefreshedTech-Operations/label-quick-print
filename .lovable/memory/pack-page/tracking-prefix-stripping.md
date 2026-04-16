---
name: Tracking prefix stripping
description: Normalizes scanned tracking by stripping GS1/AIM prefixes and extracting trailing 22 digits for USPS, exempts UPS (1Z)
type: feature
---
The tracking number input on the Pack page implements a shared `normalizeTracking` function for both camera and text input:

1. Strip control characters, whitespace, and GS1/AIM symbology prefixes (e.g. `]C1`)
2. If the value starts with `1Z`, return as-is (UPS exemption)
3. If the value starts with `420` + digit and length > 22, extract the **trailing 22 digits** (USPS GS1-128 rule)
4. Generic fallback: if length > 22, strip the first 15 characters
5. Otherwise return unchanged

Example: `4201755411320299336220762600012328842` (37 chars, starts with 420) → trailing 22 → `9336220762600012328842`
Example: `1ZJ714050319076047` (starts with 1Z) → no stripping → `1ZJ714050319076047`
Example with AIM prefix: `]C14201755411320299336220762600012328842` → strip `]C1` first, then trailing 22 → `9336220762600012328842`
