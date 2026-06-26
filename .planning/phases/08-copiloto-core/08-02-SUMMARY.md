---
phase: 08-copiloto-core
plan: "02"
subsystem: ui
tags: [react, sheet, base-ui, state-machine, gpt4o, optimistic-update, lucide-react, tailwind]

# Dependency graph
requires:
  - phase: 08-copiloto-core
    plan: "01"
    provides: POST /api/ai/copiloto returning oguc/observaciones/checklist/estimacion, PATCH /api/ai/copiloto/checklist/[itemId]
  - phase: 07-foundation
    plan: "03"
    provides: Sheet component backed by @base-ui/react/dialog
provides:
  - CopilotoTrigger — thin button with Bot icon that calls onClick(proyecto) prop
  - CopilotoDrawer — Sheet drawer with idle skill-card grid → loading → loaded state machine, per-project cache
  - TabOguc — OGUC article diagnostics with cumple indicators and formula display
  - TabObservaciones — prediction cards with riesgoGlobal badge and frecuencia dots
  - TabChecklist — progress bar + optimistic toggle buttons calling PATCH /api/ai/copiloto/checklist/[itemId]
  - TabEstimacion — plazo (min-max días hábiles) + derechos (CLP + UF) + recomendación cards
affects: [08-03-integration, pages-permisos, pages-patentes, pages-proyectos-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idle state with 4 skill cards — drawer never blank; user always sees actionable options"
    - "State machine idle→loading→loaded→error via useState<DrawerState>"
    - "Per-project cache as Map<string,CopilotoResult> in useState — survives re-renders, resets on navigation"
    - "Plain controlled <button> tab nav with cn() active state — NO shadcn Tabs component"
    - "Optimistic toggle in TabChecklist: update parent via onToggle callback, revert on PATCH failure"
    - "All result types exported from copiloto-drawer.tsx for use in tab components"

key-files:
  created:
    - components/copiloto/copiloto-trigger.tsx
    - components/copiloto/copiloto-drawer.tsx
    - components/copiloto/tabs/tab-oguc.tsx
    - components/copiloto/tabs/tab-observaciones.tsx
    - components/copiloto/tabs/tab-checklist.tsx
    - components/copiloto/tabs/tab-estimacion.tsx
  modified:
    - components/copiloto/copiloto-drawer.tsx
    - components/copiloto/tabs/tab-checklist.tsx

key-decisions:
  - "Idle state shows 4 skill cards (not blank) — user picks which analysis to run first, card click triggers loading"
  - "handleOpenChange resets drawerState to idle and clears result on close, but NOT the cache — instant re-load on reopen same project"
  - "All interfaces (OgucResult, ObservacionesResult, ChecklistResult, EstimacionResult, CopilotoResult) exported from copiloto-drawer.tsx so tab components import from single source of truth"
  - "ChecklistItem.estado typed as 'pendiente' | 'ok' union (strict), propagated through onToggle callback type"
  - "Optimistic toggle: parent (drawer) owns checklist state, tab calls onToggle(itemKey, newEstado) for instant UI update + cache sync"

patterns-established:
  - "Copiloto component hierarchy: Trigger (thin) → Drawer (state machine) → Tab components (pure presentational + checklist toggle)"
  - "Bot icon from lucide-react used as visual identity marker for all Copiloto UI"
  - "SheetDescription renders proyecto.nombre + municipio as subtitle below SheetTitle"

# Metrics
duration: 20min
completed: 2026-06-25
---

# Phase 8 Plan 02: Copiloto UI Components Summary

**Sheet drawer with 4-skill idle card grid, idle→loading→loaded→error state machine, per-project result cache, and 4 analysis tab components (OGUC diagnostics, observation predictions, checklist with optimistic toggles, plazo/derechos estimacion)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-25T00:20:00Z
- **Completed:** 2026-06-25T00:40:00Z
- **Tasks:** 2
- **Files modified:** 6 (all component files)

## Accomplishments
- CopilotoDrawer: idle state shows 4 clickable skill cards, card click triggers POST /api/ai/copiloto, results displayed in 4 tabs with plain button tab nav
- Per-project cache (`Map<string,CopilotoResult>`) prevents re-fetching when switching tabs or reopening same project
- TabChecklist: optimistic state updates via parent callback pattern, PATCH call with revert on failure
- All TypeScript strict — no `any`, `ChecklistItem.estado` is `'pendiente' | 'ok'` union (not string)
- Zero TypeScript compilation errors (`npx tsc --noEmit` exits 0)

## Task Commits

1. **Task 1+2: CopilotoTrigger + CopilotoDrawer + 4 tab components** - `a8576f7` (feat — prior session)
2. **Task 1 fix: Drawer idle skill cards + strict types** - `18eaa75` (feat(08-02))

## Files Created/Modified
- `components/copiloto/copiloto-trigger.tsx` — Thin Button with Bot icon, onClick(proyecto) prop, no internal state
- `components/copiloto/copiloto-drawer.tsx` — Sheet drawer: idle→loading→loaded→error state machine, 4 skill cards on idle, Map cache, plain button tab nav, exports all result interfaces
- `components/copiloto/tabs/tab-oguc.tsx` — OGUC articles: CheckCircle2/XCircle/Minus cumple indicators, formula + normativa + proyecto values in grid
- `components/copiloto/tabs/tab-observaciones.tsx` — Observation predictions: riesgoGlobal badge, frecuencia dots, trigger + accion preventiva per card
- `components/copiloto/tabs/tab-checklist.tsx` — Progress bar + optimistic toggle buttons, calls PATCH /api/ai/copiloto/checklist/[itemId], typed 'pendiente'|'ok'
- `components/copiloto/tabs/tab-estimacion.tsx` — Plazo min-max card, derechos CLP+UF card, advertencias block, recomendación block

## Decisions Made
- Idle state shows 4 skill cards rather than blank/auto-loading — makes the Copiloto feature immediately discoverable and shows user all 4 analysis options
- All result interfaces centralized in `copiloto-drawer.tsx` (single source of truth) — tabs import types from drawer, not from separate types file
- `ChecklistItem.estado` typed as `'pendiente' | 'ok'` union throughout — prevents invalid estado values from reaching the PATCH endpoint
- Optimistic update pattern: drawer owns checklist state, tab calls `onToggle(itemKey, newEstado)` callback which updates result + cache atomically

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Idle state showed blank message instead of 4 skill cards**
- **Found during:** Task 1 verification
- **Issue:** Prior implementation auto-triggered `runAnalysis` on `handleOpenChange(true)` — idle state showed "Selecciona un proyecto" bot icon, not skill cards. Violated plan `must_haves` truth: "On open, the drawer shows 4 skill task cards (idle state) — never a blank input"
- **Fix:** Rewrote `copiloto-drawer.tsx` with correct idle→card-click→loading→loaded flow. Added `SKILL_CARDS` array and 4-card grid in idle state. Removed auto-run-on-open logic.
- **Files modified:** `components/copiloto/copiloto-drawer.tsx`
- **Verification:** Grep confirms idle state card grid present, `tsc --noEmit` exits 0
- **Committed in:** `18eaa75`

**2. [Rule 1 - Bug] ChecklistItem.estado typed as string instead of 'pendiente'|'ok'**
- **Found during:** Rewrite of drawer (strict types review)
- **Issue:** `ChecklistItem.estado: string` in prior implementation allowed any string through optimistic updates and PATCH body
- **Fix:** Changed to `estado: 'pendiente' | 'ok'` union in `ChecklistResult` interface; updated `onToggle` callback type in `TabChecklist` to match
- **Files modified:** `components/copiloto/copiloto-drawer.tsx`, `components/copiloto/tabs/tab-checklist.tsx`
- **Verification:** TypeScript enforces the union at call sites, `tsc --noEmit` exits 0
- **Committed in:** `18eaa75`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes required for plan correctness. No scope creep.

## Issues Encountered
- Files were pre-created in a prior commit (`a8576f7`) with a slightly different state machine (auto-run vs card-click). Rewrote drawer to match plan spec while preserving all superior UI decisions (better visual design, retry button, etc.)

## User Setup Required
None — no external service configuration required for the UI layer.

## Next Phase Readiness
- All 6 component files committed and TypeScript-clean
- CopilotoTrigger ready to wire into pages (08-03)
- CopilotoDrawer ready to mount in layout or page with `open`/`proyecto`/`onClose` props
- No blockers

## Self-Check: PASSED
- `components/copiloto/copiloto-trigger.tsx` — FOUND
- `components/copiloto/copiloto-drawer.tsx` — FOUND
- `components/copiloto/tabs/tab-oguc.tsx` — FOUND
- `components/copiloto/tabs/tab-observaciones.tsx` — FOUND
- `components/copiloto/tabs/tab-checklist.tsx` — FOUND
- `components/copiloto/tabs/tab-estimacion.tsx` — FOUND
- Commit `18eaa75` — FOUND
- `npx tsc --noEmit` — EXIT 0

---
*Phase: 08-copiloto-core*
*Completed: 2026-06-25*
