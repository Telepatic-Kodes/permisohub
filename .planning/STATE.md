# State

## Current Position

Phase: 10 of 12 (Motor de Zonificación) — en ejecución
Plan: 01, 02, 03 y 04 de 5 completados (migración + registro de comunas + geocoder + ruta de lookup); 05 pendiente
Status: In progress
Last activity: 2026-07-30 — 10-04-PLAN.md completado: lib/zonificacion.ts + app/api/zonificacion/lookup/route.ts, live-verificado contra las 4 comunas cubiertas + cache hit + sin_cobertura

Progress: [████░░░░░░] 40%

## Phases Status

| Phase | Title | Status |
|---|---|---|
| 10 | Motor de Zonificación | In progress — 10-01 ✅ (migración zonificacion_cache + proyectos.zona_* aplicada vía Supabase MCP) 10-02 ✅ (lib/zonificacion-comunas.ts, registro 4 comunas) 10-03 ✅ (lib/geocoding.ts, Nominatim geocoder) 10-04 ✅ (lib/zonificacion.ts + ruta GET /api/zonificacion/lookup, orquestación completa); 10-05 pendiente |
| 11 | Vista de Zonificación en el Proyecto | Not started — depende de Phase 10 |
| 12 | Integración con Motores de Decisión | Not started — depende de Phase 11 |
| 7 | Foundation | ✅ 07-01 service client, 07-02 checklist table, 07-03 Sheet component |
| 8 | Copiloto Core | ✅ 08-01 ✅ (API) 08-02 ✅ (UI: drawer, trigger, 4 tabs) 08-03 ✅ (page integration: permisos, patentes, proyectos/[id]) |
| 9 | Automatizaciones | ✅ 09-01 (DOM scraper idempotency + WA guard decoupled) 09-02 (after() SII enrichment on patente_comercial creation) 09-03 (AI tip in weekly email + schedule fix) |
| 6 | Dashboard Timeline View | ✅ app/(dashboard)/dashboard/page.tsx — Timeline View con 4 secciones |
| 1 | Stripe Billing | ✅ app/api/billing/{checkout,portal,webhook}, lib/stripe.ts, /configuracion/billing |
| 2 | Feature Gating | ✅ lib/plan-limits.ts, lib/usage.ts, upgrade prompt on /proyectos, API usage gate |
| 3 | Landing Page | ✅ app/(marketing)/page.tsx — hero + 6 features + 3 pricing tiers + toggle anual |
| 4 | Onboarding | ✅ app/(dashboard)/onboarding/page.tsx — wizard 3 pasos |
| 5 | PWA | ✅ public/manifest.json + install prompt component |

## Project Reference

See: .planning/PROJECT.md
**Core value:** El copiloto IA del arquitecto chileno — acelera y automatiza la tramitación de permisos DOM
**Current focus:** v1.4 Zonificación — Phase 10 (Motor de Zonificación): geocoding + registro de cobertura + persistencia automática de zona PRC, sin UI todavía

## Accumulated Context

