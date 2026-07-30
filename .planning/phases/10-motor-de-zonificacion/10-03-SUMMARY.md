---
phase: 10-motor-de-zonificacion
plan: 03
subsystem: infra
tags: [geocoding, nominatim, openstreetmap, fetch]

# Dependency graph
requires: []
provides:
  - "lib/geocoding.ts: geocodeDireccion(direccion, comuna) → lat/lng + comuna detectada vía Nominatim (OpenStreetMap)"
affects: [10-04-lookup-route, 10-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side-only geocoding via Nominatim /search, reusing fetchWithTimeout from lib/scraper.ts (existing server-proxy convention shared with lib/sii-lookup.ts)"
    - "In-module throttle (module-level lastRequestAt timestamp) to respect a third-party rate limit without adding a dependency or a queue"
    - "Explicit ok:true/false result object instead of throwing — network/parse failures never escape the function boundary"

key-files:
  created: [lib/geocoding.ts]
  modified: []

key-decisions:
  - "comunaDetectada reads address.suburb first, falling back to address.city only when suburb is absent — live-verified: Nominatim returns address.city='Santiago' for Las Condes (and by extension Vitacura/Ñuñoa per research), while address.suburb correctly holds the real comuna"
  - "No hard match/throw when comunaDetectada != requested comuna — that cross-check is deferred to the Plan 10-04 caller as a warning signal, not a gate here"
  - "Multiple Nominatim results for the same address are not disambiguated beyond results[0] — acceptable for MVP since near-duplicate POIs at the same building resolve to effectively the same lat/lng"

patterns-established:
  - "Third-party rate-limited API wrapper: module-level `lastRequestAt` + `throttle()` await before each call, no new dependency"

# Metrics
duration: 8min
completed: 2026-07-30
---

# Phase 10 Plan 03: Nominatim Geocoder Summary

**Server-side `geocodeDireccion()` wrapping Nominatim's `/search` endpoint, returning numeric lat/lng plus `comunaDetectada` sourced from `address.suburb` (not `address.city`, which Nominatim collapses to "Santiago" for 3 of 4 target comunas).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-30T20:17:00Z
- **Completed:** 2026-07-30T20:25:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Built the missing geocoder prerequisite (`lib/geocoding.ts`) that Plan 10-04's ArcGIS point-in-polygon lookup route will depend on
- Live-verified against the real Nominatim endpoint for a Las Condes address: confirmed `lat`/`lon` return as strings (requiring `parseFloat`), and `address.suburb="Las Condes"` vs `address.city="Santiago"` — validating the exact pitfall the plan called out
- Implemented a dependency-free throttle so bursts of project creations can't exceed Nominatim's 1 req/sec usage policy

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the Nominatim geocoder** - `c134add` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/geocoding.ts` - `geocodeDireccion(direccion, comuna)` — throttled fetch to Nominatim, parses lat/lon strings to numbers, prefers `address.suburb` over `address.city`, resolves `{ok:false, error}` on any failure (HTTP error, empty results, NaN coords, thrown exception)

## Decisions Made
- See `key-decisions` in frontmatter above. No deviation from the plan's provided code — implemented as specified since the plan included the full implementation verbatim.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Nominatim is public and keyless.

## Next Phase Readiness

`lib/geocoding.ts` is ready to be imported by Plan 10-04's lookup route, which will call `geocodeDireccion()` to obtain `lat`/`lng` for the ArcGIS point-in-polygon query, and will own the `comunaDetectada` vs. requested-comuna cross-check (as a soft warning, per plan note). No blockers.

---
*Phase: 10-motor-de-zonificacion*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/geocoding.ts
- FOUND: c134add (Task 1 commit)
