import { create } from 'zustand';
import { AppSettings, ColumnMap, DEFAULT_COLUMN_MAP } from '@/types';

interface AppState {
  settings: AppSettings;
  columnMap: ColumnMap;
  recentScans: Array<{ uid: string; status: string; timestamp: string }>;
  printnodeApiKey: string | null;
  printnodeApiKeyLoaded: boolean;
  
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateColumnMap: (map: Partial<ColumnMap>) => void;
  addRecentScan: (uid: string, status: string) => void;
  setPrintnodeApiKey: (key: string) => void;
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
}));
