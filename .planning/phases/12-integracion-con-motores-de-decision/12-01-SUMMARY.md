---
phase: 12-integracion-con-motores-de-decision
plan: 01
subsystem: ui
tags: [react, nextjs, typescript, zonificacion, via-tramitacion]

# Dependency graph
requires:
  - phase: 11-vista-de-zonificacion-en-el-proyecto
    provides: "POST /api/proyectos/[id]/compatibilidad (COMPAT-01, lib/zonificacion-compat.ts's verificarCompatibilidadUso), proyecto.zona_* fields"
provides:
  - "INTEG-01: alerta citada de incompatibilidad de uso en ViaDecision, automática, sin acción del usuario"
  - "ViaDecision({ proyecto: Proyecto }) — signature change from individual proyectoId/destinoSii props"
affects: [12-02-due-diligence, 12-03-copiloto, phase-12-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third silent/cancelled-flag useEffect mirroring the two pre-existing ones in ViaDecision — background fetch, never persisted, gated by a compound condition (zona_status + zona_usos_disponibles + destino_sii) instead of a single field"
    - "Type-only import (import type { CompatEstado }) from a lib/ module that has a value-level dependency on server-only code (lib/ai.ts), to avoid bundling it into a \"use client\" component"

key-files:
  created: []
  modified:
    - components/proyecto/via-decision.tsx
    - components/proyecto/pmo-panel.tsx

key-decisions:
  - "ViaDecision now receives the full proyecto: Proyecto object (was proyectoId/destinoSii individually) — consistent with how PmoPanel already threads proyecto to PlazoLey21718Card"
  - "Compatibility check gated on zona_status==='encontrado' && zona_usos_disponibles===true (never zona_status alone) — avoids a false-positive fetch/alert for the Ñuñoa case where zona_status is 'encontrado' but there's no usos text to compare"
  - "lib/via-tramitacion.ts (recomendarVia/pasoSiguiente) deliberately untouched — the new alert lives entirely as separate component state (compat), outside rec, never merged into ViaRecomendada"

# Metrics
duration: ~10min
completed: 2026-07-30
---

# Phase 12 Plan 01: Alerta citada de incompatibilidad de uso en ViaDecision Summary

**ViaDecision gains a third silent useEffect that calls the existing COMPAT-01 endpoint and renders a citable AlertTriangle warning when the project's declared destino_sii doesn't match the zone's permitted uses — zero changes to the deterministic via-tramitacion.ts engine.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- INTEG-01 implemented: automatic, citation-backed use-incompatibility alert on the vía de tramitación screen, with zero manual action from the architect
- `ViaDecision` signature migrated from `{ proyectoId, destinoSii }` to `{ proyecto: Proyecto }`, matching the rest of the file's props pattern
- `PmoPanel` updated to pass the full `proyecto` object
- `lib/via-tramitacion.ts` and `tests/unit/via-tramitacion.test.ts` confirmed byte-for-byte unchanged (`git diff` empty on both), 14 existing unit tests still pass unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Tercer useEffect + alerta citada en ViaDecision** - `452ec57` (feat)
2. **Task 2: Wiring en PmoPanel** - `374eff1` (feat)

_Note: this plan ran in parallel (Wave 1) alongside 12-02 and 12-03 in the same shared working tree (no git worktree isolation). One transient race was observed and resolved — see Issues Encountered._

## Files Created/Modified
- `components/proyecto/via-decision.tsx` - `ViaDecision({ proyecto })`; new `compat` state + third `useEffect` calling `POST /api/proyectos/[id]/compatibilidad` when the zone is usable and `destino_sii` is set; new alert block (AlertTriangle + citation, mirroring `zonificacion-card.tsx`'s citation pattern) rendered only when `compat?.estado === "no_permitido"`
- `components/proyecto/pmo-panel.tsx` - `<ViaDecision proyecto={proyecto} />` replacing the two individual props

## Decisions Made
- Reused the existing `POST /api/proyectos/[id]/compatibilidad` route as-is (built in Phase 11) — no new compatibility-checking mechanism was built, per plan constraint
- Used a type-only import of `CompatEstado` from `lib/zonificacion-compat.ts` to keep the client bundle from pulling in `lib/ai.ts` (which that module imports at value level)
- Dependency array `[proyecto.id, proyecto.destino_sii, proyecto.zona_status, proyecto.zona_usos_disponibles]` is the cheap re-fetch guard requested by the plan — the effect only re-runs when one of those four fields actually changes, not on every render

## Deviations from Plan

None — plan executed exactly as written. All code matches the plan's provided snippets verbatim (component signature, new state, third `useEffect`, alert JSX, `PmoPanel` call-site change).

## Issues Encountered

**Transient git race during parallel execution (process issue, not a code issue).** This plan ran concurrently with 12-02 and 12-03 in the same non-worktree-isolated repo. After staging and committing Task 1's `via-decision.tsx` changes, a `git log`/`git show HEAD` check briefly showed those changes folded into a *different* Wave-1 plan's commit (`71130b4`, 12-03's) — apparently caused by an overlapping `git add`/`git commit` from another concurrent executor process picking up my already-staged file before my own `git commit` ran. A follow-up `git status`/`git diff HEAD` a few seconds later showed the repo had moved on (HEAD had advanced past that transient commit to 12-02's and 12-03's own final commits) and my `via-decision.tsx` changes were back to being uncommitted working-tree modifications — nothing was lost. Re-ran `git commit components/proyecto/via-decision.tsx -m "..."` directly (pathspec form, no prior `git add` needed) and verified via `git log --oneline -- components/proyecto/via-decision.tsx` and `git diff HEAD -- components/proyecto/via-decision.tsx` (empty) that the change landed cleanly in its own commit (`452ec57`), containing only this plan's intended diff (67 insertions, 7 deletions — matches the task's scope). No code was lost or corrupted; the two other plans' commits (12-02 `e1e563d`, 12-03 `b3f5c13`) do not touch `via-decision.tsx` or `pmo-panel.tsx`. **Flag for the orchestrator:** parallel Wave-1 execution without git worktree isolation carries a real (if self-healing in this instance) risk of one plan's changes being silently absorbed into another plan's commit message/attribution when their `git add`/`git commit` calls interleave — worth considering per-plan worktrees for future waves with true file-disjoint parallel plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- INTEG-01 is fully live: any project with a resolved, usable zone (`zona_status='encontrado'`, `zona_usos_disponibles=true`) and a non-empty `destino_sii` will now surface the citation-backed incompatibility alert automatically the moment `ViaDecision` mounts, with no regression to the deterministic vía-de-tramitación tree.
- No blockers for 12-04 (phase checkpoint) — `git diff lib/via-tramitacion.ts` and `git diff tests/unit/via-tramitacion.test.ts` both confirmed empty, satisfying the phase-level non-regression requirement this plan owns.
- Manual/browser verification of the live alert (real project with a zone/destino_sii mismatch) was not performed in this run — recommend covering it in the same authenticated dev-login (`BYPASS_AUTH=true`) smoke pass used to close out Phase 11, since that mechanism is confirmed working in this codebase.

---
*Phase: 12-integracion-con-motores-de-decision*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: components/proyecto/via-decision.tsx
- FOUND: components/proyecto/pmo-panel.tsx
- FOUND: .planning/phases/12-integracion-con-motores-de-decision/12-01-SUMMARY.md
- FOUND: commit 452ec57 (Task 1)
- FOUND: commit 374eff1 (Task 2)
