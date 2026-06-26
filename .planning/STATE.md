# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v1.3 Army of Skills
Last activity: 2026-06-25 — Milestone v1.3 started

## Phases Status

| Phase | Title | Status |
|---|---|---|
| 6 | Dashboard Timeline View | ✅ app/(dashboard)/dashboard/page.tsx — Timeline View con 4 secciones |
| 1 | Stripe Billing | ✅ app/api/billing/{checkout,portal,webhook}, lib/stripe.ts, /configuracion/billing |
| 2 | Feature Gating | ✅ lib/plan-limits.ts, lib/usage.ts, upgrade prompt on /proyectos, API usage gate |
| 3 | Landing Page | ✅ app/(marketing)/page.tsx — hero + 6 features + 3 pricing tiers + toggle anual |
| 4 | Onboarding | ✅ app/(dashboard)/onboarding/page.tsx — wizard 3 pasos |
| 5 | PWA | ✅ public/manifest.json + install prompt component |

## Project Reference

See: .planning/PROJECT.md
**Core value:** El copiloto IA del arquitecto chileno — acelera y automatiza la tramitación de permisos DOM
**Current focus:** Producción — configurar env vars en Vercel y SQL migrations en Supabase

## Accumulated Context

- Path contains accented char (`/Estefanía/`) — Turbopack panics on routes whose hash lands on the multi-byte boundary. Workaround: avoid dashes in route folder names (e.g. use `calculadora` not `calculadora-derechos`).
- Supabase middleware has `process.env.NODE_ENV === 'development'` bypass — auth is not enforced locally. Production (Vercel) uses `NODE_ENV=production` so auth IS enforced.
- `params` in dynamic routes is a Promise in Next.js 16 — use `React.use(params)` client, `await params` server.
- Dev server runs on port 7891 via `permisohub/package.json` start script with Turbopack.
- `ANTHROPIC_API_KEY` must be set in Vercel env vars by user — never hardcoded.
- Twilio WhatsApp: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` needed in Vercel.
- `GET /api/usage?metric=ai_chats|pdf_extractions` — returns {used, limit, plan} for current user. Used by Chat OGUC page to show "X/20 consultas este mes" badge. Returns 401 in dev (no session).
- Chat OGUC usage badge: only shows for plans with finite limits (Free/Starter). Pro/Estudio users see nothing. Badge turns amber at 80%, red at 100%.
