

## Fix Export: Format ID Columns as Text + Add Shipping Cost Column

**What changes**: Ensure UID, Order ID, and Tracking columns export as text (preventing Excel from interpreting them as numbers/scientific notation), and add a "Shipping Cost" column.

### Steps

**1. Update export mappings** (`src/lib/analyticsExport.ts`)

In both `exportFilteredOrders` and `exportOrders`:
- Prefix UID, Order ID, and Tracking values with a tab character (`"\t"`) or single quote (`'`) to force Excel to treat them as text — OR use PapaParse's quoting to wrap them
- Add `'Shipping Cost': shipment.shipping_cost != null ? shipment.shipping_cost : '-'` after the Price column

**2. Update Shipment type** (`src/types/index.ts`)
- Add `shipping_cost?: number | null` to the `Shipment` interface

### Technical details
- The simplest reliable approach: prefix values with `="\t"` won't work in all cases. Instead, prefix with a leading single quote or use `\t` prefix — but the most robust CSV approach is to prepend `\t` to the value so Excel treats it as text
- Actually the cleanest approach: wrap values like `="VALUE"` in the CSV output — this is Excel's formula-based text forcing. We'll map: `'UID': '="' + (shipment.uid || '-') + '"'`
- This affects UID, Order ID, and Tracking columns only
- `shipping_cost` already exists on the `shipments` DB table as `numeric`

