---
phase: 10-motor-de-zonificacion
plan: 02
subsystem: zonificacion
tags: [arcgis, featureserver, comuna-registry, config, chile]

# Dependency graph
requires: []
provides:
  - "ZONIFICACION_COMUNAS registry (4 comunas: las-condes, providencia, vitacura dedicada; nunoa agregada) with live-verified FeatureServer URLs, layer index, and field casing"
  - "resolveComunaZonificacion() — display-name/slug → registry entry or null (explicit sin_cobertura signal)"
  - "getComunasConCobertura() helper for Phase 11 manual-fallback UI"
affects: [10-motor-de-zonificacion (10-04 lookup route), 11-vista-de-zonificacion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Small, deep, hand-curated registry file alongside a large shallow list (lib/zonificacion-comunas.ts next to lib/comunas-chile.ts), keyed by the same slugs — same pattern as lib/municipios-stats.ts"
    - "Explicit null-as-signal instead of empty-but-truthy object for 'no coverage' (Pitfall 3)"
    - "usosDisponibles boolean flag to disclose structurally-empty source fields rather than inferring absence from nullability (Pitfall 8)"

key-files:
  created: [lib/zonificacion-comunas.ts]
  modified: []

key-decisions:
  - "Registry reproduces the 4 FeatureServer URLs, layer index (0), and field casing verbatim from 10-RESEARCH.md's verified table — no invented or 'cleaned up' values"
  - "Ñuñoa (nunoa) flagged usosDisponibles: false — UPERM/UPROH confirmed 0/200 filled in the PrcCuencaMaipo aggregate layer, even though the layer correctly resolves zone code/name"

patterns-established:
  - "resolveComunaZonificacion(nombreOMunicipio): ComunaZonificacionConfig | null — the single entry point future consumers (lookup route, Phase 11 UI) use to check coverage before any network call"

# Metrics
duration: 8min
completed: 2026-07-30
---

# Phase 10 Plan 02: Zonificación Comuna Registry Summary

**Hand-curated 4-comuna ArcGIS FeatureServer coverage registry with a resolver that turns a display-name municipio string into either a config entry or an explicit null (never an empty-but-truthy object).**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-07-30
- **Tasks:** 1/1 completed
- **Files modified:** 1

## Accomplishments
- Built `ZONIFICACION_COMUNAS` with exactly the 4 live-verified entries from 10-RESEARCH.md: `las-condes`, `providencia`, `vitacura` (tier `dedicada`, lowercase field casing, `usosDisponibles: true`) and `nunoa` (tier `agregada`, UPPERCASE field casing against the shared `PrcCuencaMaipo` layer, `usosDisponibles: false`)
- Implemented `resolveComunaZonificacion()` that resolves both `ComunaChile.nombre` display names ("Las Condes") and slugs ("las-condes") to the same entry via `COMUNAS_CHILE.find()`, returning `null` for any uncovered comuna
- Added `getComunasConCobertura()` helper for Phase 11's manual-fallback UI (ZONE-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the zonificación comuna registry + resolver** - `380798f` (feat)

_No TDD tasks in this plan — pure config + pure function._

## Files Created/Modified
- `lib/zonificacion-comunas.ts` - `ZONIFICACION_COMUNAS` registry (4 entries), `resolveComunaZonificacion()`, `getComunasConCobertura()`, types `TierCobertura`/`ZonificacionFieldMap`/`ComunaZonificacionConfig`

## Decisions Made
- Kept the registry entirely separate from `lib/comunas-chile.ts` (never added fields to the big shallow list), matching the existing `lib/municipios-stats.ts` convention of a small deep file cross-referenced by slug.
- Field values (URLs, layer index, casing) copied verbatim from 10-RESEARCH.md's verified table rather than re-deriving or normalizing them, per plan instruction.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` — no errors referencing `lib/zonificacion-comunas.ts`.
- Manual resolver check via `npx tsx -e "..."`:
  - `resolveComunaZonificacion('Las Condes')` → `comunaId: 'las-condes'`
  - `resolveComunaZonificacion('las-condes')` (slug) → same entry
  - `resolveComunaZonificacion('Ñuñoa')` → `comunaId: 'nunoa'`, `usosDisponibles: false`
  - `resolveComunaZonificacion('Maipú')` → `null`
  - `Object.keys(ZONIFICACION_COMUNAS).length` → `4`
  - `getComunasConCobertura().length` → `4`

## Next Steps
- Plan 10-04's lookup route imports `ZONIFICACION_COMUNAS` / `resolveComunaZonificacion()` as the pre-network-call coverage check.
- Phase 11's manual-fallback UI (ZONE-05) consumes `getComunasConCobertura()`.

## Self-Check: PASSED
