

## Fix Duplicate TikTok Upload (Wrong Show Date)

**Problem**: The TikTok CSV (610 records) was uploaded twice — once correctly for April 10th and once incorrectly for April 13th. Since the upload uses `onConflict: 'order_id'`, the second upload overwrote the first, so now all 610 TikTok records have `show_date = 2026-04-13` instead of `2026-04-10`.

**Fix**: Update the `show_date` from `2026-04-13` to `2026-04-10` for the TikTok upload (`upload_id: 05cb2e07-348b-4781-901f-1bbbbe3394d1`).

### Steps

1. **Update show_date** on the 610 shipments with `upload_id = '05cb2e07-348b-4781-901f-1bbbbe3394d1'` from `2026-04-13` to `2026-04-10` using the database insert tool (data update).

No code changes needed — this is a data correction only.

