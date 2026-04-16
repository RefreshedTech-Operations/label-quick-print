---
name: Tracking prefix stripping
description: Strips 15-char prepended prefixes from scanned tracking >22 chars, exempts UPS (1Z) tracking
type: feature
---
The tracking number input on the Pack page implements a prefix-stripping rule:
- If the scanned string starts with `1Z`, return as-is (UPS tracking exemption)
- If the scanned string length exceeds 22 characters, strip the first 15 characters
- Otherwise, return the input unchanged

Example: `4201755411320299336220762600012328842` (37 chars) → strips 15 → `9336220762600012328842`
Example: `1ZJ714050319076047` (18 chars, starts with 1Z) → no stripping → `1ZJ714050319076047`
