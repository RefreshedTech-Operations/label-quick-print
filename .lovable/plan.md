

## Add "Sheet Prep" Page

A new page and nav item for preparing upload sheets with configurable prep rules per platform (starting with TikTok).

### UI Design

- New route `/sheet-prep` under the "Operations" group in the sidebar
- Page layout:
  1. **Header**: "Sheet Prep" title
  2. **File upload area**: Drag-and-drop or click to select a CSV/XLSX file
  3. **Prep type selector**: Radio group or select dropdown (only "TikTok" for now, extensible)
  4. **Preview table**: Shows first ~10 rows of the uploaded file
  5. **"Process" button**: Runs the selected prep rules and produces a downloadable output file
  6. **Download button**: Appears after processing, lets user download the prepped file

### Steps

1. **Create `src/pages/SheetPrep.tsx`** — Page component with file upload, prep type selection, raw preview table, process button, and download output. Uses existing `parseFile` from `src/lib/csv.ts` for parsing. Prep rules will be a placeholder pass-through for now (TikTok selected, no transformations yet).

2. **Update `src/App.tsx`** — Add route `/sheet-prep` wrapped in Layout.

3. **Update `src/components/Layout.tsx`** — Add "Sheet Prep" nav item in the Operations group with a `FileSpreadsheet` icon.

4. **Update `src/lib/pagePermissions.ts`** — Add `/sheet-prep` to `ALL_PAGES` in the Operations group.

5. **Add default permission** — Database migration to insert `/sheet-prep` into `role_page_defaults` for admin, manager, and labeler roles.

