

# Add Archive Days Setting to Settings Config Tab

## What we're doing
Add an "Auto-Archive" configuration card to the Settings Config tab that lets admins view and edit the `archive_days` value. Non-admin users won't see this card. We'll also insert the default `archive_days = 10` row into `app_config`.

## Changes

### 1. Insert `archive_days` config row (database)
Insert `archive_days` with value `10` into `app_config` table using the insert tool.

### 2. Update `src/pages/Settings.tsx`
- Add state for `archiveDays` (number) and `archiveDaysLoading` (boolean)
- Load archive_days from `app_config` in `loadAppConfig`
- Check if current user is admin using `useAppStore` roles
- Add a new Card after "Upload Management" (or after Scanning Options) visible only to admins:
  - Title: "Auto-Archive Settings"
  - Description: "Configure how long shipments are kept before being archived"
  - Input for days (number, min 1)
  - Save button that upserts `archive_days` in `app_config`
  - Info text explaining the weekly cron schedule

### Implementation details
- Use `useAppStore` `roles` array to check `roles.includes('admin')`
- Load `archive_days` alongside the existing `printnode_api_key` config load
- Save via upsert to `app_config` with `key = 'archive_days'`
- Show toast on success/error

