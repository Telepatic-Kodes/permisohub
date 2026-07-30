---
phase: 10-motor-de-zonificacion
plan: 04
subsystem: api
tags: [zod, arcgis, nominatim, supabase, next-route-handler]

# Dependency graph
requires:
  - phase: 10-motor-de-zonificacion (10-01)
    provides: zonificacion_cache table + proyectos.zona_* columns + zona_status_check constraint, live in Supabase
  - phase: 10-motor-de-zonificacion (10-02)
    provides: lib/zonificacion-comunas.ts — ZONIFICACION_COMUNAS registry, resolveComunaZonificacion()
  - phase: 10-motor-de-zonificacion (10-03)
    provides: lib/geocoding.ts — geocodeDireccion() via Nominatim
provides:
  - lib/zonificacion.ts — client-safe ZonaStatus/ZonaData/ZonaLookupResponse types, ArcGISQueryResponseSchema (Zod), lookupZonificacion() fetch helper
  - GET /api/zonificacion/lookup — end-to-end orchestration: registry short-circuit → geocode → cache read-through → ArcGIS point-in-polygon query → Zod validation → normalize → cache upsert
affects: [10-05 (after() wiring into project creation), phase-11 (zonificación UI, will import lib/zonificacion.ts client-side)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit 3-state status union (never boolean) for external-data lookups: 'encontrado' | 'sin_cobertura' | 'error'"
    - "Client-safe lib/*.ts (types + Zod schema + thin fetch wrapper) paired with a server-only app/api/*/route.ts that owns all service-role/3rd-party-API logic — mirrors lib/sii-lookup.ts + app/api/sii/lookup/route.ts"
    - "Unauthenticated internal proxy route (no createClient()/getUser()) for public, non-tenant data reachable by both server-side after() triggers and future client code — precedent: app/api/utils/uf/route.ts; rate-limited by IP via checkRateLimit()"

key-files:
  created:
    - lib/zonificacion.ts
    - app/api/zonificacion/lookup/route.ts
  modified: []

key-decisions:
  - "No auth check on GET /api/zonificacion/lookup — follows app/api/utils/uf/route.ts precedent since the route exposes only public zoning data and must be callable from a session-less after() trigger (Plan 10-05); rate-limited by IP instead of by user.id"
  - "Empty ArcGIS features array (comuna covered, no polygon matched the exact point) maps to status:'error', deliberately distinct from both 'sin_cobertura' (comuna outside registry) and 'encontrado' — prevents a boundary/rural gap from ever silently reading as 'no restrictions'"
  - "usosDisponibles always sourced from comunaConfig.usosDisponibles (the registry), never inferred from uperm/uproh being empty on a given row — required for Ñuñoa's structurally-empty UPERM/UPROH fields to be disclosed rather than misread as unrestricted"

patterns-established:
  - "ArcGIS query axis order is always geometry=lng,lat with explicit inSR=4326 — the highest-risk single line in the file per PITFALLS.md Pitfall 1"
  - "fieldMap indirection (lib/zonificacion-comunas.ts) lets one route handle both lowercase (Las Condes/Providencia/Vitacura) and UPPERCASE (Ñuñoa/PrcCuencaMaipo) ArcGIS field casing with zero per-comuna branching"

duration: ~15min
completed: 2026-07-30
---

# Phase 10 Plan 04: Zonificación Lookup Route Summary

**End-to-end GET /api/zonificacion/lookup: comuna-registry short-circuit → Nominatim geocode → Supabase cache read-through → ArcGIS point-in-polygon query with Zod-validated envelope → normalized zone data, live-verified against all 4 covered comunas plus cache-hit and sin_cobertura paths.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-30T20:59:37Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `lib/zonificacion.ts` — client-safe types (`ZonaStatus`, `ZonaData`, `ZonaLookupResponse`), Zod boundary schema (`ArcGISQueryResponseSchema`) validating the ArcGIS envelope generically via `z.record`, and `lookupZonificacion()` fetch helper — zero server-only imports, mirrors `lib/sii-lookup.ts`
- `app/api/zonificacion/lookup/route.ts` — the single adapter isolating all ArcGIS-specific knowledge: registry check (zero-cost `sin_cobertura` short-circuit) → geocode → cache read-through by `(comuna_id, lat_r, lng_r)` → ArcGIS query with explicit `geometry=lng,lat&inSR=4326` → Zod-validated response → cache upsert
- Live-verified end-to-end against a running dev server for all 4 covered comunas (Las Condes, Providencia, Vitacura, Ñuñoa), a repeat query confirming cache-hit behavior, and an uncovered comuna (Temuco) confirming zero network calls on `sin_cobertura`

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/zonificacion.ts — types, Zod boundary validation, client helper** - `687c6d9` (feat)
2. **Task 2: app/api/zonificacion/lookup/route.ts — server orchestration** - `ec7c5ea` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `lib/zonificacion.ts` - Client-safe `ZonaStatus`/`ZonaData`/`ZonaLookupResponse` types, `ArcGISQueryResponseSchema` (Zod), `lookupZonificacion()` fetch helper
- `app/api/zonificacion/lookup/route.ts` - Server orchestration: registry → geocode → cache read-through → ArcGIS query → normalize → cache upsert; no auth check, IP-based rate limit

## Decisions Made
- No `createClient()`/`getUser()` auth check on the lookup route — documented in-file, follows `app/api/utils/uf/route.ts` precedent (see key-decisions above)
- Empty ArcGIS `features[]` (covered comuna, no polygon at the exact point) surfaces as `status:'error'`, never `'sin_cobertura'` or a false `'encontrado'`
- `usosDisponibles` is a registry-level flag only, never derived from `uperm`/`uproh` nullability at read time (Pitfall 8, verified live for Ñuñoa: `usosDisponibles:false`, `uperm:null`, `uproh:null`)

## Deviations from Plan

None — plan executed exactly as written. The plan's code blocks were followed verbatim; only in-file comments were lightly reworded in `lib/zonificacion.ts` to avoid the literal string `supabase/service` appearing in a comment (which would have false-positived the plan's own `grep -c "createServiceClient|supabase/service"` client-safety verification check).

## Issues Encountered

None. One pre-existing/unrelated observation: several ArcGIS text fields (e.g. `nombreZona`, `uperm`, `uproh`) contain mojibake (`Â°`, `Ã³`, etc.) — this is a source-encoding characteristic of the upstream FeatureServer data itself, not something introduced by this route, and is out of scope for this plan's success criteria (no requirement to re-encode ArcGIS text). Flagging for awareness before Phase 11 renders this text in the UI.

## User Setup Required

None - no external service configuration required. `zonificacion_cache` table and `proyectos.zona_*` columns were already live in Supabase from Plan 10-01.

## Next Phase Readiness
- `GET /api/zonificacion/lookup` is fully functional and independently verified via curl for all 4 covered comunas, cache read-through, and the uncovered-comuna short-circuit — Plan 10-05 can now wire this into project creation via `after()` with no further route changes needed
- `lib/zonificacion.ts`'s `lookupZonificacion()` client helper is ready for Phase 11's UI to call directly

---
*Phase: 10-motor-de-zonificacion*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/zonificacion.ts
- FOUND: app/api/zonificacion/lookup/route.ts
- FOUND: .planning/phases/10-motor-de-zonificacion/10-04-SUMMARY.md
- FOUND: 687c6d9 (Task 1 commit)
- FOUND: ec7c5ea (Task 2 commit)
