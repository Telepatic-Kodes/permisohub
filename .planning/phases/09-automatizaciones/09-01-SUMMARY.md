---
phase: 09-automatizaciones
plan: "01"
subsystem: api
tags: [cron, supabase, whatsapp, dom-scraper, idempotency]

# Dependency graph
requires:
  - phase: 08-copiloto-core
    provides: Copiloto API + UI foundation, daily-check cron with DOM scraper stub
provides:
  - DOM scraper loop runs unconditionally (no WA gate)
  - Idempotent DB update via .neq('estado', estadoNuevo)
  - etapa_actual field written on every estado transition
  - results.domStatusChanges increments regardless of WA availability
affects: [daily-check cron, proyectos table, whatsapp notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent Supabase update: .update().eq('id').neq('field', value) prevents double-writes on repeated cron invocations"
    - "Guard decoupling: infrastructure concerns (scraping, DB writes, counters) run unconditionally; optional integrations (WhatsApp) gated separately"

key-files:
  created: []
  modified:
    - app/api/cron/daily-check/route.ts

key-decisions:
  - "Merged AUTO-01 and AUTO-02 into single atomic replacement of section 4 since both tasks modified the same block"
  - "results.domStatusChanges++ placed before the WA guard so scrape telemetry is always accurate"
  - ".neq('estado', estadoNuevo) on the Supabase update acts as a server-side idempotency guard — zero DB writes if state hasn't changed between cron invocations"

patterns-established:
  - "Supabase idempotency pattern: chain .neq() on updates when the new value must differ from current"

# Metrics
duration: 5min
completed: 2026-06-26
---

# Phase 9 Plan 01: Automatizaciones — DOM Scraper Idempotency + WA Guard Decoupling Summary

**DOM scraper loop decoupled from WhatsApp availability guard; idempotent Supabase update with .neq() and etapa_actual field added**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-26T00:00:00Z
- **Completed:** 2026-06-26T00:05:00Z
- **Tasks:** 2 (AUTO-01 + AUTO-02, merged into single atomic replacement)
- **Files modified:** 1

## Accomplishments

- Removed outer `if (isWhatsAppAvailable())` that silently skipped all DOM scraping when Twilio was unconfigured
- Added `.neq('estado', estadoNuevo)` to the Supabase update chain — double cron invocations now produce zero DB writes on the second call
- Added `etapa_actual: scraperData.descripcion ?? null` to the update object so the DOM description is persisted alongside the estado
- `results.domStatusChanges++` now increments unconditionally when a state change is detected, giving accurate telemetry regardless of WA config

## Task Commits

1. **AUTO-01 + AUTO-02: idempotent DOM update + decouple WA guard** - `f51dee4` (fix)

## Files Created/Modified

- `app/api/cron/daily-check/route.ts` - Section 4 replaced: outer WA guard removed, inner WA guard added, .neq() + etapa_actual added to update

## Decisions Made

- Merged AUTO-01 and AUTO-02 into a single replacement since both modify the same section 4 block — separating them would have required two sequential reads/writes of the same region with no intermediate verification benefit
- Used `etapa_actual: scraperData.descripcion ?? null` (null coalesce) to safely clear the field when the scraper returns no description

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 were merged into a single atomic commit per the key_context instruction ("Execute Task 2's full replacement block — it already incorporates Task 1's changes").

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Existing Twilio env vars continue to work as before.

## Next Phase Readiness

- Phase 09 plan 01 complete — daily-check cron now scrapes DOM unconditionally and writes idempotent updates
- Next: remaining AUTO plans in phase 09 (weekly email, observaciones insert, etc.)
- No blockers

---
*Phase: 09-automatizaciones*
*Completed: 2026-06-26*
