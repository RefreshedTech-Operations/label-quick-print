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
mcpServer.tool("search_shipments", {
  description: "Search shipments/orders by order ID, tracking number, buyer name, UID, or free text. Returns up to 50 matching records.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "Search term" },
      show_date: { type: "string" as const, description: "Optional show date filter (YYYY-MM-DD)" },
      printed: { type: "boolean" as const, description: "Optional filter by printed status" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
    },
    required: ["query"] as const,
  },
  handler: async (args: Record<string, unknown>) => {
    const query = args.query as string;
    const show_date = args.show_date as string | undefined;
    const printed = args.printed as boolean | undefined;
    const limit = args.limit as number | undefined;
    const maxLimit = Math.min(limit || 50, 200);

    const { data, error } = await supabase.rpc("search_all_shipments", {
      search_term: query,
      p_show_date: show_date || null,
      p_printed: printed ?? null,
      p_limit: maxLimit,
      p_offset: 0,
      p_include_archive: false,
    });

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// 2. get_shipment
mcpServer.tool("get_shipment", {
  description: "Get a single shipment by its UUID with all details.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "Shipment UUID" },
    },
    required: ["id"] as const,
  },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.from("shipments").select("*").eq("id", args.id as string).single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// 3. get_shipment_stats
mcpServer.tool("get_shipment_stats", {
  description: "Get shipment statistics (total, printed, unprinted, exceptions) for a given show date.",
  inputSchema: {
    type: "object" as const,
    properties: {
      show_date: { type: "string" as const, description: "Show date (YYYY-MM-DD). Omit for all dates." },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc("get_shipments_stats_with_archive", {
      search_term: "",
      p_show_date: (args.show_date as string) || null,
      p_printed: null,
      p_filter: null,
      p_include_archive: false,
      p_channel: null,
      p_strict: false,
    });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data?.[0] || data, null, 2) }] };
  },
});

// 4. list_customers
mcpServer.tool("list_customers", {
  description: "List or search customers by name, email, or phone number.",
  inputSchema: {
    type: "object" as const,
    properties: {
      search: { type: "string" as const, description: "Optional search term to filter by name, email, or phone" },
      limit: { type: "number" as const, description: "Max results (default 50, max 200)" },
    },
  },
  handler: async (args: Record<string, unknown>) => {
    const search = args.search as string | undefined;
    const maxLimit = Math.min((args.limit as number) || 50, 200);
    let query = supabase.from("customers").select("*").limit(maxLimit).order("created_at", { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// 5. get_customer
mcpServer.tool("get_customer", {
  description: "Get a single customer by UUID.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "Customer UUID" },
    },
    required: ["id"] as const,
  },
  handler: async (args: Record<string, unknown>) => {
    const { data, error } = await supabase.from("customers").select("*").eq("id", args.id as string).single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// 6. create_customer
mcpServer.tool("create_customer", {
  description: "Create a new customer record.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, description: "Customer name (required)" },
      phone_number: { type: "string" as const, description: "Phone number" },
      email: { type: "string" as const, description: "Email address" },
      notes: { type: "string" as const, description: "Additional notes" },
    },
    required: ["name"] as const,
  },
  handler: async (args: Record<string, unknown>) => {
    const name = (args.name as string)?.trim();
    if (!name) return { content: [{ type: "text" as const, text: "Error: name is required" }] };
    const { data, error } = await supabase.from("customers").insert({
      name,
      phone_number: args.phone_number as string | undefined,
      email: args.email as string | undefined,
      notes: args.notes as string | undefined,
    }).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// 7. update_customer
mcpServer.tool("update_customer", {
  description: "Update an existing customer's fields.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "Customer UUID (required)" },
      name: { type: "string" as const, description: "Updated name" },
      phone_number: { type: "string" as const, description: "Updated phone number" },
      email: { type: "string" as const, description: "Updated email" },
      notes: { type: "string" as const, description: "Updated notes" },
    },
    required: ["id"] as const,
  },
  handler: async (args: Record<string, unknown>) => {
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.phone_number !== undefined) updates.phone_number = args.phone_number;
    if (args.email !== undefined) updates.email = args.email;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (Object.keys(updates).length === 0) return { content: [{ type: "text" as const, text: "Error: no fields to update" }] };

    const { data, error } = await supabase.from("customers").update(updates).eq("id", args.id as string).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

const transport = new StreamableHttpTransport();
const handler = transport.bind(mcpServer);

app.all("/*", (c) => handler(c.req.raw));

Deno.serve(app.fetch);
