---
phase: 12-integracion-con-motores-de-decision
plan: 03
subsystem: api
tags: [openai, prompt-engineering, zonificacion, copiloto, next.js]

# Dependency graph
requires:
  - phase: 11-vista-de-zonificacion-en-el-proyecto
    provides: "proyectos.zona_* columns (zona_status, zona_usos_disponibles, zona_uperm, zona_uproh, zona_codigo, zona_nombre) populated live via automatic lookup and manual fallback; lib/zonificacion-format.ts's fixMojibakeArcGIS()"
provides:
  - "seccionZonificacion(p: Proyecto) helper in app/api/ai/copiloto/route.ts — guarded, mojibake-safe zonificación context injector"
  - "buildOgucPrompt() and buildChecklistPrompt() now include real PRC usos permitidos/prohibidos when the project's zone is utilizable"
affects: [copiloto, oguc-diagnostico, checklist-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded prompt-section helper pattern: zona_status === 'encontrado' && zona_usos_disponibles === true compound guard (never zona_status alone) before injecting zone text into an AI prompt — same guard already used across Phase 11 (compat checker, card UI)"

key-files:
  created: []
  modified:
    - app/api/ai/copiloto/route.ts

key-decisions:
  - "Scope kept literal to the requirement text: only buildOgucPrompt() and buildChecklistPrompt() gained the zonificación section; buildObservacionesPrompt() and buildEstimacionPrompt() deliberately left untouched, per 12-RESEARCH.md's Open Question 1 resolution — expanding to those two skills is future work, not this plan."

patterns-established:
  - "Guarded, mojibake-safe context-injection helper returning '' (not undefined/null) when data isn't utilizable, so it can be safely string-interpolated inline in a template literal with zero extra branching at the call site."

# Metrics
duration: 3min
completed: 2026-07-30
---

# Phase 12 Plan 03: Copiloto Zonificación Integration Summary

**Copiloto's OGUC diagnostic and checklist-generation AI prompts now receive the project's real PRC usos permitidos/prohibidos text (mojibake-repaired) whenever a usable zone lookup exists, via a new guarded `seccionZonificacion()` helper.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-30T23:18:00Z
- **Completed:** 2026-07-30T23:21:03Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `seccionZonificacion(p: Proyecto): string` added to `app/api/ai/copiloto/route.ts`, guarded by the compound `zona_status === 'encontrado' && zona_usos_disponibles === true` condition (returns `''` for pending/sin_cobertura/error/no-usos-disponibles cases — e.g. Ñuñoa, which has `zona_status:'encontrado'` but `zona_usos_disponibles:false`)
- `fixMojibakeArcGIS()` applied to `zona_uperm`/`zona_uproh`/`zona_nombre` before injection, consistent with the mojibake-safety pattern established in Phase 11
- Injected into `buildOgucPrompt()` (after the `## Datos del proyecto` block) and `buildChecklistPrompt()` (after the `## Proyecto` block)
- `buildObservacionesPrompt()` and `buildEstimacionPrompt()` left completely unmodified — confirmed via `git diff`

## Task Commits

1. **Task 1: seccionZonificacion() en buildOgucPrompt y buildChecklistPrompt** - `b3f5c13` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `app/api/ai/copiloto/route.ts` - Added `fixMojibakeArcGIS` import, `seccionZonificacion(p)` helper, and its interpolation into `buildOgucPrompt()`/`buildChecklistPrompt()` template strings

## Decisions Made
- None beyond what the plan already specified — followed plan as specified, including the deliberate 2-of-4-skills scope boundary.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Shared working-tree race condition with parallel Wave-1 plans (not a bug in this plan's code, but worth recording):** this repo has no per-agent git worktree isolation — three Wave-1 plans (12-01, 12-02, 12-03) execute concurrently against the same working directory and git index. My first `git commit` (without an explicit pathspec) unintentionally swept up `components/proyecto/via-decision.tsx` (plan 12-01's in-progress, uncommitted work) because it had been staged by the other agent in the moment between my `git add` and `git commit`. Caught immediately via `git show --stat HEAD`, fixed with `git reset --soft HEAD~1` + `git restore --staged components/proyecto/via-decision.tsx` + a re-commit using an explicit `-- app/api/ai/copiloto/route.ts` pathspec. Final commit (`b3f5c13`) contains only this plan's file (`1 file changed, 12 insertions(+), 2 deletions(-)`). Other files' unstaged/staged state was left as found for their respective agents. **Recommendation for the orchestrator:** future parallel Wave executions should either use `git worktree` per plan, or every executor should always commit with an explicit pathspec (never a bare `git commit` relying on whatever happens to be staged) to avoid this class of cross-contamination.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- INTEG-03 complete. Copiloto's OGUC and checklist skills now reason with real zonificación text when available, with zero prompt change for projects lacking a usable zone.
- No blockers for the remaining Wave-1 plans (12-01, 12-02) or any later Phase 12 plan — this plan touched only `app/api/ai/copiloto/route.ts`, no shared types or schema changed.

---
*Phase: 12-integracion-con-motores-de-decision*
*Completed: 2026-07-30*

## Self-Check: PASSED
- FOUND: .planning/phases/12-integracion-con-motores-de-decision/12-03-SUMMARY.md
- FOUND: commit b3f5c13
- FOUND: 3 occurrences of seccionZonificacion in app/api/ai/copiloto/route.ts (definition + 2 call sites)
