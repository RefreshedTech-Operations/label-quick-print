# Project Memory

## Core
Use EST (America/New_York) timezone consistently across all features.
Prioritize performance over visual flair; no complex UI overlays in scanning loops.
Bundle locations must NEVER be set automatically without explicit user confirmation.
Staff role is 'labeler'. Public signup is disabled.
Edge functions proxying APIs must use manual auth validation (`verify_jwt = false`) and direct frontend fetches.
Avoid overloaded RPC signatures in Supabase functions.
Pack page camera scanner is restricted to 1D barcodes only.
Valid channels: 'regular', 'misfits', 'outlet', 'tiktok'.

## Memories
- [Config protection](mem://settings/configuration-protection) — Critical settings require confirmation dialogs before clearing
- [Bundle location recommendations](mem://scan/bundle-location-recommendation-system) — Suggests locations based on first scanned item in bundle
- [Label Only pick lists](mem://upload/label-only-format-pick-lists) — Pick lists generate for Label Only format after labels print
- [Per-item bundle updates](mem://scan/bundle-location-per-item-update) — Each bundle item must be physically scanned and confirmed
- [Auto-print bypass](mem://scan/auto-print-bundle-location-bypass) — Auto-print must bypass unconfirmed bundle items
- [Print status DB sync](mem://scan/print-status-database-sync) — Print logging must verify DB success before marking "done"
- [Simplified bundle workflow](mem://scan/bundle-print-simplified-workflow) — Group ID labels aren't required before marking items printed
- [Role-based access](mem://admin/role-based-access-control) — Admin features use server-side `has_role` RPC checks
- [No automatic assignment](mem://bundle-locations/no-automatic-assignment) — User must always confirm bundle locations
- [Auto-suggestion workflow](mem://bundle-locations/auto-suggestion-workflow) — Suggest next available location for first bundle item
- [Occupancy logic](mem://bundle-locations/occupancy-determination-logic) — Location occupied until ALL bundle items are printed
- [Conflict detection](mem://bundle-locations/real-time-conflict-detection) — Real-time DB subscriptions detect multi-user bundle conflicts
- [Kit devices confirmation](mem://scan/kit-devices-confirmation-workflow) — Requires confirmation for kit items before bundle location
- [Timezone consistency](mem://ui/timezone-consistency-est) — Use EST timezone across all pages and charts
- [Last device UX](mem://scan/last-device-bundle-ux) — Distinctive UI and manifest printing when scanning final bundle device
- [Scan page error banners](mem://ui/scan-page-error-banners) — Use prominent colored card banners instead of toast notifications
- [Bundle ID scannability](mem://scan/bundle-id-barcode-scannable) — CODE128, stripped hyphens, optimized dimensions for warehouse scanning
- [Upload batching](mem://upload/performance-optimization-batching) — Auto-split retry strategy to avoid DB timeouts (size 100, limit 2)
- [Print state safety](mem://scan/print-traceability-and-state-safety) — Fetch fresh data before printing packing slips to avoid stale state
- [Archiving batching](mem://database/archiving-performance-batching) — DB archiving uses batched transactions to prevent timeouts
- [Archive search behavior](mem://orders/archive-search-date-filter-behavior) — Search clears date filters automatically when 'Include Archived' is active
- [Channel checks](mem://database/channel-check-constraint) — Enforces valid channel strings at the database level
- [SMS linking](mem://features/sms-customer-conversation-linking) — SMS threads linked to customers via phone number matches
- [Unified user management](mem://admin/unified-user-management) — Disabled user flag with 100-year ban instead of hard deletion
- [Dynamic permissions](mem://admin/dynamic-permission-system) — Merges role defaults with user overrides, reloads on auth state change
- [Auto archiving](mem://database/automated-weekly-archiving) — Weekly cron edge function archives shipments older than threshold
- [Disabled public signup](mem://auth/disabled-public-signup) — UI disables signup; admins manage account creation
- [Scanner UX](mem://pack-page/scanner-ux-logic) — 5s cooldown and local session checks to prevent double-scanning
- [Barcode restrictions](mem://pack-page/barcode-type-restriction) — Pack page restricts camera scanner to 1D barcodes
- [RPC overloads](mem://database/rpc-overload-resolution) — Use single signature RPCs to prevent PostgREST overload resolution errors
- [Performance over visuals](mem://constraints/performance-over-visuals-priority) — Core scanning ops block complex UI overhead
- [Role naming](mem://admin/role-naming-standard) — Standardized 'labeler' role for permission checks
- [Tracking prefix stripping](mem://pack-page/tracking-prefix-stripping) — Strips 15-char prefix from >30 char inputs, exempts UPS (1Z) tracking
- [Pack workflow](mem://pack-page/workflow) — Pack replaces Batch; station state persists in localStorage
- [Messaging access](mem://messaging/access-control) — Controlled strictly by dynamic permissions, not hardcoded roles
- [Programmatic API](mem://upload/automation-programmatic-api) — Global window functions for automated CSV chunks
- [Channels logic](mem://shipments/channels) — Specific channel behaviors for warnings and bypasses
- [Address parsing](mem://shipping-labels/address-parsing-logic) — Robust multi-format parser for up to 7 components
- [Void behavior](mem://shipping-labels/void-and-reset-behavior) — Voiding a label resets all DB print states atomically
- [Secure label access](mem://shipping-labels/secure-label-access) — Proxy fetching of PDF blobs via programmatic anchors
- [Manual edge validation](mem://auth/edge-function-manual-validation) — API-proxy edge functions manually parse user auth tokens
- [Edge error transparency](mem://integrations/edge-function-error-transparency) — Direct fetches to expose specific proxy HTTP error payloads
- [Document printing](mem://scan/document-printing-logic) — Handles combination of ShipEngine API vs local pick lists
- [TikTok portal linking](mem://shipments/tiktok-portal-linking) — TikTok orders natively link to seller portal globally
- [Missing labels criteria](mem://shipping-labels/missing-labels-criteria) — Null tracking implies label doesn't exist yet
- [Auth state permissions](mem://admin/permission-sync-auth-state) — Force permission reload on session refresh to avoid empty UI
- [Printed order protection](mem://upload/printed-order-protection) — Imports skip and protect existing orders marked as 'printed'
- [Shipping price vs cost](mem://shipments/shipping-price) — shipping_price is source data; shipping_cost is actual expense
- [Retell AI integration](mem://integrations/retell-ai-voice-lookup) — Indexed lookups bypassing FTS for high-speed voice agent calls
- [Unit ID tracking](mem://shipments/unit-id-tracking) — Exact match DB lookups restrict process printing errors
- [Exception logic](mem://database/exception-logic-cancelled-manifest) — Null manifest or explicit 'yes' triggers exception state
- [Export formatting](mem://orders/export-functionality) — Tabs prefix long IDs in CSV exports to prevent Excel corruption
- [ShipEngine API rules](mem://integrations/shipengine-api) — Auto-fallback to USPS for PO Box addresses, strict validation
- [MCP server](mem://mcp/server-implementation) — Streamable Edge Function server with direct CRUD tools
- [Cancelled filters](mem://upload/cancelled-filter-logic) — Case-insensitive checks handling TikTok 'false' string formatting
- [Manual clearance](mem://shipping-labels/manual-clearance-placeholder) — Placeholder string clears label requirement
- [TikTok template](mem://shipping-labels/tiktok-tracking-template) — Export mapping preserves 3-tab TikTok template sheet structure
- [Generation concurrency](mem://shipping-labels/generation-concurrency) — Process bulk label APIs in max 10 parallel chunks
