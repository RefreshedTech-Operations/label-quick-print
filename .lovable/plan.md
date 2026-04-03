## Build Retell AI Order Lookup Endpoint

**What**: Create a new edge function (`retell-order-lookup`) that Retell AI can call as a Custom Function to look up orders by order number, returning full details + tracking.

### How Retell Custom Functions Work
Retell sends a POST request with a JSON body containing the function arguments. We return a JSON response with the result.

### Changes

**`supabase/functions/retell-order-lookup/index.ts`** (new file):
- Accept POST with `{ order_id: string }` from Retell
- Authenticate using `MCP_API_KEY` via Bearer token (same key already configured)
- Search shipments using the existing `search_all_shipments` RPC
- Return full order details: status, tracking, buyer, product, quantity, price, address, shipping cost, printed status
- Include CORS headers for flexibility
- Handle not-found gracefully with a friendly message the voice agent can read

**`supabase/config.toml`**:
- Add `[functions.retell-order-lookup]` with `verify_jwt = false`

| File | Change |
|------|--------|
| `supabase/functions/retell-order-lookup/index.ts` | New edge function for Retell AI order lookup |
| `supabase/config.toml` | Add function config |

### Retell Dashboard Setup
After deployment, in Retell you'd create a Custom Function tool pointing to:
`POST https://yzpbiwexbppkmzpgorcd.supabase.co/functions/v1/retell-order-lookup`
with header `Authorization: Bearer <MCP_API_KEY>`
