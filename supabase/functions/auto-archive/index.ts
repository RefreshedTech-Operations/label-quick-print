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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get days_to_keep from app_config, default 10
    const { data: configData } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "archive_days")
      .single();

    const daysToKeep = configData?.value ? parseInt(configData.value) : 10;

    let totalArchived = 0;
    let hasMore = true;

    // Loop through batches
    while (hasMore) {
      const { data, error } = await supabase.rpc("archive_shipments_batch", {
        days_to_keep: daysToKeep,
        batch_size: 1000,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result) break;

      totalArchived += Number(result.batch_archived);
      hasMore = result.has_more;
    }

    console.log(`Auto-archive complete: ${totalArchived} records archived (keeping ${daysToKeep} days)`);

    return new Response(
      JSON.stringify({ success: true, archived: totalArchived, days_to_keep: daysToKeep }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-archive error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
