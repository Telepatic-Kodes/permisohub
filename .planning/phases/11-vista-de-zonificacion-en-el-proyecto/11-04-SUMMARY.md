---
phase: 11-vista-de-zonificacion-en-el-proyecto
plan: 04
subsystem: ui
tags: [leaflet, openstreetmap, csp, react, nextjs, geojson]

# Dependency graph
requires:
  - phase: 10-motor-de-zonificacion
    provides: "ZonaData/ZonaPolygon-shaped lookup response (lat/lng + geometria) that this component's props mirror"
provides:
  - "ZonificacionMapa presentational component ready to import with real data"
  - "leaflet + @types/leaflet as the milestone's one new frontend dependency"
  - "CSP img-src extended for OpenStreetMap raster tiles"
affects: [11-07-integrar-mapa-en-ficha-proyecto]

# Tech tracking
tech-stack:
  added: ["leaflet@^1.9.4", "@types/leaflet@^1.9.21 (dev)"]
  patterns:
    - "Dynamic import('leaflet') inside useEffect (never top-level) to avoid SSR window/document crash"
    - "L.divIcon inline-SVG marker instead of Leaflet's default PNG icon path (sidesteps bundler asset-path breakage)"
    - "Purely presentational map component (props only, zero internal fetch) so it can be built/verified in isolation from any API route"

key-files:
  created: ["components/proyecto/zonificacion-mapa.tsx"]
  modified: ["next.config.ts", "package.json", "package-lock.json"]

key-decisions:
  - "Installed leaflet only, deliberately not react-leaflet — a plain useEffect+useRef mount is sufficient for one static, non-interactive map panel, keeping the phase's new-dependency footprint to exactly one package"
  - "Extended only the img-src CSP directive (added https://*.tile.openstreetmap.org) — no connect-src or worker-src changes needed since Leaflet's raster tiles load via plain <img> tags, no Web Worker involved"
  - "Verified with a real headless-browser (Playwright) smoke test against a throwaway route rather than relying on static analysis alone, since CSP violations are silent in rendered HTML/SSR output"

patterns-established:
  - "Map components in this codebase: PredioMap (Google Maps iframe embed) covers directions; ZonificacionMapa (Leaflet) covers polygon/zone confirmation — different libraries for different jobs, not a redundant duplicate"

# Metrics
duration: 5min
completed: 2026-07-30
---

# Phase 11 Plan 04: Leaflet ZonificacionMapa Component Summary

**Presentational Leaflet map component (marker + optional GeoJSON polygon on OSM tiles) with CSP updated for tile.openstreetmap.org, built and verified fully isolated from any Phase 11 API route**

## Performance

- **Duration:** ~5 min (tool-measured epoch delta; wall-clock session time longer)
- **Started:** 2026-07-30T21:49:44Z
- **Completed:** 2026-07-30T21:54:09Z
- **Tasks:** 2
- **Files modified:** 4 (package.json, package-lock.json, next.config.ts, + 1 file created)

## Accomplishments
- `leaflet` + `@types/leaflet` installed as the milestone's single new frontend dependency (`react-leaflet` deliberately excluded per plan rationale)
- CSP `img-src` extended to allow OpenStreetMap tile subdomains without touching any other directive
- `components/proyecto/zonificacion-mapa.tsx` created: `"use client"` component taking `{ lat, lng, geometria }` props, dynamic-imports Leaflet inside `useEffect`, renders a custom `L.divIcon` marker, optionally renders + fits-bounds to a GeoJSON polygon, and gracefully degrades (placeholder text) when coordinates are absent or (marker-only + note) when the polygon isn't available yet
- Verified end-to-end in a real headless browser (not just static analysis): zero console errors, all OSM tile requests returned HTTP 200 (no CSP block), both marker and polygon SVG path rendered correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Leaflet, update CSP** - `35acfdb` (chore)
2. **Task 2: ZonificacionMapa component** - `d7e250e` (feat)

**Plan metadata:** _(pending — this summary + STATE.md commit follows)_

## Files Created/Modified
- `components/proyecto/zonificacion-mapa.tsx` - New presentational Leaflet map component, exports `ZonificacionMapa` and `ZonaPolygon` type
- `next.config.ts` - CSP `img-src` directive extended with `https://*.tile.openstreetmap.org`
- `package.json` / `package-lock.json` - `leaflet` (dependency) + `@types/leaflet` (devDependency) added

## Decisions Made
- Followed the plan's explicit rationale for skipping `react-leaflet` and for scoping the CSP change to `img-src` only — both decisions were pre-made in the plan text (from `11-RESEARCH.md`'s Stack section) and required no independent judgment call during execution.
- Chose to verify with a real Playwright-driven headless browser against a throwaway route (`app/zmap-smoketest-tmp`, removed before finalizing) rather than relying solely on `tsc`/`eslint`, because the plan's own verify step warns CSP violations are silent in rendered output — confirmed all OSM tile requests return 200 with zero console errors, then deleted the throwaway page and cleared the stale `.next` dev-types cache entry it left behind.

## Deviations from Plan

None - plan executed exactly as written. The component was created verbatim from the plan's provided code (which was already correct and typechecked/linted clean on first pass), and the CSP edit matched the plan's exact target line.

## Issues Encountered

During browser-based verification, the local Playwright installation's expected Chromium build (`chromium_headless_shell-1228`) wasn't cached; worked around by launching with an already-cached Chromium executable (`chromium-1234`) via `executablePath`, no project files affected. Also cleared a stale `.next/dev/types` entry left behind by the throwaway smoke-test route (build cache only, gitignored, not a tracked-file change).

## User Setup Required

None - no external service configuration required. OpenStreetMap tile servers require no API key.

## Next Phase Readiness
- `ZonificacionMapa` is fully self-contained and ready for Plan 11-07 to import into `ZonificacionCard` (or equivalent) and feed it real `lat`/`lng`/`geometria` from `GET /api/proyectos/[id]/zonificacion` — zero further map-library work required.
- No blockers. Wave-1 plans 11-01/11-02/11-03 touched disjoint files; no overlap encountered during this execution.

---
*Phase: 11-vista-de-zonificacion-en-el-proyecto*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: components/proyecto/zonificacion-mapa.tsx
- FOUND: next.config.ts CSP entry (tile.openstreetmap.org)
- FOUND: .planning/phases/11-vista-de-zonificacion-en-el-proyecto/11-04-SUMMARY.md
- FOUND: commit 35acfdb (Task 1)
- FOUND: commit d7e250e (Task 2)
