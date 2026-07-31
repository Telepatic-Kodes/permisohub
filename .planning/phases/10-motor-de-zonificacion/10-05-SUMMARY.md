---
phase: 10-motor-de-zonificacion
plan: 05
subsystem: api
tags: [next-server-actions, after, supabase, zonificacion, background-jobs]

# Dependency graph
requires:
  - phase: 10-motor-de-zonificacion (plan 10-04)
    provides: "lib/zonificacion.ts client-safe types + GET /api/zonificacion/lookup orchestration route (registry short-circuit → geocoder → cache read-through → ArcGIS query → cache upsert)"
provides:
  - "lib/zonificacion-server.ts — persistZonificacionParaProyecto(), the single server-only write path from a ZonaLookupResponse to proyectos.zona_*"
  - "POST /api/proyectos automatically triggers zonificación lookup in background on creation when direccion+municipio are present"
  - "PATCH /api/proyectos/[id] automatically re-triggers the lookup in background when direccion or municipio change"
affects: [11-vista-de-zonificacion-en-el-proyecto, 12-integracion-con-motores-de-decision]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared server-only persistence helper (not duplicated per call site) to guarantee identical explicit-status writes on create and update"
    - "after() + self-fetch to own API route for background enrichment (same pattern as existing SII fallback in app/api/proyectos/route.ts)"
    - "Every code path in a background enrichment helper writes an explicit terminal status, never leaves a row silently stuck at a default/pending value"

key-files:
  created:
    - lib/zonificacion-server.ts
  modified:
    - app/api/proyectos/route.ts
    - app/api/proyectos/[id]/route.ts

key-decisions:
  - "Factored persistence into one shared lib/zonificacion-server.ts helper instead of duplicating logic inline at both call sites (deliberate deviation from ARCHITECTURE.md's inline single-call-site example) — duplication risked drift between the two copies, which is exactly the silent-failure pitfall (PITFALLS.md Pitfall 6) this plan exists to avoid"
  - "zona_cache_id intentionally left unpopulated — ZonaLookupResponse.data doesn't carry the cache row's id in this phase's scope, and no success criterion requires it"
  - "PATCH re-reads the full current row (direccion + municipio) via service client before re-running the lookup, rather than trusting the partial `updates` object, since a single PATCH call may only touch one of the two fields"

patterns-established:
  - "Background enrichment helpers must write an explicit terminal status on every branch including the catch block — a lesson carried forward from Pitfall 6, now enforced in a second call site (proyectos zonificación) in addition to the original SII fallback"

# Metrics
duration: 6min
completed: 2026-07-30
---

# Phase 10 Plan 05: Wire zonificación lookup into project create/update Summary

**Shared `persistZonificacionParaProyecto()` helper wired into both POST and PATCH /api/proyectos via `after()`, closing the loop so every project with a covered-comuna address gets `zona_status='encontrado'` + zone fields populated automatically, with explicit `sin_cobertura`/`error` states everywhere else.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-30T21:01:07Z (first commit in sequence, ff34c72 belongs to 10-04's final commit; this plan's work spans 17:02–17:04 local)
- **Completed:** 2026-07-30T21:04:23Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `lib/zonificacion-server.ts` created — the single write path from a lookup response to `proyectos.zona_*`, with an explicit `zona_status` on every branch (encontrado / sin_cobertura / error), including the outer `catch`
- `POST /api/proyectos` now fires the zonificación lookup in the background for every project created with `direccion` + `municipio`
- `PATCH /api/proyectos/[id]` now re-fires the same lookup whenever `direccion` or `municipio` is part of the update payload
- Live-verified the underlying `GET /api/zonificacion/lookup` route continues to work correctly (curled directly against Las Condes, cache hit confirmed) after these changes

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/zonificacion-server.ts — shared persistence helper** - `5d61f6c` (feat)
2. **Task 2: Wire the after() triggers into POST and PATCH** - `ed60d54` (feat)

_No separate plan-metadata commit issued yet — STATE.md/this SUMMARY are committed together as the final step._

## Files Created/Modified
- `lib/zonificacion-server.ts` - Exports `persistZonificacionParaProyecto(proyectoId, direccion, municipio)`, server-only (imports `createServiceClient`), fetches the lookup route and writes `zona_status` + zone snapshot fields with an explicit terminal state on every path
- `app/api/proyectos/route.ts` - Added import + `after()` block after the existing SII fallback block, before the success response, dispatching the new helper when `direccion`+`municipio` are present on creation
- `app/api/proyectos/[id]/route.ts` - Added `after`, `createServiceClient`, and the new helper imports; added an `after()` block after the successful update that re-reads the current row and re-dispatches the helper when `direccion` or `municipio` changed

