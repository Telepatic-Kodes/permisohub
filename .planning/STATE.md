# State

## Current Position

Phase: 9 — Automatizaciones
Plan: 03 — COMPLETE
Status: IN PROGRESS — 09-01 ✅ 09-02 ✅ 09-03 ✅
Last activity: 2026-06-26 — 09-03 complete: sendResumenSemanal extended with tipSemanal? param + blue card HTML block; weekly-summary route adds AI tip via aiComplete with isAIAvailable guard; vercel.json schedule fixed to 0 11 * * 1 (08:00 Santiago UTC-3); tsc clean

## Phases Status

| Phase | Title | Status |
|---|---|---|
| 7 | Foundation | ✅ 07-01 service client, 07-02 checklist table, 07-03 Sheet component |
| 8 | Copiloto Core | ✅ 08-01 ✅ (API) 08-02 ✅ (UI: drawer, trigger, 4 tabs) 08-03 ✅ (page integration: permisos, patentes, proyectos/[id]) |
| 9 | Automatizaciones | 09-01 ✅ (DOM scraper idempotency + WA guard decoupled) 09-02 ✅ (after() SII enrichment on patente_comercial creation) 09-03 ✅ (AI tip in weekly email + schedule fix) |
| 6 | Dashboard Timeline View | ✅ app/(dashboard)/dashboard/page.tsx — Timeline View con 4 secciones |
| 1 | Stripe Billing | ✅ app/api/billing/{checkout,portal,webhook}, lib/stripe.ts, /configuracion/billing |
| 2 | Feature Gating | ✅ lib/plan-limits.ts, lib/usage.ts, upgrade prompt on /proyectos, API usage gate |
| 3 | Landing Page | ✅ app/(marketing)/page.tsx — hero + 6 features + 3 pricing tiers + toggle anual |
| 4 | Onboarding | ✅ app/(dashboard)/onboarding/page.tsx — wizard 3 pasos |
| 5 | PWA | ✅ public/manifest.json + install prompt component |

## Project Reference

See: .planning/PROJECT.md
**Core value:** El copiloto IA del arquitecto chileno — acelera y automatiza la tramitación de permisos DOM
**Current focus:** v1.3 Army of Skills — copiloto drawer embebido + automatizaciones de fondo

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
