import Papa from 'papaparse';
import { ColumnMap } from '@/types';

export function extractUid(
  row: any,
  map: ColumnMap,
  fallbackFromDescription: boolean
): string | null {
  const sku = (row[map.uid] ?? '').toString().trim();
  if (sku) return sku.toUpperCase();
  
  if (fallbackFromDescription && map.product_description) {
    const desc = (row[map.product_description] ?? '').toString();
    const m = desc.match(/^\s*([^\s,;]+)/);
    if (m) return m[1].toUpperCase();
  }
  
  return null;
}

export function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export function normalizeShipmentData(row: any, map: ColumnMap, fallbackUid: boolean) {
  const uid = extractUid(row, map, fallbackUid);
  
  return {
    uid: uid || '',
    order_id: (row[map.order_id] ?? '').toString().trim(),
    buyer: (row[map.buyer] ?? '').toString().trim(),
    label_url: (row[map.label_url] ?? '').toString().trim(),
    tracking: (row[map.tracking] ?? '').toString().trim(),
    address_full: (row[map.address_full] ?? '').toString().trim(),
    product_name: (row[map.product_name] ?? '').toString().trim(),
    quantity: parseInt((row[map.quantity] ?? '').toString()) || 0,
    price: (row[map.price] ?? '').toString().trim(),
    cancelled: (row[map.cancelled] ?? '').toString().trim(),
    manifest_url: (row[map.manifest_url] ?? '').toString().trim(),
    raw: row
  };
}