- Path contains accented char (`/Estefanía/`) — Turbopack panics on routes whose hash lands on the multi-byte boundary. Workaround: avoid dashes in route folder names (e.g. use `calculadora` not `calculadora-derechos`).
- Supabase middleware has `process.env.NODE_ENV === 'development'` bypass — auth is not enforced locally. Production (Vercel) uses `NODE_ENV=production` so auth IS enforced.
- `params` in dynamic routes is a Promise in Next.js 16 — use `React.use(params)` client, `await params` server.
- Dev server runs on port 7891 via `permisohub/package.json` start script with Turbopack.
- `ANTHROPIC_API_KEY` must be set in Vercel env vars by user — never hardcoded.
- Twilio WhatsApp: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` needed in Vercel.
- `GET /api/usage?metric=ai_chats|pdf_extractions` — returns {used, limit, plan} for current user. Used by Chat OGUC page to show "X/20 consultas este mes" badge. Returns 401 in dev (no session).
- Chat OGUC usage badge: only shows for plans with finite limits (Free/Starter). Pro/Estudio users see nothing. Badge turns amber at 80%, red at 100%.
- [v1.3] CRIT live bug RESOLVED (07-01): cron routes now use createServiceClient() from lib/supabase/service.ts with SUPABASE_SERVICE_ROLE_KEY — bypasses RLS. NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in Vercel for crons to work. Commits: 30a88b2, 775e417.
- [v1.3] AI provider is OpenAI GPT-4o via `lib/ai.ts` — `@anthropic-ai/sdk` installed but dormant. Do NOT migrate provider during this milestone.
- [v1.3] Copiloto analysis uses `Promise.all` for 4 concurrent AI calls — set `export const maxDuration = 90` on the route segment to avoid Vercel timeout.
- [v1.3] `document_checklist_items` table live in Supabase (07-02, c0121e5) — FOUND-02 resolved. RLS policy checklist_items_own active. SKILL-04 (Phase 8) is unblocked.
- [v1.3] DOM write-back complete (09-01, f51dee4) — daily-check section 4: outer `isWhatsAppAvailable()` guard removed, `.neq('estado', estadoNuevo)` added for idempotency, `etapa_actual` field written on every estado transition. `results.domStatusChanges++` runs unconditionally.
- [v1.3] SII auto-enrichment live (09-02, 1f1ed83) — POST /api/proyectos: after() block fires on patente_comercial creation when numero_expediente present. Calls GET /api/sii/lookup?rol=..., writes superficie_terreno_m2, superficie_construida_m2, destino_sii via createServiceClient(). giro_sii NOT auto-populated (manual field). HTTP 200 returns immediately, enrichment is fire-and-forget.
- [v1.3] Weekly email (AUTO-04) sends to `ADMIN_EMAIL` only for MVP — external recipient opt-in blocked until unsubscribe flow exists (CAN-SPAM compliance).
- [v1.3] `SUPABASE_SERVICE_ROLE_KEY` must NOT have `NEXT_PUBLIC_` prefix — server-only secret.
- [v1.3] Sheet component live (07-03, d855f60) — `@/components/ui/sheet` exports Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose, SheetTrigger. Primitive: `@base-ui/react/dialog` (base-nova style). No new npm deps. FOUND-03 resolved, SKILL-01 (Phase 8) unblocked.
- [v1.3] Copiloto API live (08-01, 2726f33) — POST /api/ai/copiloto runs 4 concurrent aiComplete calls via Promise.all with maxDuration=90. Checklist idempotency: queries document_checklist_items before AI, skips call and returns DB rows if count > 0. PATCH /api/ai/copiloto/checklist/[itemId] toggles estado. TIPO_PERMISO_TO_OBRA lookup map used for type coercion. stats?.tiempoPromedioHabiles (NOT plazoTipicoDias). await params pattern (Next.js 16). SKILL-02/03/04/05 (Phase 8) unblocked.
- [v1.3] Copiloto UI live (08-02, 18eaa75) — CopilotoDrawer: idle shows 4 skill cards, card-click→loading→loaded state machine, Map<string,CopilotoResult> cache by proyectoId. CopilotoTrigger: thin Bot-icon button. 4 tab components: TabOguc (articles+cumple), TabObservaciones (riesgoGlobal+predictions), TabChecklist (optimistic PATCH toggle, 'pendiente'|'ok' union), TabEstimacion (plazo+derechos CLP/UF). All interfaces exported from copiloto-drawer.tsx. No shadcn Tabs. tsc exits 0. SKILL-01 complete.
- [v1.3] Copiloto page integration live (08-03, a8576f7) — CopilotoTrigger per row in permisos + patentes list pages, CopilotoTrigger in PageHeader action div in proyectos/[id]. Shared CopilotoDrawer at page level (single instance). State pattern: copilotoProyecto (nullable Pick) + copilotoOpen (bool). Desarchivo covered by proyectos/[id] — no dedicated desarchivo list page exists. SKILL-01 fully operational across all views.
- [v1.3] Weekly email AI tip live (09-03, ef5972e + e99aeb9) — sendResumenSemanal accepts tipSemanal?: string, renders blue card (#EFF6FF border #BFDBFE) via escapeHtml. weekly-summary route generates tip with isAIAvailable() guard + try/catch fallback to ''. vercel.json weekly-summary schedule corrected to 0 11 * * 1 (08:00 Santiago UTC-3, was 12:00 UTC). Pattern: isAIAvailable() guard + try/catch = safe AI feature degradation.
- [v1.4] Roadmap decision (2026-07-30): 3 phases (10-12), not 4 as research suggested — merged research's Phase 1 (schema/registry/geocoder) + Phase 2 (adapter/lookup route/persistence) into a single Phase 10, since neither alone is user-observable and splitting them risked a horizontal-layers feel. Phase 10 has zero directly-mapped requirements (pure enabling infrastructure, verified via API/DB rather than UI) — ZONE-01 is owned by Phase 11 because the requirement text explicitly requires the architect to *see* the zone.
- [v1.4] No existing geocoder in the codebase — `lib/geocoding.ts` (Nominatim) is a hard Phase 10 prerequisite, not incidental.
- [v1.4] No PostGIS — zonificacion cache uses plain Supabase columns (lat/lng double precision + jsonb), matching the `proyectos_sii` convention. ArcGIS does the spatial math server-side (`returnGeometry=false`).
- [v1.4] Explicit 3-state pattern required everywhere: lookup status (`encontrado`/`sin_cobertura`/`error`) and compatibility check (`Permitido`/`No permitido`/`No especificado`) must never collapse to a boolean — this was the #1 pitfall theme in research (PITFALLS.md).
- [v1.4] New citation type needed: PRC/GIS data must NOT reuse `normativa-retrieval.ts`'s `verificado: true` badge (different trust axis) — needs its own `FuenteNormativa` value and disclaimer wording.
- [v1.4] Phase 12 (via-tramitacion.ts, due-diligence.ts, copiloto integration) is strictly additive — `recomendarVia()`'s deterministic core must never be modified; sequenced last so an immature zoning feature can't corrupt engines that already work.
- [v1.4] Map library selection (MapLibre vs Leaflet) is an open spike for Phase 11 planning — no mapping library exists in the codebase today, this is the one new frontend dependency in the milestone.
- [v1.4] Nominatim geocoder live (10-03, c134add) — `lib/geocoding.ts` exports `geocodeDireccion(direccion, comuna)`, server-side only (reuses `fetchWithTimeout` from `lib/scraper.ts`, custom Nominatim User-Agent). Live-verified: `lat`/`lon` return as strings (parsed via `parseFloat`), and `address.suburb` holds the real comuna while `address.city` collapses to "Santiago" — `comunaDetectada` reads `suburb` first, `city` only as fallback. In-module throttle (1.1s) respects Nominatim's 1 req/sec policy, no new dependency. Never throws — resolves `{ok:false, error}` on any failure. Comuna cross-check vs. requested comuna is deferred to Plan 10-04's caller (soft warning, not a gate).
- [v1.4] Zonificación comuna registry live (10-02, 380798f) — `lib/zonificacion-comunas.ts` exports `ZONIFICACION_COMUNAS` (4 verified entries: las-condes/providencia/vitacura `dedicada` lowercase fieldMap, nunoa `agregada` UPPERCASE fieldMap against shared `PrcCuencaMaipo` layer), `resolveComunaZonificacion(nombreOMunicipio)` (display-name or slug → entry or `null`, never an empty-but-truthy object), and `getComunasConCobertura()` for Phase 11's manual-fallback UI. Ñuñoa flagged `usosDisponibles: false` (UPERM/UPROH structurally empty in source, confirmed 0/200 filled) — must be disclosed, not inferred from nullability. Kept fully separate from `lib/comunas-chile.ts`, same small-deep-registry pattern as `lib/municipios-stats.ts`. Pure data + one pure function, no new dependency.
- [v1.4] Zonificación schema live (10-01, checkpoint closed 2026-07-30) — `zonificacion_cache` (17 cols, RLS on, `zonificacion_cache_read` policy) + `proyectos.zona_*` (9 cols) + `zona_status_check` CHECK constraint, all applied to Supabase project `nojejnebedjpbdlynrqs` via the Supabase MCP server's `apply_migration` (not the dashboard SQL Editor — MCP became available mid-phase). Supabase MCP is now configured at `user` scope in `~/.claude.json` (fresh Personal Access Token — the one reused from `permisohub`'s prior project-scoped config had expired) — reusable across sessions without reconfiguration going forward.
- [v1.4] Zonificación lookup route live (10-04, 687c6d9 + ec7c5ea) — `lib/zonificacion.ts` (client-safe `ZonaStatus`/`ZonaData`/`ZonaLookupResponse` types, `ArcGISQueryResponseSchema` Zod boundary validation, `lookupZonificacion()` fetch helper) + `GET /api/zonificacion/lookup` (registry short-circuit → `geocodeDireccion()` → `zonificacion_cache` read-through by `(comuna_id, lat_r, lng_r)` → ArcGIS point-in-polygon query with explicit `geometry=lng,lat&inSR=4326` → Zod validation → cache upsert). No auth check on the route (precedent: `app/api/utils/uf/route.ts` — public data, must be callable from session-less `after()` in Plan 10-05), rate-limited by IP via `checkRateLimit()`. Live-verified against all 4 covered comunas via curl on a local dev server: Las Condes/Providencia/Vitacura return `usosDisponibles:true`, Ñuñoa returns `usosDisponibles:false` with `uperm:null`/`uproh:null`; repeat query hits cache (`cacheHit:true`, identical `consultadoEl`); Temuco returns `sin_cobertura` with zero network calls. Empty ArcGIS `features[]` deliberately maps to `status:'error'`, never `'sin_cobertura'` or a false `'encontrado'`. Some ArcGIS text fields contain source-side mojibake (pre-existing upstream encoding, out of scope) — flagged for Phase 11 UI awareness.

## Session Continuity

Last session: 2026-07-30
Stopped at: Completed 10-04-PLAN.md (lib/zonificacion.ts + app/api/zonificacion/lookup/route.ts, live-verified end-to-end). Phase 10 has 5 plans total; 10-05 (after() wiring into project creation, Wave 3) still pending.
Resume file: None
