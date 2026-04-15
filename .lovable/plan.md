

## Update Prefix Stripping to Exempt UPS Tracking

**Problem**: UPS tracking numbers starting with `1ZJ` are 18 characters long and shouldn't have any prefix stripped, but the current `stripPrefix` function strips 12 characters from anything over 22 chars. With the planned change to strip 15 chars, we also need to handle this UPS exemption.

**Changes to `src/pages/Pack.tsx`** — Update `stripPrefix` to:
1. Change substring from 12 to 15 (the previously approved change)
2. Skip stripping entirely if the input starts with `1Z` (standard UPS prefix)

```typescript
const stripPrefix = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.startsWith('1Z')) return trimmed;
  if (trimmed.length > 30) {
    return trimmed.substring(15);
  }
  return trimmed;
};
```

**Update memory** — `mem://pack-page/tracking-prefix-stripping` to document both the 15-char strip rule and the `1Z` exemption for UPS tracking.

