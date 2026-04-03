import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const app = new Hono();

const mcpServer = new McpServer({
  name: "label-quick-print",
  version: "1.0.0",
});

// 1. search_shipments
mcpServer.tool({
  name: "search_shipments",
  description: "Search shipments/orders by order ID, tracking number, buyer name, UID, or free text. Returns up to 50 matching records.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term (order ID, tracking number, buyer name, UID, or free text)" },
      show_date: { type: "string", description: "Optional show date filter (YYYY-MM-DD)" },
      printed: { type: "boolean", description: "Optional filter by printed status" },
      limit: { type: "number", description: "Max results (default 50, max 200)" },
    },
    required: ["query"],
  },
  handler: async ({ query, show_date, printed, limit }: { query: string; show_date?: string; printed?: boolean; limit?: number }) => {
    const maxLimit = Math.min(limit || 50, 200);
    const { data, error } = await supabase.rpc("search_all_shipments", {
      search_term: query,
      p_show_date: show_date || null,
      p_printed: printed ?? null,
      p_limit: maxLimit,
      p_offset: 0,
      p_include_archive: false,
    });

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// 2. get_shipment
mcpServer.tool({
  name: "get_shipment",
  description: "Get a single shipment by its UUID with all details.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Shipment UUID" },
    },
    required: ["id"],
  },
  handler: async ({ id }: { id: string }) => {
    const { data, error } = await supabase
      .from("shipments")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// 3. get_shipment_stats
mcpServer.tool({
  name: "get_shipment_stats",
  description: "Get shipment statistics (total, printed, unprinted, exceptions) for a given show date.",
  inputSchema: {
    type: "object",
    properties: {
      show_date: { type: "string", description: "Show date (YYYY-MM-DD). Omit for all dates." },
    },
  },
  handler: async ({ show_date }: { show_date?: string }) => {
    const { data, error } = await supabase.rpc("get_shipments_stats_with_archive", {
      p_show_date: show_date || null,
      p_include_archive: false,
    });

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] || data, null, 2) }],
    };
  },
});

// 4. list_customers
mcpServer.tool({
  name: "list_customers",
  description: "List or search customers by name, email, or phone number.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional search term to filter by name, email, or phone" },
      limit: { type: "number", description: "Max results (default 50, max 200)" },
    },
  },
  handler: async ({ search, limit }: { search?: string; limit?: number }) => {
    const maxLimit = Math.min(limit || 50, 200);
    let query = supabase.from("customers").select("*").limit(maxLimit).order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// 5. get_customer
mcpServer.tool({
  name: "get_customer",
  description: "Get a single customer by UUID.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Customer UUID" },
    },
    required: ["id"],
  },
  handler: async ({ id }: { id: string }) => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// 6. create_customer
mcpServer.tool({
  name: "create_customer",
  description: "Create a new customer record.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Customer name (required)" },
      phone_number: { type: "string", description: "Phone number" },
      email: { type: "string", description: "Email address" },
      notes: { type: "string", description: "Additional notes" },
    },
    required: ["name"],
  },
  handler: async ({ name, phone_number, email, notes }: { name: string; phone_number?: string; email?: string; notes?: string }) => {
    if (!name?.trim()) {
      return { content: [{ type: "text", text: "Error: name is required" }] };
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({ name: name.trim(), phone_number, email, notes })
      .select()
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// 7. update_customer
mcpServer.tool({
  name: "update_customer",
  description: "Update an existing customer's fields.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Customer UUID (required)" },
      name: { type: "string", description: "Updated name" },
      phone_number: { type: "string", description: "Updated phone number" },
      email: { type: "string", description: "Updated email" },
      notes: { type: "string", description: "Updated notes" },
    },
    required: ["id"],
  },
  handler: async ({ id, name, phone_number, email, notes }: { id: string; name?: string; phone_number?: string; email?: string; notes?: string }) => {
    const updates: Record<string, string | undefined> = {};
    if (name !== undefined) updates.name = name;
    if (phone_number !== undefined) updates.phone_number = phone_number;
    if (email !== undefined) updates.email = email;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "Error: no fields to update" }] };
    }

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

const transport = new StreamableHttpTransport();

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
