export interface Batch {
  id: string;
  name: string;
  status: 'scanning' | 'complete' | 'shipped';
  show_date: string | null;
  package_count: number;
  created_by_user_id: string;
  created_at: string;
  completed_at: string | null;
  shipped_at: string | null;
  notes: string | null;
}

export interface BatchStats {
  total_packages: number;
  scanned_packages: number;
  remaining_packages: number;
}

export interface BatchPackage {
  id: string;
  tracking: string;
  order_id: string;
  buyer: string;
  product_name: string;
  printed: boolean;
  batch_scanned_at: string;
}
