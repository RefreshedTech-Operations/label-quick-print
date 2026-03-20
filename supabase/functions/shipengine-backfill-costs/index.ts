import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BATCH_SIZE = 50

type BackfillFilters = {
  showDate?: string
  minShowDate?: string
  channel?: string
}

const normalizeFilters = (payload: unknown): BackfillFilters => {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}

  const showDate = typeof body.showDate === 'string' && body.showDate ? body.showDate : undefined
  const minShowDate = !showDate && typeof body.minShowDate === 'string' && body.minShowDate ? body.minShowDate : undefined
  const channel = typeof body.channel === 'string' && body.channel ? body.channel : undefined

  return { showDate, minShowDate, channel }
}

const applyBackfillFilters = (query: any, filters: BackfillFilters) => {
  let next = query
  if (filters.showDate) next = next.eq('show_date', filters.showDate)
  else if (filters.minShowDate) next = next.gte('show_date', filters.minShowDate)
  if (filters.channel) next = next.eq('channel', filters.channel)
  return next
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const filters = normalizeFilters(requestBody)

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

    const getMissingRowsQuery = (
      table: 'shipments' | 'shipments_archive',
      columns: string,
      selectOptions?: { count?: 'exact'; head?: boolean },
    ) => {
      const query = serviceClient
        .from(table)
        .select(columns, selectOptions)
        .not('shipengine_label_id', 'is', null)
        .neq('shipengine_label_id', '')
        .is('shipping_cost', null)
      return applyBackfillFilters(query, filters)
    }

    // Find shipments missing costs (active + archive)
    const [activeRowsResult, archivedRowsResult] = await Promise.all([
      getMissingRowsQuery('shipments')
        .select('id, shipengine_label_id, created_at')
        .order('created_at', { ascending: false })
        .limit(BATCH_SIZE),
      getMissingRowsQuery('shipments_archive')
        .select('id, shipengine_label_id, created_at')
        .order('created_at', { ascending: false })
        .limit(BATCH_SIZE),
    ])

    if (activeRowsResult.error) {
      throw new Error(`Failed to fetch active shipments: ${activeRowsResult.error.message}`)
    }
    if (archivedRowsResult.error) {
      throw new Error(`Failed to fetch archived shipments: ${archivedRowsResult.error.message}`)
    }

    const allRows = [
      ...(activeRowsResult.data || []).map(r => ({ ...r, table: 'shipments' as const })),
      ...(archivedRowsResult.data || []).map(r => ({ ...r, table: 'shipments_archive' as const })),
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
        const message = e instanceof Error ? e.message : String(e)
        errors.push(`Label ${row.shipengine_label_id}: ${message}`)
      }
    }

    // Count remaining (exact when available; fallback to probe)
    const [activeRemainingResult, archivedRemainingResult] = await Promise.all([
      getMissingRowsQuery('shipments', 'id', { count: 'exact', head: true }),
      getMissingRowsQuery('shipments_archive', 'id', { count: 'exact', head: true }),
    ])

    const activeRemaining = activeRemainingResult.error ? null : (activeRemainingResult.count || 0)
    const archivedRemaining = archivedRemainingResult.error ? null : (archivedRemainingResult.count || 0)

    let remaining: number | undefined
    let hasMore = false

    if (activeRemaining != null && archivedRemaining != null) {
      remaining = activeRemaining + archivedRemaining
      hasMore = remaining > 0
    } else {
      const [activeProbe, archivedProbe] = await Promise.all([
        getMissingRowsQuery('shipments', 'id').limit(1),
        getMissingRowsQuery('shipments_archive', 'id').limit(1),
      ])
      hasMore = (activeProbe.data?.length || 0) > 0 || (archivedProbe.data?.length || 0) > 0
    }

    return new Response(JSON.stringify({
      updated,
      remaining,
      hasMore,
      errors: errors.length > 0 ? errors : undefined,
      processed: allRows.length,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Unexpected error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders })
  }
})