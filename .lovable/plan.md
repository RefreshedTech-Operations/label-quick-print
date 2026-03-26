

## Make TikTok Order IDs Clickable on Orders Page

**What changes**: On the All Orders page, when a shipment's `channel` is `"tiktok"`, the order ID text will become a clickable link opening the TikTok Seller Portal in a new tab. Same pattern already used on the Scan page.

**Technical details**:

**File: `src/pages/Orders.tsx` (~line 1660)**

Replace the static order ID display:
```tsx
<div className="font-mono break-all">Order: <HighlightText text={shipment.order_id} searchTerm={debouncedSearch} /></div>
```

With a conditional link for TikTok orders:
```tsx
<div className="font-mono break-all">Order: {shipment.channel === 'tiktok' ? (
  <a
    href={`https://seller-us.tiktok.com/shipment/labels?fulfillment_global_search[]=${shipment.order_id}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary underline hover:text-primary/80"
    onClick={(e) => e.stopPropagation()}
  >
    <HighlightText text={shipment.order_id} searchTerm={debouncedSearch} />
  </a>
) : (
  <HighlightText text={shipment.order_id} searchTerm={debouncedSearch} />
)}</div>
```

One file modified, minimal change, consistent with the Scan page implementation.

