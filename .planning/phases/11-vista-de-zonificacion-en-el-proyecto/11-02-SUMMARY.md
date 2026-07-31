---
phase: 11-vista-de-zonificacion-en-el-proyecto
plan: 02
subsystem: api
tags: [arcgis, zonificacion, prc, next-route-handler, fallback-manual]

# Dependency graph
requires:
  - phase: 10-motor-de-zonificacion
    provides: "lib/zonificacion-comunas.ts registry (resolveComunaZonificacion, getComunasConCobertura) covering las-condes/providencia/vitacura/nunoa"
provides:
  - "lib/zonificacion-zonas.ts: fetchZonasDisponibles(comunaId) and fetchZonaDetalle(comunaId, zona) — live ArcGIS distinct-values and single-zone queries, no point geometry"
  - "GET /api/zonificacion/zonas: public, rate-limited route serving covered-comunas list and, per comuna, its live zone list"
affects: [11-08-manual-fallback-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "returnDistinctValues=true + returnGeometry=false ArcGIS query for listing zone codes within a comuna without needing a point/geocode"
    - "Public, unauthenticated, IP-rate-limited route pattern reused a second time (precedent: /api/zonificacion/lookup, itself precedented by /api/utils/uf)"

key-files:
  created:
    - lib/zonificacion-zonas.ts
    - app/api/zonificacion/zonas/route.ts
  modified: []

key-decisions:
  - "fetchZonaDetalle is exported but not yet wired into the route — Task 2's route only exposes the list endpoint per plan; the detail function is there for Plan 11-08 to call once it builds the two-step picker UI"
  - "usosDisponibles always comes from the registry config (comunaConfig.usosDisponibles), never inferred from uperm/uproh being empty — same discipline as Phase 10's lookup route, so Ñuñoa correctly reports 'usos no disponibles' regardless of manual vs automatic path"

patterns-established:
  - "Manual-fallback data layer is strictly additive: does not modify lib/zonificacion-comunas.ts or app/api/zonificacion/lookup/route.ts, only reads the existing registry"

# Metrics
duration: 2min
completed: 2026-07-30
---

# Phase 11 Plan 02: Zone-listing and zone-detail ArcGIS queries Summary

**Two pure ArcGIS query functions (distinct-values zone list, single-zone detail) plus a public GET /api/zonificacion/zonas route, giving ZONE-05's manual fallback a live, registry-backed comuna→zona picker data source.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-30T21:49:22Z
- **Completed:** 2026-07-30T21:51:36Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `lib/zonificacion-zonas.ts` exports `fetchZonasDisponibles(comunaId)` (ArcGIS `returnDistinctValues` query, no geometry) and `fetchZonaDetalle(comunaId, zona)` (single-zone verbatim usos permitidos/prohibidos), both reusing the Phase 10 comuna registry read-only and returning `null` (never throwing) on any failure or unknown comuna
- `GET /api/zonificacion/zonas` public route: no `?comuna=` returns the 4 covered comunas; `?comuna=<x>` returns that comuna's live zone list or a 404 with zero ArcGIS calls if uncovered
- Live-verified against the real ArcGIS FeatureServer: Las Condes returned 71 distinct real zone codes/names; an uncovered comuna (Temuco) short-circuited to 404 before any network call

## Task Commits

Each task was committed atomically:

1. **Task 1: ArcGIS distinct-values + zone-detail queries** - `54e05e3` (feat)
2. **Task 2: Public zonas route** - `983db08` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `lib/zonificacion-zonas.ts` - `fetchZonasDisponibles` and `fetchZonaDetalle`, pure server-side ArcGIS query functions built on the Phase 10 registry
- `app/api/zonificacion/zonas/route.ts` - Public GET route serving covered-comunas list (no params) and per-comuna zone list (`?comuna=`)

## Decisions Made
- None beyond what's captured in `key-decisions` above — plan followed exactly as written, no ambiguity encountered.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` and `npx eslint` were clean on both new files on the first pass. Live curl verification against the real ArcGIS FeatureServer succeeded on the first attempt for all three required cases (no-params, covered comuna, uncovered comuna). Pre-existing upstream mojibake in some ArcGIS text fields (e.g. "Ãreas Verdes") is visible in the Las Condes zone names — this is the same source-side encoding issue already flagged in Phase 10 (10-04-SUMMARY.md) as out of scope for this plan; carried forward as a Phase 11 UI awareness note for whichever plan renders these names.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 11-08 (manual fallback UI) can now build a two-step comuna→zona `<select>` cascade purely from this route, with zero static curation and zero coordinate/geocoding requirement.
- `fetchZonaDetalle` is ready to be wired into a follow-up route (or the same route via a `?zona=` param) once 11-08 needs zone-detail content, but that wiring was intentionally left out of this plan's scope (only Task 2's list route was specified).

---
*Phase: 11-vista-de-zonificacion-en-el-proyecto*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/zonificacion-zonas.ts
- FOUND: app/api/zonificacion/zonas/route.ts
- FOUND: 54e05e3
- FOUND: 983db08
