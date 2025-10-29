export interface ColumnMap {
  uid: string;
  order_id: string;
  buyer: string;
  label_url: string;
  tracking: string;
  address_full: string;
  product_name: string;
  product_description?: string;
  quantity: string;
  price: string;
  cancelled: string;
  manifest_url: string;
}

export interface Shipment {
  id: string;
  org_id: string;
  order_id: string;
  uid: string;
  buyer: string;
  label_url: string;
  tracking?: string;
  address_full: string;
  product_name: string;
  quantity?: number;
  price?: string;
  cancelled?: string;
  manifest_url?: string;
  raw: any;
  printed: boolean;
  printed_at?: string;
  created_at: string;
}

export interface PrintJob {
  id: string;
  org_id: string;
  shipment_id: string;
  uid: string;
  order_id: string;
  printer_id: string;
  printnode_job_id?: number;
  label_url: string;
  status: 'queued' | 'done' | 'error';
  error?: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface AppSettings {
  printnode_api_key?: string;
  printer_id?: string;
  auto_print: boolean;
  fallback_uid_from_description: boolean;
  block_cancelled: boolean;
}

export const DEFAULT_COLUMN_MAP: ColumnMap = {
  uid: 'sku',
  order_id: 'order id',
  buyer: 'buyer',
  label_url: 'label only',
  tracking: 'tracking',
  address_full: 'shipping address',
  product_name: 'product name',
  product_description: 'product description',
  quantity: 'product quantity',
  price: 'sold price',
  cancelled: 'cancelled or failed',
  manifest_url: 'shipment manifest'
};
