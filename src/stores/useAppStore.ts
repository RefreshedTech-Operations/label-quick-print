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
    fallback_uid_from_description: true,
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
        const shipmentId = shipmentMap.get(upperUid);
        if (shipmentId) {
          return shipments.find(s => s.id === shipmentId);
        }
        return undefined;
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
