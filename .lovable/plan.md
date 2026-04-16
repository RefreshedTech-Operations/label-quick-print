

## Plan — Auto-redirect TikTok uploads to Shipping Labels

After a successful upload where `channel === 'tiktok'`, navigate the user to `/shipping-labels` with the just-uploaded show date pre-applied as the filter.

### Investigation needed (in implementation mode)
1. Read `src/pages/Upload.tsx` to find the post-submit success path and confirm the `showDate` variable name + format used at submit.
2. Read `src/pages/ShippingLabels.tsx` to confirm how its show-date filter is read — either:
   - URL search param (e.g. `?showDate=YYYY-MM-DD`), or
   - sessionStorage / store value, or
   - local component state seeded from a prop/param.

### Implementation
- **`src/pages/Upload.tsx`**: After the upload completes successfully, if `channel === 'tiktok'`, call `navigate(\`/shipping-labels?showDate=${showDate}\`)` (exact param key matched to whatever ShippingLabels already supports — added if not present).
- **`src/pages/ShippingLabels.tsx`** (only if needed): On mount, read `showDate` from `useSearchParams()` and seed the existing show-date filter state with it. No UI changes — just preselect the filter.

### Out of scope
- No changes for non-TikTok channels (regular/misfits/outlet stay on Upload as today).
- No DB or memory changes.

### Validation
Upload a TikTok CSV with show date X → on success the app lands on `/shipping-labels` with show date X already filtered and the matching shipments visible.

