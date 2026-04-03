import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  us: 'US',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  ca: 'CA',
  canada: 'CA',
  mx: 'MX',
  mexico: 'MX',
  gb: 'GB',
  uk: 'GB',
  'united kingdom': 'GB',
}

const normalizeCountryCode = (raw?: string | null) => {
  const value = (raw || '').trim().toLowerCase()
  if (!value) return 'US'
  return COUNTRY_CODE_MAP[value] || value.toUpperCase()
}

const parseCurrencyAmount = (raw?: string | null) => {
  const numeric = Number.parseFloat(String(raw || '').replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(numeric) || numeric <= 0) return 1
  return Number(numeric.toFixed(2))
}

const US_STATE_MAP: Record<string, string> = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',
  connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',hawaii:'HI',idaho:'ID',
  illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',louisiana:'LA',
  maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',
  mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV',
  'new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY',
  'north carolina':'NC','north dakota':'ND',ohio:'OH',oklahoma:'OK',oregon:'OR',
  pennsylvania:'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',
  tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',washington:'WA',
  'west virginia':'WV',wisconsin:'WI',wyoming:'WY',
  'district of columbia':'DC','puerto rico':'PR',guam:'GU',
}

const normalizeState = (raw: string, countryCode: string) => {
  const trimmed = raw.trim()
  if (countryCode === 'US') {
    if (trimmed.length === 2) return trimmed.toUpperCase()
    const mapped = US_STATE_MAP[trimmed.toLowerCase()]
    if (mapped) return mapped
  }
  return trimmed
}

// Detect if a string looks like a US zip code
const looksLikeZip = (s: string) => /^\d{5}(-\d{4})?$/.test(s.trim())

// Detect if a string is a known US state name or 2-letter code
const looksLikeUSState = (s: string) => {
  const t = s.trim()
  if (t.length === 2 && /^[A-Z]{2}$/i.test(t)) return true
  return US_STATE_MAP[t.toLowerCase()] !== undefined
}

