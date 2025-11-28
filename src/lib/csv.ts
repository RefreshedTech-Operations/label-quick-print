import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ColumnMap } from '@/types';

export function extractUid(
  row: any,
  map: ColumnMap
): string | null {
  // First try SKU column
  const sku = (row[map.uid] ?? '').toString().trim();
  if (sku) return sku.toUpperCase();
  
  // Fallback: use product description directly
  if (map.product_description) {
    const desc = (row[map.product_description] ?? '').toString().trim();
    if (desc) return desc.toUpperCase();
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
  const bundleValue = map.bundle ? (row[map.bundle] ?? '').toString().trim().toLowerCase() : '';
  const bundle = bundleValue === 'true' || bundleValue === '1' || bundleValue === 'yes' || bundleValue === 't';
  
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
    bundle,
    raw: row
  };
}
