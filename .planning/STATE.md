# State

## Current Position

Phase: 7 — Foundation
Plan: 02 (checkpoint — awaiting human verification of Supabase migration)
Status: In progress — 07-02 Task 1 complete, paused at checkpoint:human-verify
Last activity: 2026-06-25 — 07-01 complete (createServiceClient + cron patches), 07-02 at checkpoint:human-verify

## Phases Status

| Phase | Title | Status |
|---|---|---|
| 7 | Foundation | In progress — 07-02 at checkpoint (schema.sql updated, awaiting Supabase apply) |
| 8 | Copiloto Core | Not started |
| 9 | Automatizaciones | Not started |
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
- [v1.3] `document_checklist_items` DDL added to schema.sql (07-02, c0121e5) — awaiting manual apply in Supabase Dashboard to resolve FOUND-02. Once applied, SKILL-04 (Phase 8) is unblocked.
- [v1.3] DOM write-back is partially done (estado write at line 149 of daily-check) — AUTO-01 adds idempotent `.neq()` guard and observaciones INSERT for `con_observaciones` transitions.
- [v1.3] Weekly email (AUTO-04) sends to `ADMIN_EMAIL` only for MVP — external recipient opt-in blocked until unsubscribe flow exists (CAN-SPAM compliance).
- [v1.3] `SUPABASE_SERVICE_ROLE_KEY` must NOT have `NEXT_PUBLIC_` prefix — server-only secret.
