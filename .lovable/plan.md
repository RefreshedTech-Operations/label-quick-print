

# Roles Management Page + Users Page Redesign

## Overview

Add a new "Roles" tab to the Admin panel where you can configure which pages each role grants access to by default. Also redesign the Users tab into a clean unified table with inline actions.

## Changes

### 1. New database table: `role_page_defaults`

Stores which pages each role grants access to, replacing the hardcoded `ROLE_DEFAULTS` in code.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| role | text | e.g. "admin", "user" |
| page_path | text | e.g. "/orders" |
| created_at | timestamptz | Default now() |

Unique constraint on (role, page_path). RLS: admins can manage, authenticated can read. On creation, seed with the current hardcoded defaults.

### 2. Update `src/lib/pagePermissions.ts`

- Remove the hardcoded `ROLE_DEFAULTS` constant
- Update `computeAllowedPages` to accept role defaults as a parameter (fetched from DB)
- Keep `ALL_PAGES` as-is

### 3. Update `src/hooks/useUserPermissions.ts`

- Also fetch `role_page_defaults` from DB to pass into `computeAllowedPages`

### 4. Redesign `src/pages/AdminTools.tsx`

**Three tabs**: Users | Roles | System

**Users tab** -- Single unified table:
- Each row: email, join date, role badges with (x) to remove, "Add role" dropdown, reset password button, expandable page permission toggles
- "Create User" button at top
- Remove the separate "Add Role by Email" card and "Current Roles" card

**Roles tab** (new):
- Shows each role (admin, moderator, user, messaging) as an expandable card
- Inside each role card: a list of all pages with toggle switches to include/exclude from that role's defaults
- Changes are saved to the `role_page_defaults` table

**System tab** -- unchanged (archiving)

### 5. Update `src/components/Layout.tsx`

- Update `useUserPermissions` usage to work with the new DB-driven role defaults

## Technical Details

### Database migration

```sql
CREATE TABLE role_page_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  page_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, page_path)
);

ALTER TABLE role_page_defaults ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can view role defaults"
  ON role_page_defaults FOR SELECT TO authenticated USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage role defaults"
  ON role_page_defaults FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed with current hardcoded defaults
INSERT INTO role_page_defaults (role, page_path) VALUES
  ('admin', '/'), ('admin', '/upload'), ('admin', '/orders'),
  ('admin', '/print-jobs'), ('admin', '/batches'), ('admin', '/tv-dashboard'),
  ('admin', '/messages'), ('admin', '/customers'), ('admin', '/settings'), ('admin', '/admin'),
  ('moderator', '/'), ('moderator', '/upload'), ('moderator', '/orders'),
  ('moderator', '/print-jobs'), ('moderator', '/batches'), ('moderator', '/tv-dashboard'),
  ('moderator', '/settings'),
  ('user', '/'), ('user', '/upload'), ('user', '/orders'),
  ('user', '/print-jobs'), ('user', '/batches'), ('user', '/tv-dashboard'),
  ('user', '/settings'),
  ('messaging', '/messages'), ('messaging', '/customers');
```

### File changes summary

- **New migration**: Create `role_page_defaults` table with seed data
- **`src/lib/pagePermissions.ts`**: Remove hardcoded `ROLE_DEFAULTS`, update `computeAllowedPages` signature to accept role defaults as parameter
- **`src/hooks/useUserPermissions.ts`**: Fetch `role_page_defaults` from DB, pass to `computeAllowedPages`
- **`src/pages/AdminTools.tsx`**: Full rewrite of Users tab into unified table, add Roles tab with per-role page toggles, remove Page Permissions tab

