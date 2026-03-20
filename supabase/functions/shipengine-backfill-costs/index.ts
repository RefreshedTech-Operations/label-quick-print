import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BATCH_SIZE = 50

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

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // Get ShipEngine API key
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let SHIPENGINE_API_KEY = Deno.env.get('SHIPENGINE_API_KEY')
    if (!SHIPENGINE_API_KEY) {
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

    // Find shipments missing costs (active table)
    const { data: activeRows } = await serviceClient
      .from('shipments')
      .select('id, shipengine_label_id')
      .not('shipengine_label_id', 'is', null)
      .is('shipping_cost', null)
      .limit(BATCH_SIZE)

    // Find archived shipments missing costs
    const { data: archivedRows } = await serviceClient
      .from('shipments_archive')
      .select('id, shipengine_label_id')
      .not('shipengine_label_id', 'is', null)
      .is('shipping_cost', null)
      .limit(BATCH_SIZE)

    const allRows = [
      ...(activeRows || []).map(r => ({ ...r, table: 'shipments' as const })),
      ...(archivedRows || []).map(r => ({ ...r, table: 'shipments_archive' as const })),
    ].slice(0, BATCH_SIZE)

    let updated = 0
    const errors: string[] = []

    for (const row of allRows) {
      try {
        const res = await fetch(`https://api.shipengine.com/v1/labels/${row.shipengine_label_id}`, {
          headers: { 'API-Key': SHIPENGINE_API_KEY },
        })

        if (!res.ok) {
          errors.push(`Label ${row.shipengine_label_id}: HTTP ${res.status}`)
          continue
        }

        const labelData = await res.json()
        const cost = labelData?.shipment_cost?.amount

        if (cost != null && Number.isFinite(Number(cost))) {
          const { error: updateErr } = await serviceClient
            .from(row.table)
            .update({ shipping_cost: Number(cost) })
            .eq('id', row.id)

          if (updateErr) {
            errors.push(`Update ${row.id}: ${updateErr.message}`)
          } else {
            updated++
          }
        } else {
          errors.push(`Label ${row.shipengine_label_id}: no cost in response`)
        }
      } catch (e) {
        errors.push(`Label ${row.shipengine_label_id}: ${e.message}`)
      }
    }

    // Count remaining
    const { count: activeRemaining } = await serviceClient
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .not('shipengine_label_id', 'is', null)
      .is('shipping_cost', null)

    const { count: archivedRemaining } = await serviceClient
      .from('shipments_archive')
      .select('id', { count: 'exact', head: true })
      .not('shipengine_label_id', 'is', null)
      .is('shipping_cost', null)

    const remaining = (activeRemaining || 0) + (archivedRemaining || 0)

    return new Response(JSON.stringify({
      updated,
      remaining,
      errors: errors.length > 0 ? errors : undefined,
      processed: allRows.length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
