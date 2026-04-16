

## Fix USPS Tracking Prefix Stripping

**Problem**: The current `stripPrefix` function strips 12 characters, but USPS GS1-128 barcodes have a 15-character prefix (`420` + 5-digit ZIP + 7-digit service code). Scanning `4201755411320299336220762600012328842` currently yields `99336220762600012328842` (12 stripped) instead of `9336220762600012328842` (15 stripped).

### Change in `src/pages/Pack.tsx`

Update `stripPrefix`: change `cleaned.substring(12)` to `cleaned.substring(15)` to correctly remove the full GS1 application identifier + ZIP prefix.

```typescript
const stripPrefix = (input: string): string => {
  const cleaned = input.replace(/[\r\n\t\x00-\x1f\s]/g, '');
  if (cleaned.startsWith('1Z')) return cleaned;
  if (cleaned.length > 22) {
    return cleaned.substring(15);  // was 12
  }
  return cleaned;
};
```

Also update the memory file `mem://pack-page/tracking-prefix-stripping` to reflect the 15-char rule.

No backend changes needed.

