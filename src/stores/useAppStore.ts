import { create } from 'zustand';
import { AppSettings, ColumnMap, DEFAULT_COLUMN_MAP } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { computeAllowedPages } from '@/lib/pagePermissions';

interface AppState {
  settings: AppSettings;
  columnMap: ColumnMap;
  recentScans: Array<{ uid: string; status: string; timestamp: string }>;
  printnodeApiKey: string | null;
  printnodeApiKeyLoaded: boolean;

  // Permissions cache
  allowedPages: Set<string>;
  roles: string[];
  permissionsLoaded: boolean;
  
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateColumnMap: (map: Partial<ColumnMap>) => void;
  addRecentScan: (uid: string, status: string) => void;
  setPrintnodeApiKey: (key: string) => void;
  loadPermissions: (force?: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  settings: {
    auto_print: false,
    block_cancelled: true
  },
  columnMap: DEFAULT_COLUMN_MAP,
  recentScans: [],
  printnodeApiKey: null,
  printnodeApiKeyLoaded: false,

  // Permissions cache
  allowedPages: new Set<string>(),
  roles: [],
  permissionsLoaded: false,

  updateSettings: (newSettings) => {
    const { settings } = get();
    set({ settings: { ...settings, ...newSettings } });
  },

  updateColumnMap: (newMap) => {
    const { columnMap } = get();
    set({ columnMap: { ...columnMap, ...newMap } });
  },

  addRecentScan: (uid, status) => {
    const { recentScans } = get();
    const newScans = [
      { uid, status, timestamp: new Date().toISOString() },
      ...recentScans.slice(0, 19)
    ];
    set({ recentScans: newScans });
  },

  setPrintnodeApiKey: (key) => {
    set({ printnodeApiKey: key, printnodeApiKeyLoaded: true });
  },

  loadPermissions: async (force = false) => {
    // Skip if already loaded (unless forcing a reload)
    if (!force && get().permissionsLoaded) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Don't mark as loaded when there's no user — auth may still be restoring
      return;
    }

    const [{ data: rolesData }, { data: overridesData }, { data: roleDefaultsData }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('user_page_permissions').select('page_path, allowed').eq('user_id', user.id),
      supabase.from('role_page_defaults').select('role, page_path'),
    ]);

    const userRoles = (rolesData || []).map(r => r.role);
    const overrides = (overridesData || []).map(o => ({
      page_path: o.page_path,
      allowed: o.allowed,
    }));
    const roleDefaults = (roleDefaultsData || []).map(rd => ({
      role: rd.role,
      page_path: rd.page_path,
    }));

    set({
      roles: userRoles,
      allowedPages: computeAllowedPages(userRoles, roleDefaults, overrides),
      permissionsLoaded: true,
    });
  },
}));
