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
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const query = url.searchParams.get('query')?.trim()
    const searchType = url.searchParams.get('search_type') || 'tracking'

    if (!query) {
      return new Response(JSON.stringify({ error: 'query parameter is required' }), { status: 400, headers: corsHeaders })
    }

    let SHIPENGINE_API_KEY = Deno.env.get('SHIPENGINE_API_KEY')
    if (!SHIPENGINE_API_KEY) {
      const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: apiKeyRow } = await serviceClient.from('app_config').select('value').eq('key', 'shipping_api_key').single()
      SHIPENGINE_API_KEY = apiKeyRow?.value || ''
    }

    if (!SHIPENGINE_API_KEY) {
      return new Response(JSON.stringify({ error: 'ShipEngine API key not configured' }), { status: 500, headers: corsHeaders })
    }

    const seHeaders = {
      'API-Key': SHIPENGINE_API_KEY,
      'Content-Type': 'application/json',
    }

    let labels: any[] = []

    if (searchType === 'tracking') {
      // Search labels by tracking number
      const res = await fetch(`https://api.shipengine.com/v1/labels?tracking_number=${encodeURIComponent(query)}&page_size=25`, {
        headers: seHeaders,
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('ShipEngine labels search error:', errText)
        return new Response(JSON.stringify({ error: `ShipEngine API error: ${res.status}` }), { status: 502, headers: corsHeaders })
      }
      const data = await res.json()
      labels = data.labels || []
    } else {
      // Search by order ID: look up shipengine_label_id from our DB first
      const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: shipments } = await serviceClient
        .from('shipments')
        .select('shipengine_label_id')
        .ilike('order_id', `%${query}%`)
        .not('shipengine_label_id', 'is', null)
        .limit(25)

      const labelIds = (shipments || []).map(s => s.shipengine_label_id).filter(Boolean) as string[]

      if (labelIds.length === 0) {
        return new Response(JSON.stringify({ labels: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Fetch each label from ShipEngine
      const results = await Promise.allSettled(
        labelIds.map(async (labelId) => {
          const res = await fetch(`https://api.shipengine.com/v1/labels/${labelId}`, { headers: seHeaders })
          if (!res.ok) { await res.text(); return null }
          return await res.json()
        })
      )
      labels = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value != null)
        .map(r => r.value)
    }

    return new Response(JSON.stringify({ labels }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
