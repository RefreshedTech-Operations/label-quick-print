

# Shipping Labels Page with ShipEngine Integration

## Summary
New "Shipping Labels" page showing all shipments where `label_url` is empty. Includes a ShipEngine edge function to generate labels on demand.

## Changes

### 1. New page: `src/pages/ShippingLabels.tsx`
- Query shipments where `label_url IS NULL OR label_url = ''`
- Show date filter, search, pagination (following existing Orders page patterns)
- Table: Order ID, UID, Buyer, Product, Address, Actions
- "Generate Label" button per row and bulk selection
- On label generation success, updates the shipment's `label_url`

### 2. Route & Navigation
- Add `/shipping-labels` route in `App.tsx` wrapped in Layout
- Add "Shipping Labels" nav item in `Layout.tsx` under Operations group (using `Truck` icon from lucide)

### 3. Edge function: `supabase/functions/shipengine-proxy/index.ts`
- Accepts shipment address/weight data, calls ShipEngine's `/v1/labels` endpoint
- Returns label PDF URL
- Requires `SHIPENGINE_API_KEY` secret (will request from user)
- CORS headers, JWT auth validation

### 4. Secret
- Request `SHIPENGINE_API_KEY` from the user before wiring up label generation

## Implementation Order
1. Create the page with missing-labels query (viewable immediately)
2. Add route and nav item
3. Request ShipEngine API key
4. Create edge function
5. Connect generate button to edge function

