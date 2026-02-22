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
    // Parse form data from Twilio
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    if (!from || !body) {
      return new Response("Missing From or Body", { status: 400 });
    }

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Try to auto-match customer by phone number
    const { data: matchedCustomer } = await adminClient
      .from("customers")
      .select("id")
      .eq("phone_number", from)
      .maybeSingle();

    // Upsert conversation by phone number
    const upsertData: Record<string, unknown> = {
      phone_number: from,
      last_message_at: new Date().toISOString(),
    };
    if (matchedCustomer) {
      upsertData.customer_id = matchedCustomer.id;
    }

    const { data: conversation, error: convError } = await adminClient
      .from("sms_conversations")
      .upsert(upsertData, { onConflict: "phone_number" })
      .select("id")
      .single();

    if (convError) {
      console.error("Conversation upsert error:", convError);
      return new Response("Error processing message", { status: 500 });
    }

    // Insert inbound message
    const { error: msgError } = await adminClient
      .from("sms_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        body,
        twilio_sid: messageSid,
        status: "received",
      });

    if (msgError) {
      console.error("Message insert error:", msgError);
      return new Response("Error saving message", { status: 500 });
    }

    // Update last_message_at
    await adminClient
      .from("sms_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    // Return TwiML empty response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("twilio-webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
