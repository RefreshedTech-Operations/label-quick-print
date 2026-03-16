

# Fix Mobile Sidebar Navigation

## Problem
On mobile (below 768px), the sidebar uses a Sheet component to display navigation. The SheetContent is missing a `SheetTitle`, which causes a Radix accessibility error (`DialogContent requires a DialogTitle`). This can prevent the sheet from rendering properly in some browsers/environments.

## Root Cause
In `src/components/ui/sidebar.tsx` (lines 153-170), the mobile sidebar renders a `Sheet` with `SheetContent` but no `SheetTitle` or `aria-describedby`. The console confirms this error is firing.

## Fix

### 1. Add hidden SheetTitle to mobile sidebar (`src/components/ui/sidebar.tsx`)
- Import `SheetTitle` from the sheet component
- Import `VisuallyHidden` from Radix (`@radix-ui/react-visually-hidden`)
- Inside the mobile Sheet's `SheetContent`, add a visually hidden `SheetTitle` (e.g., "Navigation") to satisfy the accessibility requirement and fix rendering

```tsx
// In the isMobile branch (~line 154):
<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
  <SheetContent ...>
    <VisuallyHidden>
      <SheetTitle>Navigation</SheetTitle>
    </VisuallyHidden>
    <div className="flex h-full w-full flex-col">{children}</div>
  </SheetContent>
</Sheet>
```

This is a one-file fix that resolves the console error and ensures the mobile sidebar sheet renders correctly.

