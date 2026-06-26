---
phase: 08-copiloto-core
plan: "01"
subsystem: api
tags: [openai, gpt4o, supabase, rls, promise-all, checklist-idempotency, oguc, derechos-municipales]

# Dependency graph
requires:
  - phase: 07-foundation
    provides: document_checklist_items table live in Supabase, Sheet component, createServiceClient
provides:
  - POST /api/ai/copiloto running 4 concurrent GPT-4o skills returning oguc, observaciones, checklist, estimacion
  - PATCH /api/ai/copiloto/checklist/[itemId] toggling checklist item estado between pendiente/ok
  - Checklist idempotency guard skipping AI and returning DB rows when items already exist
affects: [08-02-copiloto-drawer, frontend-copiloto-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.all with 4 concurrent aiComplete calls, maxDuration=90 to avoid Vercel timeout"
    - "Checklist idempotency: read DB before AI call, skip and return existing rows when count > 0"
    - "TIPO_PERMISO_TO_OBRA lookup map for safe TipoPermiso to TipoObra coercion"
    - "await params pattern for Next.js 16 dynamic route segments"

key-files:
  created:
    - app/api/ai/copiloto/route.ts
    - app/api/ai/copiloto/checklist/[itemId]/route.ts
  modified: []

key-decisions:
  - "4 AI skills run concurrently via Promise.all — OGUC, observaciones, estimacion always call AI; checklist is conditional on DB count"
  - "Checklist items persisted to document_checklist_items on first call, returned from DB on subsequent calls (idempotency)"
  - "TIPO_PERMISO_TO_OBRA Record<string,string> map used instead of .includes() for type-safe TipoObra coercion"
  - "plazo base from stats?.tiempoPromedioHabiles (not plazoTipicoDias which does not exist on EstadisticaMunicipio)"

patterns-established:
  - "export const maxDuration = 90 as second export (after dynamic) in AI routes with parallel calls"
  - "RLS-enforced project fetch: always createClient() server-side, client only sends proyectoId"
  - "Checklist idempotency pattern: SELECT before INSERT, skip AI entirely if rows exist"

# Metrics
duration: 15min
completed: 2026-06-25
---

# Phase 8 Plan 01: Copiloto Core API Summary

**POST /api/ai/copiloto running 4 concurrent GPT-4o skills (OGUC, observaciones, checklist, estimacion) with DB-backed idempotency guard for checklist generation, plus PATCH toggle route for checklist item estado**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-25T00:00:00Z
- **Completed:** 2026-06-25T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments
- POST /api/ai/copiloto runs 4 concurrent aiComplete calls via Promise.all with maxDuration=90
- Checklist idempotency: queries document_checklist_items before AI — returns existing DB rows if count > 0, skips AI call entirely
- PATCH /api/ai/copiloto/checklist/[itemId] toggles estado between pendiente/ok via Supabase RLS-protected update
- TypeScript strict mode passes with zero errors, no `any` types

## Task Commits

1. **Task 1+2: POST /api/ai/copiloto + PATCH /api/ai/copiloto/checklist/[itemId]** - `2726f33` (feat)

**Plan metadata:** docs commit added below

## Files Created/Modified
- `app/api/ai/copiloto/route.ts` — Main endpoint: fetches proyecto via RLS, guards checklist idempotency, runs 4 parallel AI skills, inserts new checklist items to DB, returns { ok, oguc, observaciones, checklist, estimacion }
- `app/api/ai/copiloto/checklist/[itemId]/route.ts` — PATCH handler: awaits params (Next.js 16), validates estado enum, updates document_checklist_items via Supabase

## Decisions Made
- `maxDuration = 90` placed as second export (after `dynamic = 'force-dynamic'`) — required to override Vercel's 30s default for 4 concurrent AI calls
- Checklist idempotency implemented as DB read guard before Promise.all — prevents duplicate inserts and saves AI tokens on repeat calls
- `TIPO_PERMISO_TO_OBRA` Record<string,string> used for type-safe coercion to TipoObra enum; unmapped types fall back to 'obra_nueva'
- `stats?.tiempoPromedioHabiles` used (not `stats?.plazoTipicoDias` — that field does not exist on EstadisticaMunicipio)

## Deviations from Plan

None — both route files already existed matching the plan specification exactly. Confirmed via tsc --noEmit (0 errors), then committed as new files (previously untracked).

## Issues Encountered
None — plan executed as specified. Both files were pre-created and verified against all critical constraints before committing.

## User Setup Required
None — OPENAI_API_KEY already documented in STATE.md Accumulated Context.

## Next Phase Readiness
- API layer complete — Plan 02 (copiloto drawer UI) can call POST /api/ai/copiloto and PATCH /api/ai/copiloto/checklist/[itemId]
- `components/copiloto/` (drawer, trigger, tabs) are already scaffolded and untracked — ready for Plan 02 to commit
- No blockers

## Self-Check: PASSED
- `app/api/ai/copiloto/route.ts` — FOUND
- `app/api/ai/copiloto/checklist/[itemId]/route.ts` — FOUND
- Commit `2726f33` — FOUND (git log confirmed)
- `npx tsc --noEmit` — PASS (0 errors)

---
*Phase: 08-copiloto-core*
*Completed: 2026-06-25*
