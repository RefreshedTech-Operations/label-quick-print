// Default page access per role
// Pages not listed here are accessible to everyone with any role
export const ALL_PAGES = [
  { path: '/', label: 'Scan', group: 'Operations' },
  { path: '/upload', label: 'Upload', group: 'Operations' },
  { path: '/orders', label: 'All Orders', group: 'Operations' },
  { path: '/print-jobs', label: 'Print Jobs', group: 'Operations' },
  { path: '/batches', label: 'Batches', group: 'Operations' },
  { path: '/tv-dashboard', label: 'TV Dashboard', group: 'Monitoring' },
  { path: '/messages', label: 'Messages', group: 'Communication' },
  { path: '/customers', label: 'Customers', group: 'Communication' },
  { path: '/settings', label: 'Settings', group: 'System' },
  { path: '/admin', label: 'Admin', group: 'System' },
] as const;

export type PagePath = typeof ALL_PAGES[number]['path'];

// Role-based default access. If a role isn't listed, it gets no pages by default.
const ROLE_DEFAULTS: Record<string, PagePath[]> = {
  admin: ['/', '/upload', '/orders', '/print-jobs', '/batches', '/tv-dashboard', '/messages', '/customers', '/settings', '/admin'],
  moderator: ['/', '/upload', '/orders', '/print-jobs', '/batches', '/tv-dashboard', '/settings'],
  user: ['/', '/upload', '/orders', '/print-jobs', '/batches', '/tv-dashboard', '/settings'],
  messaging: ['/messages', '/customers'],
};

/**
 * Given a user's roles and their per-user page overrides,
 * compute the final set of allowed page paths.
 */
export function computeAllowedPages(
  roles: string[],
  overrides: { page_path: string; allowed: boolean }[]
): Set<string> {
  // Start with the union of all role defaults
  const allowed = new Set<string>();
  for (const role of roles) {
    const defaults = ROLE_DEFAULTS[role];
    if (defaults) {
      for (const p of defaults) allowed.add(p);
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
