

## Fix TikTok File Upload — Cancelled Filter Bug

**Problem**: The TikTok export has a "cancelled or failed" column that contains values like `"FALSE"` or `"No"` for non-cancelled orders. The current filter on line 98 of `Upload.tsx` treats any non-empty string as cancelled:

```js
.filter(s => !s.cancelled || s.cancelled.trim() === '')
```

Since `"FALSE"` is a truthy, non-empty string, almost every row gets filtered out. Only a handful slip through (ones with an actually empty cancelled field), explaining the "small increments."

**Fix**: Update the cancelled filter to recognize common false-like values (`"false"`, `"no"`, `"0"`, `"n"`) as not-cancelled.

### Changes

| File | Change |
|------|--------|
| `src/pages/Upload.tsx` (line 98) | Update the cancelled filter to treat `"false"`, `"no"`, `"0"`, `"n"` as non-cancelled |

**Updated filter logic:**
```js
.filter(s => {
  if (!s.cancelled || s.cancelled.trim() === '') return true;
  const val = s.cancelled.trim().toLowerCase();
  return val === 'false' || val === 'no' || val === '0' || val === 'n';
})
```

This is a one-line change that will let TikTok exports (and any other format using "FALSE"/"No" in the cancelled column) upload correctly.

