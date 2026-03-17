

# Add TikTok Channel Option

## Changes needed

### 1. Database: Update channel CHECK constraint
Update the `shipments_channel_check` constraint to allow `'tiktok'` in addition to `'regular'`, `'misfits'`, and `'outlet'`.

### 2. Upload page (`src/pages/Upload.tsx`)
Add a new radio option after the Outlet channel:
```
TikTok Channel (chargers required)
```
Value: `tiktok`

### 3. No changes needed to ChargerWarning or Scan page
Since TikTok requires chargers (like `regular`), the existing logic already handles it correctly — ChargerWarning only suppresses for `misfits` and `outlet`, so `tiktok` will show charger warnings by default.