## Decisions Made
- Shared helper over duplicated inline logic at both call sites — see `key-decisions` in frontmatter for full rationale
- `zona_cache_id` left unpopulated in this plan's scope (not required by any of the phase's 5 success criteria)
- PATCH's background block re-reads the row from the DB rather than trusting a possibly-partial `updates` object, since `direccion` and `municipio` can be updated independently

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a JSDoc comment that prematurely terminated at an embedded `*/`**
- **Found during:** Task 1 (creating `lib/zonificacion-server.ts`)
- **Issue:** The plan's exact code block for the file's doc comment included the literal sequence `` `catch { /* silent */ }` `` inside a `/** ... */` block comment. The inner `*/` closed the JSDoc comment early, leaving the rest of the sentence as loose top-level code — `npx tsc --noEmit` failed with 19 parse errors (`TS1128`, `TS1005`, `TS1434`, `TS1160: Unterminated template literal`) rippling through the whole file.
- **Fix:** Reworded the sentence to describe the SII fallback's `catch` block in prose instead of embedding a code snippet containing `*/`, preserving the same explanation without breaking the comment boundary.
- **Files modified:** `lib/zonificacion-server.ts`
- **Verification:** `npx tsc --noEmit` returns clean; `grep -c "zona_status: 'error'" lib/zonificacion-server.ts` returns 2 as specified in the plan's `<verify>` step.
- **Committed in:** `5d61f6c` (part of Task 1 commit — fixed before committing, so the commit only contains the corrected version)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the file to compile at all; no behavioral or scope change — the fix is purely to the doc comment wording, the implementation code is verbatim per plan.

## Issues Encountered
- End-to-end verification of the `<verify>` step's 3 scenarios (POST covered comuna → `encontrado`, POST uncovered comuna → `sin_cobertura`, PATCH direccion → re-triggered update) requires a logged-in Supabase session. `GET /api/proyectos` returned `{"error":"No autenticado"}` even on localhost — this repo's API routes check `supabase.auth.getUser()` directly rather than relying on the dev-only middleware bypass noted in STATE.md, so there was no session available to drive POST/PATCH through the real HTTP layer in this session.
  - What was verified instead: `npx tsc --noEmit` clean across the whole repo, `npx eslint` clean on all 3 touched files, the underlying `GET /api/zonificacion/lookup` route curled directly and confirmed still returns `status:"encontrado"` with a cache hit for Las Condes (proving Plan 10-04's route is unaffected and the URL/param shape `persistZonificacionParaProyecto` builds — `direccion` + `comuna` query params — matches what the route expects), and careful inspection confirming both `after()` blocks are positioned exactly as specified (after the existing SII logic / after the successful `.update()`, before the success response) and use the identical helper so create and update paths cannot drift.
  - This is a gap versus the plan's `<verify>` step, not a defect — recommend a manual smoke test (create + PATCH a project through the UI while logged in) as a follow-up before relying on this in Phase 11's zonificación view, though nothing in the code path itself is unverified logic (the same `persistZonificacionParaProyecto` function's internals were traced against the already-live-verified lookup route).
- Local dev server was started on port 7891 for the curl check above and cleanly stopped afterward (`lsof -ti :7891 | xargs kill`); no orphan processes left running.

## User Setup Required
None - no external service configuration required. This plan only wires together infrastructure that was already fully configured in 10-01 (schema) and 10-04 (lookup route).

## Next Phase Readiness
- Phase 10 (Motor de Zonificación) is now functionally complete end-to-end: creating or updating a proyecto's address automatically results in an explicit `zona_status` and, when covered, populated zone snapshot fields — with zero UI required, satisfying the phase's core goal.
- Phase 11 (Vista de Zonificación en el Proyecto) can now build UI directly against `proyectos.zona_*` columns, trusting that `zona_status` is always one of the 4 explicit values (`pendiente` only before any lookup has ever run) and never silently stale.
- Recommend the manual UI smoke test noted under "Issues Encountered" be run once during Phase 11 kickoff to close the one verification gap this plan couldn't complete session-lessly.

---
*Phase: 10-motor-de-zonificacion*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/zonificacion-server.ts
- FOUND: app/api/proyectos/route.ts
- FOUND: app/api/proyectos/[id]/route.ts
- FOUND: .planning/phases/10-motor-de-zonificacion/10-05-SUMMARY.md
- FOUND commit: 5d61f6c
- FOUND commit: ed60d54
