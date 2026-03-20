

## Plan: Add ShipEngine Address Validation Before Label Generation

### What This Solves
Currently, invalid addresses (like mismatched zip/state combos) are only caught when ShipEngine rejects the label request, wasting an API call and returning cryptic carrier errors. Adding a validation step catches these issues early with clear, actionable messages.

### Approach
Add address validation directly into the `shipengine-proxy` Edge Function, right after address parsing and before label creation. This keeps the change server-side with no frontend modifications needed — errors will surface through the existing error display (clickable error icons with popovers).

### Changes

**1. `supabase/functions/shipengine-proxy/index.ts`**

After the `shipToAddress` object is built (around line 267) and before the label creation call (line 309), insert a call to ShipEngine's address validation API:

```
POST https://api.shipengine.com/v1/addresses/validate
```

- Send the parsed `ship_to` address to ShipEngine's validation endpoint
- Check the response status: `verified`, `warning`, or `error`
- If `error`: return a 400 response with the specific validation messages (e.g., "Invalid postal code for state NV") — no label is created
- If `warning`: log the warnings but proceed, and use the corrected/matched address from ShipEngine's response if available
- If `verified`: use the validated address (ShipEngine may correct formatting) and proceed to label creation

This means scrambled fields like the IA/NV/50201 case will be caught before hitting the carrier, with a clear message like "The postal code 50201 does not match the state NV."

### Technical Detail

The validation call payload format:
```json
[{
  "address_line1": "710 S 11th St B120",
  "city_locality": "IA",
  "state_province": "NV",
  "postal_code": "50201",
  "country_code": "US"
}]
```

Response includes a `status` field (`verified`/`unverified`/`warning`/`error`) and `messages` array with human-readable issues. On `verified` or `warning`, the response includes a `matched_address` with corrected fields that will be used for label generation.

