// TikTok seller-center "OrderSKUList" export → app upload format.
// Mappings derived from real samples (To_Ship_order vs TikTok_LabelApp).

export const TIKTOK_OUTPUT_HEADERS = [
  'order id',
  'order numeric id',
  'buyer',
  'product name',
  'product description',
  'product quantity',
  'sold price',
  'cancelled or failed',
  'bundled in show',
  'tracking',
  'shipment id',
  'shipment manifest',
  'label only',
  'shipping address',
  'postal_code',
  'placed at',
  'coupon code',
  'coupon price',
  'cost per item',
  'total cost',
  'sku',
  'unit id',
  'shipping price',
] as const;

const STATE_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME',
  'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX',
  'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'puerto rico': 'PR', 'u.s. virgin islands': 'VI', 'guam': 'GU',
  'american samoa': 'AS', 'northern mariana islands': 'MP',
};

const COUNTRY_ABBREV: Record<string, string> = {
  'united states': 'US',
  'usa': 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
};

const UNIT_SUFFIX_RE = /^([A-Za-z]{1,4})\s+as\s+sh(?:own|won)$/i;

// TikTok cancelled/failed Order Status values (case-insensitive contains).
const CANCEL_STATUSES = ['cancel', 'failed', 'refund', 'return'];

const s = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim();

const stateAbbrev = (v: string): string => {
  if (!v) return '';
  if (/^[A-Z]{2}$/.test(v)) return v;
  return STATE_ABBREV[v.toLowerCase()] ?? v;
};

const countryAbbrev = (v: string): string => {
  if (!v) return '';
  if (/^[A-Z]{2}$/.test(v)) return v;
  return COUNTRY_ABBREV[v.toLowerCase()] ?? v;
};

const buildAddress = (row: Record<string, unknown>): string => {
  const recipient = s(row['Recipient']);
  const a1 = s(row['Address Line 1']);
  const a2 = s(row['Address Line 2']);
  const city = s(row['City']);
  const state = stateAbbrev(s(row['State']));
  const zip = s(row['Zipcode']);
  const country = countryAbbrev(s(row['Country']));
  const street = a2 ? `${a1} ${a2}` : a1;
  return [recipient, street, city, state, zip, country].join(', ');
};

const buildUnitId = (row: Record<string, unknown>): string => {
  const pname = s(row['Product Name']);
  const sellerSku = s(row['Seller SKU']);
  const m = pname.match(UNIT_SUFFIX_RE);
  if (!m || !sellerSku) return '';
  return `${sellerSku}${m[1].toUpperCase()}`;
};

const isCancelled = (row: Record<string, unknown>): boolean => {
  const status = s(row['Order Status']).toLowerCase();
  if (!status) return false;
  return CANCEL_STATUSES.some(k => status.includes(k));
};

const numOrEmpty = (v: unknown): number | '' => {
  const t = s(v);
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) ? n : '';
};

export function transformTikTokRows(
  rawRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  // The TikTok export has a "description" row directly under the headers
  // (each cell explains its column). Detect & drop it: the Order ID cell on
  // that row is literally "Platform unique order ID.".
  const cleaned = rawRows.filter(r => {
    const oid = s(r['Order ID']);
    if (!oid) return false;
    if (oid.toLowerCase().startsWith('platform unique')) return false;
    return true;
  });

  const out: Record<string, unknown>[] = [];
  for (const row of cleaned) {
    if (isCancelled(row)) continue;

    const orderId = s(row['Order ID']);
    if (!orderId) continue;

    out.push({
      'order id': orderId,
      'order numeric id': orderId,
      'buyer': s(row['Buyer Username']),
      'product name': s(row['Product Name']),
      'product description': '',
      'product quantity': s(row['Quantity']),
      'sold price': numOrEmpty(row['SKU Subtotal After Discount']),
      'cancelled or failed': '',
      'bundled in show': '',
      'tracking': s(row['Tracking ID']),
      'shipment id': s(row['Package ID']),
      'shipment manifest': '',
      'label only': '',
      'shipping address': buildAddress(row),
      'postal_code': s(row['Zipcode']),
      'placed at': s(row['Created Time']),
      'coupon code': '',
      'coupon price': '',
      'cost per item': '',
      'total cost': '',
      'sku': '',
      'unit id': buildUnitId(row),
      'shipping price': numOrEmpty(row['Original Shipping Fee']),
    });
  }
  return out;
}
