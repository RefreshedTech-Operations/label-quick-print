

## MCP Server for Label Quick Print

Build an MCP server as a Supabase Edge Function using `mcp-lite`, exposing tools to read shipments/orders and manage customers.

### Tools to Expose

**Shipments / Orders (read-only)**
1. `search_shipments` -- Search by order ID, tracking number, buyer name, UID, or free text. Returns matching shipment records with key fields.
2. `get_shipment` -- Get a single shipment by ID with all details.
3. `get_shipment_stats` -- Get counts (total, printed, unprinted, exceptions) for a given show date.

**Customers (read + write)**
4. `list_customers` -- List/search customers by name, email, or phone.
5. `get_customer` -- Get a single customer by ID.
6. `create_customer` -- Create a new customer record (name, phone, email, notes).
7. `update_customer` -- Update an existing customer's fields.

### Technical Approach

- **Single file**: `supabase/functions/mcp-server/index.ts`
- **Library**: `mcp-lite` (^0.10.0) with Hono for routing
- **Auth**: Uses service role key internally (the MCP server itself is the trusted caller). Add `verify_jwt = false` in config.toml since MCP clients authenticate via the MCP protocol, not Supabase JWT.
- **Database access**: Uses Supabase service client to query `shipments`, `customers`, and call existing RPC functions like `search_all_shipments`.
- **Config**: Add `[functions.mcp-server]` block to `supabase/config.toml` with `verify_jwt = false`.
- **Import map**: `deno.json` in the function directory for `mcp-lite` and `hono` dependencies.

### Files

| Action | File |
|--------|------|
| Create | `supabase/functions/mcp-server/index.ts` |
| Update | `supabase/config.toml` (add mcp-server block) |

### Implementation Details

Each tool handler will:
- Accept validated input parameters (using inline checks)
- Query the database via the Supabase JS client with the service role key
- Return structured JSON content blocks

The `search_shipments` tool will leverage the existing `search_all_shipments` RPC for full-text search capability. Customer tools will use direct table queries.

