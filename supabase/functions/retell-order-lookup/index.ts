import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const MCP_API_KEY = Deno.env.get("MCP_API_KEY");
  if (!MCP_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Server not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== MCP_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const orderId = (body.order_id || body.order_number || "").toString().trim();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Direct indexed query instead of heavy search_all_shipments RPC
    const { data: liveData, error: liveErr } = await supabase
      .from("shipments")
      .select("order_id, uid, buyer, product_name, quantity, price, tracking, shipping_cost, address_full, printed, printed_at, show_date, cancelled, label_url")
      .eq("order_id", orderId)
      .limit(10);

    if (liveErr) {
      return new Response(
        JSON.stringify({ error: liveErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not found in live, check archive
    let results = liveData || [];
    let fromArchive = false;

    if (results.length === 0) {
      const { data: archiveData, error: archiveErr } = await supabase
        .from("shipments_archive")
        .select("order_id, uid, buyer, product_name, quantity, price, tracking, shipping_cost, address_full, printed, printed_at, show_date, cancelled, label_url")
        .eq("order_id", orderId)
        .limit(10);

      if (!archiveErr && archiveData && archiveData.length > 0) {
        results = archiveData;
        fromArchive = true;
      }
    }

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          found: false,
          message: `No orders found matching "${orderId}".`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orders = results.map((s: any) => ({
      order_id: s.order_id,
      uid: s.uid,
      buyer: s.buyer,
      product_name: s.product_name,
      quantity: s.quantity,
      price: s.price,
      tracking_number: s.tracking || null,
      shipping_cost: s.shipping_cost,
      address: s.address_full,
      status: s.printed ? "printed" : "not yet printed",
      printed_at: s.printed_at || null,
      show_date: s.show_date,
      is_archived: fromArchive,
      is_cancelled: !!s.cancelled,
    }));

    return new Response(
      JSON.stringify({
        found: true,
        count: orders.length,
        orders,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
