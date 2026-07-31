---
phase: 11-vista-de-zonificacion-en-el-proyecto
plan: 07
subsystem: ui
tags: [react, nextjs, leaflet, zonificacion, prc]

# Dependency graph
requires:
  - phase: 11-vista-de-zonificacion-en-el-proyecto
    provides: "Plan 11-01 (types/index.ts zona_* fields + lib/zonificacion-format.ts mojibake fix), Plan 11-04 (components/proyecto/zonificacion-mapa.tsx presentational map), Plan 11-06 (GET/POST /api/proyectos/[id]/zonificacion, zona_codigo persisted server-side)"
provides:
  - "components/proyecto/zonificacion-disclaimer.tsx — always-on CIP disclaimer (ZONE-06)"
  - "components/proyecto/zonificacion-card.tsx — full 4-state ZonificacionCard exported as ZonificacionCard"
  - "ZonificacionCard wired into app/(dashboard)/proyectos/[id]/page.tsx Resumen tab, right column, below PredioMap"
affects: [11-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy polygon fetch pattern: card renders zone text/usos from proyecto.zona_* (already on the payload) with zero extra fetch, but fetches only the heavier geometry via GET /api/proyectos/[id]/zonificacion in a useEffect keyed on [proyecto.id, proyecto.zona_consultada_el] — so 'Actualizar' (which bumps zona_consultada_el server-side) re-triggers the polygon fetch even though proyecto.id never changes."
    - "Explicit non-collapsing 3+1 status UI: zona_status renders one of pendiente/sin_cobertura/error/encontrado as fully distinct blocks, never inferred from nullability."
    - "Citation trust-axis separation: PRC source link/no-link text uses a plain <a>/<p>, deliberately not reusing EstadoNormativo's verificado pill styling, to avoid implying OGUC/LGUC-curated-database-level trust for ArcGIS-sourced zone data."

key-files:
  created:
    - components/proyecto/zonificacion-disclaimer.tsx
    - components/proyecto/zonificacion-card.tsx
  modified:
    - "app/(dashboard)/proyectos/[id]/page.tsx"

key-decisions:
  - "Followed plan's pre-applied plan-checker fixes exactly: zona_codigo rendered alongside nombre/sector, and the polygon-fetch useEffect depends on [proyecto.id, proyecto.zona_consultada_el] (not just proyecto.id) so Actualizar refreshes the map, not just the text."
  - "ZonificacionCard positioned inside the existing DD-verification-gated Tabs/Resumen right column, same conditional gate on proyecto.direccion as PredioMap — no new/earlier visibility surface, matching 11-RESEARCH.md's Open Question 1 resolution."

patterns-established:
  - "Cards that need both a cheap always-available payload (proyecto.zona_*) and an expensive lazy one (polygon geometry) split the fetch: render immediately from props, fetch the heavy part separately, keyed on a server-bumped timestamp field rather than the parent id, to survive 'refresh in place' actions."

# Metrics
duration: 15min
completed: 2026-07-30
---

# Phase 11 Plan 07: ZonificacionCard automatic-path UI Summary

**ZonificacionCard component with 4-state zone display (código+nombre, mapa, usos verbatim, citation, always-on CIP disclaimer, Actualizar action) wired into the proyecto detail page's Resumen tab**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-30T18:16:52-04:00 (immediately after 11-06's last commit)
- **Completed:** 2026-07-30T18:18:33-04:00 (task commits) + verification pass
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `ZonificacionDisclaimer` — static, always-rendered, exact ZONE-06 required text.
- `ZonificacionCard` — renders all 4 `zona_status` states (`pendiente`/`sin_cobertura`/`error`/`encontrado`), shows `zona_codigo` + `zona_nombre` + `zona_sector` (ZONE-01), embeds `ZonificacionMapa` fed by a lazy `GET /api/proyectos/[id]/zonificacion` fetch (ZONE-02), shows mojibake-corrected `zona_uperm`/`zona_uproh` text with an explicit "no disponible" fallback (ZONE-03), shows a source citation with explicit no-link treatment when `zona_fuente_url` is absent, and wires the "Actualizar" button through the Plan 11-06 `POST` route with a spinner + toast + full-page state refresh (ZONE-04, partial — manual fallback is 11-08's job).
- Card wired into `app/(dashboard)/proyectos/[id]/page.tsx`, right column of the Resumen tab, directly below the existing `PredioMap` card, same `proyecto.direccion` gate.
- Fixed the plan-checker-identified bug proactively (was already baked into the plan's code): the polygon-fetch `useEffect` depends on `[proyecto.id, proyecto.zona_consultada_el]`, so clicking Actualizar (which bumps `zona_consultada_el` server-side via Plan 11-06's `persistZonificacionParaProyecto`) re-fetches and re-renders the map, not just the zone text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Disclaimer + ZonificacionCard** - `2142d9a` (feat)
2. **Task 2: Wire ZonificacionCard into the proyecto detail page** - `b994878` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `components/proyecto/zonificacion-disclaimer.tsx` - Static always-on CIP disclaimer (ZONE-06)
- `components/proyecto/zonificacion-card.tsx` - Full ZonificacionCard: status states, map, usos, citation, Actualizar action
- `app/(dashboard)/proyectos/[id]/page.tsx` - Import + render `ZonificacionCard` below `PredioMap`, gated on `proyecto.direccion`, `onUpdated` wired to existing `setProyecto`

## Decisions Made
None beyond what the plan already specified — both plan-checker fixes (zona_codigo rendering, useEffect dependency array) were pre-written into the plan's code blocks and followed exactly as given.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

No authenticated browser session was available in this environment to click through the full manual verification flow (open a Las Condes project, click Actualizar, watch the map refresh) — this is the same standing environment limitation logged in 11-01/11-03/11-05/11-06 (dev-mode middleware bypass does not extend to this repo's routes, which call `supabase.auth.getUser()` directly). Compensating verification performed instead:
- `npx tsc --noEmit` clean across the whole project.
- `npx eslint` clean on both new files and the modified page (only pre-existing, unrelated warnings remain on the page file — `cn` unused, `setState`-in-effect x3, impure `Date.now()` in render — none introduced by this plan's changes, out of scope per deviation rules' scope boundary).
- `grep` confirmed the disclaimer's exact required string.
- Started a real dev server (`npm run dev`, port 3000) and requested `/proyectos/00000000-0000-0000-0000-000000000000` directly: page compiled (`○ Compiling /proyectos/[id] ...`) and returned HTTP 200 with no crash/error-page markers in the response body, confirming `ZonificacionCard`'s import graph (including the dynamic `leaflet` import inside `ZonificacionMapa`) resolves cleanly under SSR with no runtime throw.
Recommend the next authenticated manual smoke test (already flagged for 10-05/11-03) also cover: opening a covered-comuna project and confirming the map visibly re-renders after clicking Actualizar, not just the zone text.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
Plan 11-08 (ZONE-05 manual fallback picker + COMPAT-01 compatibility checker UI) can now build directly on top of this card — the POST route it will extend already round-trips through `ZonificacionCard`'s `handleActualizar`/`refetchProyecto` pattern, and the polygon-refresh dependency fix means a manual zone pick (which also bumps `zona_consultada_el` via Plan 11-06's route) will correctly refresh the map without any extra plumbing.

## Self-Check: PASSED

All created/modified files and both task commit hashes verified present.

---
*Phase: 11-vista-de-zonificacion-en-el-proyecto*
*Completed: 2026-07-30*
