import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check messaging role
    const { data: hasRole } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "messaging",
    });

    if (!hasRole) {
      return new Response(
        JSON.stringify({ error: "Messaging role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { to, body, customer_id } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'body'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send SMS via Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Twilio error",
          details: twilioData.message || twilioData,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to upsert conversation and insert message
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Upsert conversation
    const { data: conversation, error: convError } = await adminClient
      .from("sms_conversations")
      .upsert(
        {
          phone_number: to,
          last_message_at: new Date().toISOString(),
          ...(customer_id ? { customer_id } : {}),
        },
        { onConflict: "phone_number" }
      )
      .select("id")
      .single();

    if (convError) {
      console.error("Conversation upsert error:", convError);
      // Still return success since SMS was sent
      return new Response(
        JSON.stringify({
          success: true,
          sid: twilioData.sid,
          warning: "SMS sent but conversation record failed",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert message record
    await adminClient.from("sms_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body,
      twilio_sid: twilioData.sid,
      status: "sent",
      sent_by_user_id: userId,
    });

    // Update last_message_at
    await adminClient
      .from("sms_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid, conversation_id: conversation.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-sms error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
