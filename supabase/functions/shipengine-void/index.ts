import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    let SHIPENGINE_API_KEY = Deno.env.get('SHIPENGINE_API_KEY')

    if (!SHIPENGINE_API_KEY) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { data: apiKeyRow } = await serviceClient
        .from('app_config')
        .select('value')
        .eq('key', 'shipping_api_key')
        .single()
      SHIPENGINE_API_KEY = apiKeyRow?.value || ''
    }

    if (!SHIPENGINE_API_KEY) {
      return new Response(JSON.stringify({ error: 'ShipEngine API key not configured' }), { status: 500, headers: corsHeaders })
    }

    const { shipment_id } = await req.json()
    if (!shipment_id) {
      return new Response(JSON.stringify({ error: 'shipment_id is required' }), { status: 400, headers: corsHeaders })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: shipment, error: fetchErr } = await serviceClient
      .from('shipments')
      .select('id, shipengine_label_id, label_url')
      .eq('id', shipment_id)
      .single()

    if (fetchErr || !shipment) {
      return new Response(JSON.stringify({ error: 'Shipment not found' }), { status: 404, headers: corsHeaders })
    }

    // Void with ShipEngine if we have a label_id
    if (shipment.shipengine_label_id) {
      const voidResponse = await fetch(
        `https://api.shipengine.com/v1/labels/${shipment.shipengine_label_id}/void`,
        {
          method: 'PUT',
          headers: { 'API-Key': SHIPENGINE_API_KEY },
        }
      )

      const voidData = await voidResponse.json()
      console.log('ShipEngine void response:', JSON.stringify(voidData))

      if (!voidResponse.ok) {
        console.error('ShipEngine void error:', JSON.stringify(voidData))
        // Still proceed to clear fields even if void fails at carrier level
      }
    }

    // Clear label_url, manifest_url, and shipengine_label_id
    const { error: updateErr } = await serviceClient
      .from('shipments')
      .update({
        label_url: null,
        manifest_url: null,
        shipengine_label_id: null,
        tracking: null,
      })
      .eq('id', shipment_id)

    if (updateErr) {
      console.error('Failed to update shipment:', updateErr)
      return new Response(JSON.stringify({ error: 'Void succeeded but failed to update shipment' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
