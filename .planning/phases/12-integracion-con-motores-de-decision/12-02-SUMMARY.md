---
phase: 12-integracion-con-motores-de-decision
plan: 02
subsystem: api
tags: [typescript, due-diligence, prc, zonificacion, prompt-engineering]

# Dependency graph
requires:
  - phase: 11-vista-de-zonificacion-en-el-proyecto
    provides: "proyectos.zona_* columns (zona_status, zona_usos_disponibles, zona_codigo, zona_nombre, zona_uperm, zona_uproh, zona_fuente_url) + fixMojibakeArcGIS() in lib/zonificacion-format.ts"
provides:
  - "FuenteHallazgo local union type (FuenteNormativa | 'PRC') in lib/due-diligence.ts"
  - "ProyectoContexto extended with destino_sii + zona_* fields"
  - "resolverRefNormativa() PRC branch resolving citations directly from project zone data"
  - "buildSynthesisPrompt() '## Zonificación (PRC)' prompt section (guarded, mojibake-fixed)"
  - "app/api/ai/due-diligence/route.ts ProyectoRow + proyectoContexto threaded with the same fields in lockstep"
affects: [due-diligence-report-ui, phase-12-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local union type extension (FuenteHallazgo = FuenteNormativa | 'PRC') instead of widening the shared FuenteNormativa type in normativa-retrieval.ts"
    - "Silent-drop-on-non-usable-zone: PRC citation is only pushed when zona_status==='encontrado' && zona_usos_disponibles===true, otherwise dropped via continue (never a half-built citation)"

key-files:
  created: []
  modified:
    - lib/due-diligence.ts
    - app/api/ai/due-diligence/route.ts

key-decisions:
  - "FuenteHallazgo kept local to lib/due-diligence.ts rather than extending FuenteNormativa in lib/normativa-retrieval.ts, so getArticuloById/getContextoNormativo/flagUnverifiedCita never need to handle a source they structurally can't resolve (re-confirms Phase 11 + this phase's research)."
  - "resolverRefNormativa() now takes proyecto as a second argument and branches on fuente==='PRC' BEFORE the FUENTES_VALIDAS check, leaving the OGUC/LGUC/DDU branch behaviorally identical to before (only reordered)."

patterns-established:
  - "Guard for PRC citation buildability: zona_status==='encontrado' && zona_usos_disponibles===true (matches the guard already used across Phase 10-11 for the Ñuñoa edge case)."

# Metrics
duration: ~10min
completed: 2026-07-30
---

# Phase 12 Plan 02: PRC Citation Resolution in Due Diligence Summary

**due-diligence.ts can now fundament a hallazgo by citing the project's actual PRC zone (fuente: 'PRC') resolved directly from proyectos.zona_* data, with a new local FuenteHallazgo type and a guarded '## Zonificación (PRC)' prompt section — never touching the curated OGUC/LGUC/DDU lookup path.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-30
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `FuenteHallazgo = FuenteNormativa | 'PRC'` added locally to `lib/due-diligence.ts`; `RefNormativa.fuente` widened to it
- `ProyectoContexto` extended with `destino_sii` + the 7 `zona_*` fields (all optional)
- `buildSynthesisPrompt()` injects a "## Zonificación (PRC) del proyecto" section (only when the zone is usable), with `fixMojibakeArcGIS()` applied to `zona_uperm`/`zona_uproh`/`zona_nombre` before injection, and updated instruction 4 + JSON example telling the model when/how to cite `fuente: "PRC"`
- `resolverRefNormativa()` now branches on `fuenteRaw === 'PRC'` before the existing `FUENTES_VALIDAS` check: builds a `verificado: true` citation directly from `proyecto.zona_codigo`/`zona_nombre`/`zona_fuente_url` when the zone is usable, silently drops the citation (via `continue`) otherwise — the OGUC/LGUC/DDU branch is byte-for-byte the same behavior as before, just reordered after the PRC check
- `app/api/ai/due-diligence/route.ts`'s `ProyectoRow` interface and the `proyectoContexto` object literal inside `procesar()` threaded with `destino_sii` + the same 7 `zona_*` fields in lockstep with `lib/due-diligence.ts`'s `ProyectoContexto` — `select('*')` already returned these columns, only the TS narrowing was missing

## Task Commits

Each task was committed atomically:

1. **Task 1: FuenteHallazgo, ProyectoContexto ampliado, rama PRC en resolverRefNormativa y prompt** - `e1e563d` (feat)
2. **Task 2: Enhebrar destino_sii + zona_* en el route de Due Diligence** - `ca3302e` (feat)

_Note: no plan-metadata commit yet — created as part of this same execution session, will be committed alongside STATE.md update._

## Files Created/Modified
- `lib/due-diligence.ts` - `FuenteHallazgo` type, `ProyectoContexto` extended, `seccionZonaProyecto()` helper, `resolverRefNormativa()` PRC branch, updated prompt instructions/JSON example
- `app/api/ai/due-diligence/route.ts` - `ProyectoRow` interface + `proyectoContexto` literal extended with `destino_sii` + `zona_*` fields

## Decisions Made
- Kept `FuenteHallazgo` as a plan-scoped local union type in `lib/due-diligence.ts` rather than widening `FuenteNormativa` in `lib/normativa-retrieval.ts` — this was an explicit constraint from the phase research/plan context (widening would force `getArticuloById`/`getContextoNormativo`/`flagUnverifiedCita` to structurally handle a PRC source they can't resolve).
- No new database work, no new npm dependencies — confirmed by plan scope and verified during execution.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `lib/due-diligence.ts` and `app/api/ai/due-diligence/route.ts` are ready to produce PRC-sourced hallazgos end-to-end for any project with a usable zone (`zona_status: 'encontrado'` + `zona_usos_disponibles: true`) and an AI-detected destino/uso mismatch.
- `components/proyecto/due-diligence-report.tsx` required zero changes (confirmed via `git diff --stat` — empty) since `CitaBadges` is already generic over `fuente`.
- `npx tsc --noEmit` and `npx eslint lib/due-diligence.ts app/api/ai/due-diligence/route.ts` both clean (one pre-existing unrelated error in `components/proyecto/pmo-panel.tsx` from the parallel 12-01 plan, out of scope for this plan).
- No live/manual smoke test of the PRC citation path was run in this session (would require an authenticated project with a usable zone and a document set that actually triggers a destino/uso mismatch via the AI synthesis) — recommend covering this in the phase's eventual checkpoint/manual verification pass.

---
*Phase: 12-integracion-con-motores-de-decision*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: e1e563d (Task 1 commit)
- FOUND: ca3302e (Task 2 commit)
- FOUND: lib/due-diligence.ts
- FOUND: app/api/ai/due-diligence/route.ts
- FOUND: .planning/phases/12-integracion-con-motores-de-decision/12-02-SUMMARY.md
