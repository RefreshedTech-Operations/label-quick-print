

## Add ShipEngine Label Lookup Tab

Add a third tab "Label Lookup" to the Shipping Labels page that searches the ShipEngine API directly by tracking number or order number.

### Steps

**1. Create Edge Function `shipengine-label-lookup`**

New edge function that accepts a `query` string and `search_type` ("tracking" or "order_id"):
- Authenticates the user (manual session validation)
- Loads the ShipEngine API key (env var → `app_config` fallback)
- Calls ShipEngine's `GET /v1/labels?tracking_number={query}` or `GET /v1/labels?order_id={query}` endpoint (ShipEngine REST API supports these query params)
- Returns the array of matching labels with: `label_id`, `tracking_number`, `label_download.pdf`, `status`, `carrier_code`, `service_code`, `ship_date`, `shipment_cost`, `ship_to` address, `voided`

**2. Add "Label Lookup" tab to `ShippingLabels.tsx`**

- New `TabsTrigger` with `value="lookup"` and a Search icon
- New `LabelLookupTab` component with:
  - Search input + dropdown to choose "Tracking Number" or "Order ID"
  - Search button (no auto-search — explicit submit)
  - Results table showing: Label ID, Tracking #, Status, Carrier/Service, Ship Date, Cost, Recipient, and a link to download the label PDF (via existing `shipengine-label-download` proxy)
  - Loading state and empty/error states
  - Badge for voided labels

### Technical Details

- Edge function path: `supabase/functions/shipengine-label-lookup/index.ts`
- ShipEngine list labels endpoint: `GET https://api.shipengine.com/v1/labels` with query params `tracking_number` or a shipment search
- For order-based search: ShipEngine doesn't natively support order_id on the labels endpoint, so we'll search shipments first via `GET /v1/shipments?order_number={query}` then fetch labels for matched shipments — OR simply search our local DB for the `shipengine_label_id` and then fetch that label's details from ShipEngine via `GET /v1/labels/{label_id}`
- Reuses existing auth pattern and CORS headers from other edge functions
- Label PDF download reuses the existing `shipengine-label-download` proxy

