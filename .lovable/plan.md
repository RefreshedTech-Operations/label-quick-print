

## Optimize Pack Page for Barcode Scanner Input

**Problem**: Physical barcode scanners work by rapidly "typing" characters then sending Enter. The current implementation has issues:
1. The `stripPrefix` function may not handle hidden characters scanners inject (carriage returns `\r`, tabs, etc.)
2. No debounce protection against partial submissions if the form triggers mid-scan
3. The 500ms focus-steal interval could interfere during rapid input

### Changes to `src/pages/Pack.tsx`

1. **Sanitize scanner input** — In `stripPrefix`, strip all non-printable characters (`\r`, `\n`, `\t`, etc.) before any logic runs. Use a regex like `/[\r\n\t\x00-\x1f]/g` to remove control characters.

2. **Add scan-speed debounce** — Instead of processing immediately on form submit, add a short debounce (~50ms) to ensure the scanner has finished sending all characters before processing. This prevents partial tracking number submissions.

3. **Trim whitespace aggressively** — Apply `.replace(/\s+/g, '')` to remove any spaces/whitespace that scanners may inject between characters.

4. **Disable autocomplete attributes** — Add `autoCorrect="off"`, `spellCheck={false}`, and `autoCapitalize="off"` to the input to prevent mobile keyboards and browsers from interfering with raw scanner input.

The updated `stripPrefix` function:
```typescript
const stripPrefix = (input: string): string => {
  // Remove all control characters and whitespace
  const cleaned = input.replace(/[\r\n\t\x00-\x1f\s]/g, '');
  if (cleaned.startsWith('1Z')) return cleaned;
  if (cleaned.length > 30) {
    return cleaned.substring(15);
  }
  return cleaned;
};
```

No backend changes needed.

