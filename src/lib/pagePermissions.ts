// Default page access per role
// Pages not listed here are accessible to everyone with any role
export const ALL_PAGES = [
  { path: '/', label: 'Scan', group: 'Operations' },
  { path: '/upload', label: 'Upload', group: 'Operations' },
  { path: '/orders', label: 'All Orders', group: 'Operations' },
  { path: '/print-jobs', label: 'Print Jobs', group: 'Operations' },
  { path: '/batches', label: 'Batches', group: 'Operations' },
  { path: '/tv-dashboard', label: 'TV Dashboard', group: 'Monitoring' },
  { path: '/analytics', label: 'Analytics', group: 'Monitoring' },
  { path: '/messages', label: 'Messages', group: 'Communication' },
  { path: '/customers', label: 'Customers', group: 'Communication' },
  { path: '/settings', label: 'Settings', group: 'System' },
  { path: '/admin', label: 'Admin', group: 'System' },
] as const;

export type PagePath = typeof ALL_PAGES[number]['path'];

/**
 * Given a user's roles, DB-driven role defaults, and per-user overrides,
 * compute the final set of allowed page paths.
 */
export function computeAllowedPages(
  roles: string[],
  roleDefaults: { role: string; page_path: string }[],
  overrides: { page_path: string; allowed: boolean }[]
): Set<string> {
  // Start with the union of all role defaults from DB
  const allowed = new Set<string>();
  for (const rd of roleDefaults) {
    if (roles.includes(rd.role)) {
      allowed.add(rd.page_path);
    }
  }

  // Apply per-user overrides
  for (const override of overrides) {
    if (override.allowed) {
      allowed.add(override.page_path);
    } else {
      allowed.delete(override.page_path);
    }
  }

  return allowed;
}
