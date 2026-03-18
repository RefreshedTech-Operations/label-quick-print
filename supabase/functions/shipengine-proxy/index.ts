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

    // Load shipping config from app_config
    const { data: configRows } = await serviceClient
      .from('app_config')
      .select('key, value')
      .like('key', 'shipping_%')

    const cfg: Record<string, string> = {}
    for (const row of configRows || []) {
      cfg[row.key.replace('shipping_', '')] = row.value || ''
    }

    const serviceCode = cfg.service_code || 'usps_priority_mail'
    const weightOz = parseFloat(cfg.weight_oz || '16')
    const lengthIn = parseFloat(cfg.length_in || '10')
    const widthIn = parseFloat(cfg.width_in || '8')
    const heightIn = parseFloat(cfg.height_in || '4')

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
          service_code: serviceCode,
          ship_to: {
            name: shipment.buyer || 'Customer',
            address_line1: street,
            city_locality: city,
            state_province: state,
            postal_code: zip,
            country_code: country,
          },
          ship_from: {
            name: cfg.ship_from_name || 'Shipping Dept',
            address_line1: cfg.ship_from_address || '123 Main St',
            city_locality: cfg.ship_from_city || 'Austin',
            state_province: cfg.ship_from_state || 'TX',
            postal_code: cfg.ship_from_zip || '78701',
            country_code: cfg.ship_from_country || 'US',
          },
          packages: [{
            weight: { value: weightOz, unit: 'ounce' },
            dimensions: { length: lengthIn, width: widthIn, height: heightIn, unit: 'inch' },
          }],
        },
      }),
    })

    const seData = await seResponse.json()

    if (!seResponse.ok) {
      console.error('ShipEngine error:', JSON.stringify(seData))
      const errors = seData?.errors || []
      const errorMessages = errors.map((e: any) => e.message).filter(Boolean)
      const errorDetail = errorMessages.length > 0 ? errorMessages.join(' | ') : JSON.stringify(seData)
      return new Response(
        JSON.stringify({ 
          error: `ShipEngine API error [${seResponse.status}]: ${errorDetail}`,
          errors: errors.map((e: any) => ({
            message: e.message,
            field: e.field_name,
            code: e.error_code,
            type: e.error_type,
          })),
        }),
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
