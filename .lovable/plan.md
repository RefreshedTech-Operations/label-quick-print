
# Sidebar Navigation Upgrade

The current top navigation bar has up to 10+ buttons in a single row, which gets crowded. We'll replace it with a collapsible sidebar layout using the existing Shadcn Sidebar component.

## What Changes

- **Header**: Slimmed down to just the logo, a sidebar toggle button, theme toggle, and sign-out button
- **Sidebar**: All navigation links (Scan, Upload, All Orders, Print Jobs, Batches, TV Dashboard, Messages, Customers, Admin, Settings) move into a vertical sidebar menu
- **Collapsible**: The sidebar can be collapsed to a narrow icon-only strip, or expanded to show labels
- **Active route highlighting**: The current page will be visually highlighted in the sidebar
- **Role-based items**: Messages/Customers (messaging role) and Admin (admin role) will still only appear for authorized users

## Technical Details

### Files to modify

1. **`src/components/Layout.tsx`** -- Rewrite to use `SidebarProvider`, `Sidebar`, and a slim header with `SidebarTrigger`. Navigation items move into the sidebar body grouped logically:
   - **Operations**: Scan, Upload, All Orders, Print Jobs, Batches
   - **Monitoring**: TV Dashboard
   - **Communication** (messaging role only): Messages, Customers
   - **System**: Settings, Admin (admin role only)

2. **`src/App.tsx`** -- Wrap the routes that use `Layout` so the `SidebarProvider` is at the correct level. The `Index` page already wraps itself in `Layout`, so it will get the sidebar too.

3. **`src/pages/Index.tsx`** -- Minor adjustment since it imports `Layout` directly; ensure it works within the new sidebar-based layout.

### Layout structure

```text
+--SidebarProvider (w-full)------------------+
| +--header (h-12, border-b)---------------+ |
| | SidebarTrigger | Logo | ThemeToggle Out | |
| +----------------------------------------+ |
| +--flex row (min-h-screen)---------------+ |
| | Sidebar  |  main (flex-1, children)    | |
| | - Scan   |                             | |
| | - Upload |                             | |
| | - Orders |                             | |
| | - ...    |                             | |
| +----------------------------------------+ |
+--------------------------------------------+
```

### Sidebar behavior
- Default: expanded on desktop, collapsed on mobile
- Toggle via hamburger icon in the header
- Collapsed state shows icons only (narrow strip)
- Uses existing `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` components
