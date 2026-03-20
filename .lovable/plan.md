

## Plan: Backfill Shipping Costs for Existing Labels

### What This Does
Creates a one-time backend function that finds all shipments with a ShipEngine label but no shipping cost, fetches the cost from ShipEngine's API, and updates the database.

### Approach
Create a new edge function `shipengine-backfill-costs` that:

1. Queries `shipments` for rows where `shipengine_label_id IS NOT NULL` and `shipping_cost IS NULL`
2. Also queries `shipments_archive` for the same condition
3. For each label, calls `GET https://api.shipengine.com/v1/labels/{label_id}` to retrieve the `shipment_cost.amount`
4. Updates each row with the cost
5. Processes in batches to avoid timeouts, with a configurable batch size
6. Returns a summary of how many were updated

The function will be callable from the frontend — add a button in the Shipping Labels page (or Settings) to trigger the backfill, with progress feedback.

### Files
- **Create**: `supabase/functions/shipengine-backfill-costs/index.ts` — edge function that fetches costs from ShipEngine and updates the database
- **Modify**: `src/pages/ShippingLabels.tsx` — add a "Backfill Costs" button (in the Generated tab toolbar area) that calls the function and shows progress/results via a toast

### Technical Detail
- ShipEngine's `GET /v1/labels/{label_id}` returns `shipment_cost: { currency, amount }` which gives us the label cost
- Process up to 50 labels per invocation to stay within edge function time limits
- The function returns `{ updated, remaining, errors }` so the frontend can call it repeatedly if needed
- Uses the service role client to update both `shipments` and `shipments_archive` tables

