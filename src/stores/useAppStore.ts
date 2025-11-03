import { create } from 'zustand';
import { Shipment, AppSettings, ColumnMap, DEFAULT_COLUMN_MAP } from '@/types';

interface AppState {
  shipments: Shipment[];
  shipmentMap: Map<string, string>;
  settings: AppSettings;
  columnMap: ColumnMap;
  recentScans: Array<{ uid: string; status: string; timestamp: string }>;
  
  setShipments: (shipments: Shipment[]) => void;
  addShipment: (shipment: Shipment) => void;
  updateShipment: (id: string, updates: Partial<Shipment>) => void;
  findShipmentByUid: (uid: string) => Shipment | undefined;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateColumnMap: (map: Partial<ColumnMap>) => void;
  addRecentScan: (uid: string, status: string) => void;
  clearShipments: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  shipments: [],
  shipmentMap: new Map(),
  settings: {
    auto_print: false,
    block_cancelled: true
  },
  columnMap: DEFAULT_COLUMN_MAP,
  recentScans: [],

  setShipments: (shipments) => {
        const shipmentMap = new Map<string, string>();
        shipments.forEach(s => {
          if (s.uid) {
            shipmentMap.set(s.uid.toUpperCase(), s.id);
          }
        });
        console.log('[Store] Setting shipments:', shipments.length, 'shipments');
        console.log('[Store] Sample UIDs in map:', Array.from(shipmentMap.keys()).slice(0, 10));
        console.log('[Store] Looking for AKV9L:', shipmentMap.has('AKV9L'));
        set({ shipments, shipmentMap });
      },

      addShipment: (shipment) => {
        const { shipments, shipmentMap } = get();
        const newShipments = [...shipments, shipment];
        const newMap = new Map(shipmentMap);
        if (shipment.uid) {
          newMap.set(shipment.uid.toUpperCase(), shipment.id);
        }
        set({ shipments: newShipments, shipmentMap: newMap });
      },

      updateShipment: (id, updates) => {
        const { shipments } = get();
        const newShipments = shipments.map(s => 
          s.id === id ? { ...s, ...updates } : s
        );
        set({ shipments: newShipments });
      },

      findShipmentByUid: (uid) => {
        const { shipments, shipmentMap } = get();
        const upperUid = uid.toUpperCase();
        console.log('[Store] Searching for UID:', upperUid);
        console.log('[Store] Map size:', shipmentMap.size);
        console.log('[Store] Shipments array length:', shipments.length);
        
        const shipmentId = shipmentMap.get(upperUid);
        if (shipmentId) {
          console.log('[Store] Found in map:', shipmentId);
          return shipments.find(s => s.id === shipmentId);
        }
        
        // Fallback: search directly in shipments array
        const fallbackResult = shipments.find(s => s.uid && s.uid.toUpperCase() === upperUid);
        console.log('[Store] Fallback search result:', fallbackResult ? 'FOUND' : 'NOT FOUND');
        return fallbackResult;
      },

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

      clearShipments: () => {
        set({ shipments: [], shipmentMap: new Map() });
      }
    }));
