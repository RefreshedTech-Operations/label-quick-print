/**
 * Tiny localStorage-backed queue of shipments whose label generation failed
 * with a non-auto-fixable error. Surfaced in Shipping Labels → "Needs Review".
 */
const KEY = 'shippingLabels.needsReview';

export type NeedsReviewEntry = {
  shipment_id: string;
  error: string;
  timestamp: number;
};

export function getNeedsReview(): NeedsReviewEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: NeedsReviewEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event('needsReview:changed'));
  } catch {
    /* ignore quota errors */
  }
}

export function addNeedsReview(shipment_id: string, error: string) {
  const entries = getNeedsReview().filter(e => e.shipment_id !== shipment_id);
  entries.unshift({ shipment_id, error, timestamp: Date.now() });
  // Cap to avoid runaway growth
  save(entries.slice(0, 500));
}

export function removeNeedsReview(shipment_id: string) {
  const entries = getNeedsReview().filter(e => e.shipment_id !== shipment_id);
  save(entries);
}

export function clearNeedsReview() {
  save([]);
}

export function subscribeNeedsReview(cb: () => void) {
  const handler = () => cb();
  window.addEventListener('needsReview:changed', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('needsReview:changed', handler);
    window.removeEventListener('storage', handler);
  };
}
