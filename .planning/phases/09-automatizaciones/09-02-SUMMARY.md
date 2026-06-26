---
phase: 09-automatizaciones
plan: "02"
subsystem: api
tags: [next/server, after, sii, supabase, fire-and-forget, enrichment]

# Dependency graph
requires:
  - phase: 09-01
    provides: SII lookup route GET /api/sii/lookup returning superficie and destino fields
provides:
  - POST /api/proyectos auto-enriches patente_comercial rows with SII catastral data after response
affects: [app/api/proyectos]

# Tech tracking
tech-stack:
  added: []
  patterns: [after() fire-and-forget background enrichment, createServiceClient inside after() for no-request-context Supabase writes]

key-files:
  created: []
  modified:
    - app/api/proyectos/route.ts

key-decisions:
  - "after() from next/server (not next) — required for correct Edge/Node runtime behavior"
  - "createServiceClient() inside after() callback — no request context available post-response"
  - "giro_sii excluded from auto-update — manually entered field, must not be overwritten"
  - "Enrichment gated on three conditions: tipo===patente_comercial AND proyecto.id AND numero_expediente"

patterns-established:
  - "after() pattern: capture IDs into local const before entering after() callback to avoid closure issues with mutable references"
  - "Fire-and-forget SII enrichment: fetch GET /api/sii/lookup, validate ok+data, then update proyectos row via service client"

# Metrics
duration: 5min
completed: 2026-06-26
---

# Phase 09 Plan 02: Automatizaciones SII Enrichment Summary

**`after()` fire-and-forget SII enrichment on patente_comercial creation — writes superficie_terreno_m2, superficie_construida_m2, destino_sii to proyectos row after HTTP 200 returns**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-26T04:12:30Z
- **Completed:** 2026-06-26T04:17:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `after()` block to POST /api/proyectos that fires only for patente_comercial tipo with a numero_expediente
- Background task fetches GET /api/sii/lookup?rol=... and writes superficie/destino fields to the newly created row
- HTTP response (200 + proyecto.id) returns immediately — enrichment never blocks the client
- Dev mock fallback paths (simulated: true) remain fully intact

## Task Commits

Each task was committed atomically:

1. **Task 1: AUTO-03 — Add after() SII enrichment to POST /api/proyectos** - `1f1ed83` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `app/api/proyectos/route.ts` - Added `after` + `createServiceClient` imports and after() enrichment block between DB error handling and final return

## Decisions Made
- Used `createServiceClient()` (not `createClient()`) inside `after()` because after() runs after the response is sent and there is no longer a request context available for cookie-based auth
- `giro_sii` intentionally excluded from the update object — it is a manually entered field and must not be overwritten by automated data
- Enrichment gated on all three: `tipo === 'patente_comercial'`, `proyecto?.id`, and `body.numero_expediente` — avoids unnecessary SII calls for other permit types or rows without an expediente

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Existing `NEXT_PUBLIC_APP_URL` env var used as base URL for the internal SII lookup call.

## Next Phase Readiness
- AUTO-03 complete. POST /api/proyectos now auto-enriches patente_comercial rows with SII catastral data
- Remaining automatizaciones in phase 09: AUTO-01 (DOM write-back idempotency), AUTO-04 (weekly email)

---
*Phase: 09-automatizaciones*
*Completed: 2026-06-26*

## Self-Check: PASSED

- `app/api/proyectos/route.ts` - FOUND
- `09-02-SUMMARY.md` - FOUND
- Commit `1f1ed83` - FOUND
