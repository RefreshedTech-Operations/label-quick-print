import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ColumnMap } from '@/types';

// Helper function to get column value by trying multiple possible column names
function getColumnValue(row: any, ...possibleNames: string[]): string {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name].toString().trim();
    }
  }
  return '';
}

export function extractUid(
  row: any,
  map: ColumnMap
): string | null {
  // First try SKU column
  const sku = getColumnValue(row, 'sku', 'SKU');
  if (sku) return sku.toUpperCase();
  
  // Fallback: use product description directly
  const desc = getColumnValue(row, 'product description', 'product_description');
  if (desc) return desc.toUpperCase();
  
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

export function parseXLSX(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with headers from first row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as any[][];
        
        if (jsonData.length < 2) {
          resolve([]);
          return;
        }
        
        // First row is headers
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        
        // Convert to objects with header keys (like CSV parser does)
        const result = rows
          .filter(row => row.some(cell => cell !== ''))
          .map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] ?? '';
            });
            return obj;
          });
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function parseFile(file: File): Promise<any[]> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSX(file);
  } else if (fileName.endsWith('.csv')) {
    return parseCSV(file);
  } else {
    return Promise.reject(new Error('Unsupported file format. Please upload a CSV or Excel file.'));
  }
}

export function normalizeShipmentData(row: any, map: ColumnMap) {
  const uid = extractUid(row, map);
  
  // Check for bundle in both CSV (spaces) and Excel (underscores) formats
  const bundleValue = getColumnValue(row, 'bundled in show', 'bundled', 'bundle').toLowerCase();
  const bundle = bundleValue === 'true' || bundleValue === '1' || bundleValue === 'yes' || bundleValue === 't';
  
  return {
    uid: uid || '',
    order_id: getColumnValue(row, 'order id', 'order_id'),
    buyer: getColumnValue(row, 'buyer', 'buyer_username'),
    label_url: getColumnValue(row, 'label only', 'label_only'),
    tracking: getColumnValue(row, 'tracking', 'tracking_code'),
    address_full: getColumnValue(row, 'shipping address', 'shipping_address'),
    product_name: getColumnValue(row, 'product name', 'product_name'),
    quantity: parseInt(getColumnValue(row, 'product quantity', 'product_quantity')) || 0,
    price: getColumnValue(row, 'sold price', 'original_item_price'),
    cancelled: getColumnValue(row, 'cancelled or failed', 'cancelled_or_failed'),
    manifest_url: getColumnValue(row, 'shipment manifest', 'shipment_manifest'),
    bundle,
    raw: row
  };
}
