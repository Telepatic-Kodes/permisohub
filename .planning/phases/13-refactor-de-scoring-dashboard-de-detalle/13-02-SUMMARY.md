---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 02
subsystem: ai
tags: [openai, responses-api, streaming, prompt-engineering, date-formatting]

# Dependency graph
requires: []
provides:
  - "lib/formato-fecha.ts — formatFechaCorta(iso), shared date-only formatter (mes+año, es-CL, America/Santiago)"
  - "lib/ai.ts — streamConContexto(instructions, input), Responses API streaming WITHOUT web_search_preview tool"
  - "lib/resumen-oportunidad-prompts.ts — ResumenOportunidadContexto type + buildSystemResumenOportunidad() + buildUserQueryResumenOportunidad(ctx)"
affects: [13-04, 13-05, 13-06, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "streamConContexto vs streamConBusquedaWeb: same Responses API streaming shape, but omitting `tools` entirely makes web search structurally impossible (not just prompt-discouraged) for domains with pre-computed server-side data"
    - "Prompt builders mark null fields explicitly as 'no disponible' via a shared num() helper, never omitting or estimating them — prevents AI fabrication over real market data"

key-files:
  created:
    - lib/formato-fecha.ts
    - lib/resumen-oportunidad-prompts.ts
  modified:
    - lib/ai.ts

key-decisions:
  - "streamConContexto uses max_output_tokens: 3000 (vs 12000 for streamConBusquedaWeb) since the executive summary is a short narrative with no web search rounds"
  - "formatFechaCorta moved verbatim from oportunidades/page.tsx without touching that file — 13-07 will do the swap to import"

patterns-established:
  - "Shared narrow-purpose lib/*.ts utilities extracted ahead of their first new consumer, when multiple planned phases will need the same logic (avoids duplicating formatFechaCorta a third time)"

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 13 Plan 02: Utilidades Compartidas (fecha, streaming sin búsqueda, prompts de resumen) Summary

**Shared date formatter, tools-free AI streaming function, and executive-summary prompt builders — three independently consumable utilities with zero cross-dependency on the scoring refactor (13-01).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-02T19:37:00Z (approx, based on first commit)
- **Completed:** 2026-08-02T19:37:42Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 extended)

## Accomplishments
- Extracted `formatFechaCorta` into `lib/formato-fecha.ts`, byte-identical logic to the inline copy in `oportunidades/page.tsx` (date-only fields, `T00:00:00` + `America/Santiago` fix for Pitfall D)
- Added `streamConContexto()` to `lib/ai.ts` — structurally prevents live web search (no `tools` key in the Responses API payload) for the executive summary of a single opportunity, where all numbers already exist server-side
- Added `lib/resumen-oportunidad-prompts.ts` with `ResumenOportunidadContexto`, `buildSystemResumenOportunidad()`, `buildUserQueryResumenOportunidad()` — narrates real bands/comparables/history, never fabricates null fields

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/formato-fecha.ts** - `017fc96` (feat)
2. **Task 2: streamConContexto() en lib/ai.ts** - `c3e920a` (feat)
3. **Task 3: lib/resumen-oportunidad-prompts.ts** - `182dd0e` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `lib/formato-fecha.ts` - Shared `formatFechaCorta(iso)` date-only formatter (mes+año, es-CL, America/Santiago)
- `lib/ai.ts` - Added `streamConContexto(instructions, input)`, sibling to `streamConBusquedaWeb` but without the `web_search_preview` tool, `max_output_tokens: 3000`
- `lib/resumen-oportunidad-prompts.ts` - `ResumenOportunidadContexto` type + system/user prompt builders for the AI executive summary of a single market opportunity

## Decisions Made
- `max_output_tokens: 3000` for `streamConContexto` (vs 12000 for `streamConBusquedaWeb`) — no web search rounds to budget for, output is a short 3-section narrative
- `oportunidades/page.tsx` intentionally left untouched (still has its own inline `formatFechaCorta` copy) — the swap to the shared import is explicitly deferred to 13-07 per the plan's stated boundary

## Deviations from Plan

None - plan executed exactly as written. All three files match the plan's code blocks verbatim (with the same rationale comments as specified).

## Issues Encountered

None specific to this plan. Note: `npx tsc --noEmit` shows one pre-existing error (`tests/unit/evaluar-oportunidad.test.ts` — missing export `evaluarOportunidad` from `lib/mercado-locales-server.ts`) unrelated to any of this plan's three files — it originates from the parallel wave-1 plan 13-01, which is mid-TDD-cycle (RED committed, GREEN pending) in the same working tree. Confirmed out of scope per the deviation rules' scope boundary; not fixed here. All three of this plan's files compile cleanly (no tsc errors attributable to `lib/formato-fecha.ts`, `lib/ai.ts`, or `lib/resumen-oportunidad-prompts.ts`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `streamConContexto` + the two prompt builders are ready for 13-04 (AI executive summary route/UI)
- `formatFechaCorta` is ready for 13-05/13-06/13-07 (detail page components) and for 13-07's swap of `oportunidades/page.tsx` to the shared import
- No blockers for downstream plans in this phase

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created files and all task commits verified present on disk / in git log.