// Fix scrambled city/state/zip fields for US addresses
const fixScrambledFields = (city: string, state: string, zip: string, countryCode: string) => {
  if (countryCode !== 'US') return { city, state, zip }
  
  const fields = [city, state, zip]
  let fixedCity = city, fixedState = state, fixedZip = zip
  
  // Find which field is actually the zip (digits)
  const zipIdx = fields.findIndex(f => looksLikeZip(f))
  // Find which field is actually the state
  const stateIdx = fields.findIndex((f, i) => i !== zipIdx && looksLikeUSState(f))
  // The remaining one is the city
  const cityIdx = fields.findIndex((_, i) => i !== zipIdx && i !== stateIdx)
  
  if (zipIdx !== -1) fixedZip = fields[zipIdx]
  if (stateIdx !== -1) fixedState = fields[stateIdx]
  if (cityIdx !== -1) fixedCity = fields[cityIdx]
  
  // Only apply fix if we found at least the zip in the wrong position
  if (zipIdx !== -1 && zipIdx !== 2) {
    return { city: fixedCity, state: fixedState, zip: fixedZip }
  }
  // Or if state is a full name in the wrong position
  if (stateIdx !== -1 && stateIdx !== 1) {
    return { city: fixedCity, state: fixedState, zip: fixedZip }
  }
  
  return { city, state, zip }
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
      return new Response(JSON.stringify({ error: 'ShipEngine API key not configured' }), { status: 500, headers: corsHeaders })
    }

    const { shipment_id, override_carrier_id, override_service_code, skip_validation } = await req.json()
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
      .select('id, order_id, buyer, address_full, tracking, product_name, quantity, price')
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

    const carrierId = override_carrier_id || cfg.carrier || ''
    const serviceCode = override_service_code || cfg.service_code || 'usps_priority_mail'
    const weightOz = parseFloat(cfg.weight_oz || '16')
    const lengthIn = parseFloat(cfg.length_in || '10')
    const widthIn = parseFloat(cfg.width_in || '8')
    const heightIn = parseFloat(cfg.height_in || '4')

    // Parse address: comma-separated parts
    // Supported formats:
    //   7 parts: Name, Street1, Street2, City, State, Zip, Country
    //   6 parts: Name, Street1, City, State, Zip, Country  OR  Name, Street1, Street2, City, State, Zip
    //   5 parts: Name, Street1, City, State, Zip
    //   4 parts: Street, City, State Zip, Country (legacy)
    const addressParts = (shipment.address_full || '').split(',').map((s: string) => s.trim())
    let recipientName: string, street1: string, street2: string, city: string, state: string, zip: string, countryRaw: string

    if (addressParts.length >= 7) {
      // Name, Street1, Street2, City, State, Zip, Country
      recipientName = addressParts[0] || ''
      street1 = addressParts[1] || ''
      street2 = addressParts[2] || ''
      city = addressParts[3] || ''
      state = addressParts[4] || ''
      zip = addressParts[5] || ''
      countryRaw = addressParts[6] || 'US'
    } else if (addressParts.length === 6) {
      // Could be: Name, Street1, City, State, Zip, Country
      // Or: Name, Street1, Street2, City, State, Zip
      // Heuristic: if part[5] looks like a country code (2-3 chars or known name), treat as no street2
      const lastPart = addressParts[5].toLowerCase()
      const looksLikeCountry = lastPart.length <= 3 || COUNTRY_CODE_MAP[lastPart] !== undefined
      if (looksLikeCountry) {
        recipientName = addressParts[0] || ''
        street1 = addressParts[1] || ''
        street2 = ''
        city = addressParts[2] || ''
        state = addressParts[3] || ''
        zip = addressParts[4] || ''
        countryRaw = addressParts[5] || 'US'
      } else {
        // Name, Street1, Street2, City, State, Zip (no country)
        recipientName = addressParts[0] || ''
        street1 = addressParts[1] || ''
        street2 = addressParts[2] || ''
        city = addressParts[3] || ''
        state = addressParts[4] || ''
        zip = addressParts[5] || ''
        countryRaw = 'US'
      }
    } else if (addressParts.length === 5) {
      // Name, Street1, City, State, Zip (no country)
      recipientName = addressParts[0] || ''
      street1 = addressParts[1] || ''
      street2 = ''
      city = addressParts[2] || ''
      state = addressParts[3] || ''
      zip = addressParts[4] || ''
      countryRaw = 'US'
    } else {
      // Legacy format: Street, City, State Zip, Country
      recipientName = ''
      street1 = addressParts[0] || ''
      street2 = ''
      city = addressParts[1] || ''
      const stateZip = (addressParts[2] || '').split(' ')
      state = stateZip[0] || ''
      zip = stateZip[1] || ''
      countryRaw = addressParts[3] || 'US'
    }

    const destinationCountryCode = normalizeCountryCode(countryRaw)
    const originCountryCode = normalizeCountryCode(cfg.ship_from_country || 'US')
    const isInternational = destinationCountryCode !== originCountryCode

    // Fix scrambled city/state/zip fields
    const fixed = fixScrambledFields(city, state, zip, destinationCountryCode)
    city = fixed.city
    state = fixed.state
    zip = fixed.zip

    const quantity = typeof shipment.quantity === 'number' && shipment.quantity > 0 ? shipment.quantity : 1
    const itemDescription = String(shipment.product_name || 'Merchandise').slice(0, 100)
    const itemValue = parseCurrencyAmount(shipment.price)

    const shipToAddress: Record<string, unknown> = {
      name: recipientName || shipment.buyer || 'Customer',
      address_line1: street1,
      ...(street2 ? { address_line2: street2 } : {}),
      city_locality: city,
      state_province: normalizeState(state, destinationCountryCode),
      postal_code: zip,
      country_code: destinationCountryCode,
      phone: cfg.ship_from_phone || undefined,
    }

    // --- Address Validation Step ---
    let validationWarnings: string[] = []

    if (!skip_validation) {
      const valPayload = [{
        address_line1: shipToAddress.address_line1,
        ...(shipToAddress.address_line2 ? { address_line2: shipToAddress.address_line2 } : {}),
        city_locality: shipToAddress.city_locality,
        state_province: shipToAddress.state_province,
        postal_code: shipToAddress.postal_code,
        country_code: shipToAddress.country_code,
      }]

      console.log('Validating address:', JSON.stringify(valPayload))

      const valResponse = await fetch('https://api.shipengine.com/v1/addresses/validate', {
        method: 'POST',
        headers: {
          'API-Key': SHIPENGINE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(valPayload),
      })

      const valData = await valResponse.json()
      const valResult = valData?.[0]

      if (valResult) {
        const valStatus = valResult.status
        const valMessages = (valResult.messages || []).map((m: any) => m.message).filter(Boolean)

        if (valStatus === 'error' || valStatus === 'unverified') {
          console.warn('Address validation failed:', JSON.stringify(valResult))
          return new Response(JSON.stringify({
            error: `Address Validation Error: ${valMessages.join(', ') || 'Address not found'}`,
            validation_status: valStatus,
            messages: valMessages,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Use corrected address from ShipEngine if available
        const matched = valResult.matched_address
        if (matched) {
          shipToAddress.address_line1 = matched.address_line1 || shipToAddress.address_line1
          if (matched.address_line2) shipToAddress.address_line2 = matched.address_line2
          shipToAddress.city_locality = matched.city_locality || shipToAddress.city_locality
          shipToAddress.state_province = matched.state_province || shipToAddress.state_province
          shipToAddress.postal_code = matched.postal_code || shipToAddress.postal_code
          shipToAddress.country_code = matched.country_code || shipToAddress.country_code
        }

        if (valStatus === 'warning') {
          console.warn('Address validation warnings:', valMessages.join(' | '))
          validationWarnings = valMessages
        }
      }
    }
    // --- End Address Validation ---

    // --- PO Box Detection: auto-switch to USPS if using UPS/FedEx ---
    const addressText = `${shipToAddress.address_line1 || ''} ${shipToAddress.address_line2 || ''}`.toLowerCase()
    const isPOBox = /\b(p\.?\s*o\.?\s*box|post\s*office\s*box)\b/i.test(addressText)
    let actualCarrierId = carrierId
    let actualServiceCode = serviceCode

    if (isPOBox) {
      const carrierLower = (carrierId || '').toLowerCase() + (serviceCode || '').toLowerCase()
      const isNonUSPS = carrierLower.includes('ups') || carrierLower.includes('fedex') || carrierLower.includes('dhl')
      if (isNonUSPS) {
        console.warn('PO Box detected with non-USPS carrier, falling back to USPS Priority Mail')
        // Clear carrier_id so ShipEngine uses the service_code to find the right carrier
        actualCarrierId = ''
        actualServiceCode = 'usps_ground_advantage'
      }
    }

    const shipmentPayload: Record<string, unknown> = {
      ...(actualCarrierId ? { carrier_id: actualCarrierId } : {}),
      service_code: actualServiceCode,
      ship_to: shipToAddress,
      ship_from: {
        name: cfg.ship_from_name || 'Shipping Dept',
        address_line1: cfg.ship_from_address || '123 Main St',
        city_locality: cfg.ship_from_city || 'Austin',
        state_province: normalizeState(cfg.ship_from_state || 'TX', originCountryCode),
        postal_code: cfg.ship_from_zip || '78701',
        country_code: originCountryCode,
        phone: cfg.ship_from_phone || undefined,
      },
      packages: [{
        weight: { value: weightOz, unit: 'ounce' },
        dimensions: { length: lengthIn, width: widthIn, height: heightIn, unit: 'inch' },
      }],
    }

    if (isInternational) {
      shipmentPayload.customs = {
        contents: 'merchandise',
        non_delivery: 'return_to_sender',
        customs_items: [
          {
            description: itemDescription,
            quantity,
            value: {
              amount: itemValue,
              currency: 'usd',
            },
            country_of_origin: originCountryCode,
          },
        ],
      }
    }

    // Log the full payload for debugging
    console.log('ShipEngine request payload:', JSON.stringify({ shipment: shipmentPayload }, null, 2))

    // Call ShipEngine to create a label
    const seResponse = await fetch('https://api.shipengine.com/v1/labels', {
      method: 'POST',
      headers: {
        'API-Key': SHIPENGINE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shipment: shipmentPayload }),
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
    const shipEngineLabelId = seData.label_id || ''
    const shippingProvider = seData.carrier_code || seData.carrier_id || carrierId || ''
    const shippingCost = seData.shipment_cost?.amount ?? null

    // Update shipment with label URL, manifest, tracking, ShipEngine label ID, shipping provider, and cost
    const { error: updateErr } = await serviceClient
      .from('shipments')
      .update({
        label_url: labelUrl,
        manifest_url: labelUrl,
        shipengine_label_id: shipEngineLabelId,
        shipping_provider: shippingProvider,
        ...(trackingNumber ? { tracking: trackingNumber } : {}),
        ...(shippingCost !== null ? { shipping_cost: shippingCost } : {}),
      })
      .eq('id', shipment_id)

    if (updateErr) {
      console.error('Failed to update shipment:', updateErr)
      return new Response(JSON.stringify({ error: 'Label generated but failed to save' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      label_url: labelUrl,
      tracking_number: trackingNumber,
      shipengine_label_id: shipEngineLabelId,
      ...(validationWarnings.length > 0 ? { validation_warnings: validationWarnings } : {}),
      ...(isPOBox ? { po_box_fallback: true } : {}),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
