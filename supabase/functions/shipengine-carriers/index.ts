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
    // Auth check
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

    // Fallback: check app_config for user-defined key
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
      return new Response(JSON.stringify({ error: 'ShipEngine API key not configured. Add it in Settings → Shipping.' }), { status: 500, headers: corsHeaders })
    }

    // Fetch carriers from ShipEngine
    const carriersRes = await fetch('https://api.shipengine.com/v1/carriers', {
      headers: { 'API-Key': SHIPENGINE_API_KEY },
    })

    if (!carriersRes.ok) {
      const errBody = await carriersRes.text()
      console.error('ShipEngine carriers error:', errBody)
      return new Response(JSON.stringify({ error: `Failed to fetch carriers [${carriersRes.status}]` }), { status: 502, headers: corsHeaders })
    }

    const carriersData = await carriersRes.json()
    const carriers = (carriersData.carriers || []).map((c: any) => ({
      carrier_id: c.carrier_id,
      carrier_code: c.carrier_code,
      name: c.friendly_name || c.nickname || c.carrier_code,
      services: (c.services || []).map((s: any) => ({
        service_code: s.service_code,
        name: s.name,
        domestic: s.domestic,
        international: s.international,
      })),
    }))

    return new Response(JSON.stringify({ carriers }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
