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
    // Auth
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

    const SHIPENGINE_API_KEY = Deno.env.get('SHIPENGINE_API_KEY')
    if (!SHIPENGINE_API_KEY) {
      return new Response(JSON.stringify({ error: 'ShipEngine API key not configured' }), { status: 500, headers: corsHeaders })
    }

    const { shipment_id } = await req.json()
    if (!shipment_id) {
      return new Response(JSON.stringify({ error: 'shipment_id is required' }), { status: 400, headers: corsHeaders })
    }

    // Fetch shipment
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: shipment, error: fetchErr } = await serviceClient
      .from('shipments')
      .select('id, order_id, buyer, address_full, tracking, product_name, quantity')
      .eq('id', shipment_id)
      .single()

    if (fetchErr || !shipment) {
      return new Response(JSON.stringify({ error: 'Shipment not found' }), { status: 404, headers: corsHeaders })
    }

    // Parse address (basic: "street, city, state zip, country" format)
    const addressParts = (shipment.address_full || '').split(',').map((s: string) => s.trim())
    const street = addressParts[0] || ''
    const city = addressParts[1] || ''
    const stateZip = (addressParts[2] || '').split(' ')
    const state = stateZip[0] || ''
    const zip = stateZip[1] || ''
    const country = addressParts[3] || 'US'

    // Call ShipEngine to create a label
    const seResponse = await fetch('https://api.shipengine.com/v1/labels', {
      method: 'POST',
      headers: {
        'API-Key': SHIPENGINE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shipment: {
          service_code: 'usps_priority_mail',
          ship_to: {
            name: shipment.buyer || 'Customer',
            address_line1: street,
            city_locality: city,
            state_province: state,
            postal_code: zip,
            country_code: country,
          },
          ship_from: {
            // This should be configured per-account; placeholder
            name: 'Shipping Dept',
            address_line1: '123 Main St',
            city_locality: 'Austin',
            state_province: 'TX',
            postal_code: '78701',
            country_code: 'US',
          },
          packages: [{
            weight: { value: 1, unit: 'pound' },
            dimensions: { length: 10, width: 8, height: 4, unit: 'inch' },
          }],
        },
      }),
    })

    const seData = await seResponse.json()

    if (!seResponse.ok) {
      console.error('ShipEngine error:', JSON.stringify(seData))
      return new Response(
        JSON.stringify({ error: `ShipEngine API error [${seResponse.status}]: ${seData?.errors?.[0]?.message || JSON.stringify(seData)}` }),
        { status: 502, headers: corsHeaders }
      )
    }

    const labelUrl = seData.label_download?.pdf || seData.label_download?.href || ''
    const trackingNumber = seData.tracking_number || shipment.tracking

    // Update shipment with label URL and tracking
    const { error: updateErr } = await serviceClient
      .from('shipments')
      .update({
        label_url: labelUrl,
        ...(trackingNumber ? { tracking: trackingNumber } : {}),
      })
      .eq('id', shipment_id)

    if (updateErr) {
      console.error('Failed to update shipment:', updateErr)
      return new Response(JSON.stringify({ error: 'Label generated but failed to save' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      label_url: labelUrl,
      tracking_number: trackingNumber,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
