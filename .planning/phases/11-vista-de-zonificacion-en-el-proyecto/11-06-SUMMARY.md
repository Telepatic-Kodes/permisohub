---
phase: 11-vista-de-zonificacion-en-el-proyecto
plan: 06
subsystem: api
tags: [nextjs, supabase, zonificacion, arcgis]

# Dependency graph
requires:
  - phase: 11-01
    provides: zonificacion_cache.geometria jsonb, proyectos.zona_origen text (20260730_zonificacion_v2.sql)
  - phase: 11-02
    provides: lib/zonificacion-zonas.ts (fetchZonasDisponibles, fetchZonaDetalle) — manual fallback data source
  - phase: 11-05
    provides: ZonaData.cacheId (real UUID), GET /api/zonificacion/lookup with returnGeometry+outSR=4326 and ?force=true upsert
provides:
  - "GET /api/proyectos/[id]/zonificacion — lazy polygon geometry fetch, separate from proyectos' fast payload"
  - "POST /api/proyectos/[id]/zonificacion — forced 'Actualizar' refresh (ZONE-04) and manual comuna/zona fallback (ZONE-05)"
  - "persistZonificacionParaProyecto(..., { force }) — extended to write zona_origen/zona_cache_id/zona_codigo on every automatic 'encontrado' write"
affects: [11-07, 11-08, 12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ownedProject() auth+ownership guard (401/404), copied from via-tramitacion/route.ts, adapted with a wider column select for this route's needs"
    - "Two distinct POST write paths sharing one authenticated route (body.manual present → manual fallback; absent → forced auto-refresh)"

key-files:
  created:
    - app/api/proyectos/[id]/zonificacion/route.ts
    - .planning/phases/11-vista-de-zonificacion-en-el-proyecto/deferred-items.md
  modified:
    - lib/zonificacion-server.ts

key-decisions:
  - "Dropped proyectos.lat/proyectos.lng from the route's ownedProject() select — those columns are declared in supabase/migrations/20260705_proyectos_sii.sql and in types/index.ts's Proyecto interface but were never applied to the live Supabase project; selecting them threw Postgres 42703 and turned the entire query null, making every legitimate request 404. GET's lat/lng now come only from zonificacion_cache.lat_r/lng_r."
  - "force flag threaded as a 4th optional param on persistZonificacionParaProyecto rather than a new function, keeping both existing Phase 10 after() call sites (proyectos/route.ts, proyectos/[id]/route.ts) untouched and passing exactly 3 args."

patterns-established:
  - "zona_origen written explicitly on every successful write path ('automatico' vs 'manual'), zona_cache_id explicitly nulled on manual writes — UI can trust the field, never has to infer origin from other nullability."

# Metrics
duration: 25min
completed: 2026-07-30
---

# Phase 11 Plan 06: Proyecto-scoped Zonificación Route Summary

**New `GET/POST /api/proyectos/[id]/zonificacion` route: GET serves lazy polygon geometry via the `zona_cache_id` join, POST handles both the forced "Actualizar" refresh (ZONE-04) and the manual comuna/zona fallback (ZONE-05) — both auth+ownership gated and rate-limited.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T21:45:00Z (approx.)
- **Completed:** 2026-07-30T22:12:31Z
- **Tasks:** 2 (Task 0 was pre-completed by orchestrator, confirmed via verify greps)
- **Files modified:** 2 (1 created, 1 modified) + 1 deferred-items log

## Accomplishments
- `persistZonificacionParaProyecto` now accepts an optional `{ force }` param and writes `zona_origen: 'automatico'`, a real `zona_cache_id`, and `zona_codigo` on every successful automatic lookup — additive, both Phase 10 call sites unchanged.
- New `app/api/proyectos/[id]/zonificacion/route.ts`: `GET` serves polygon geometry lazily (never embedded in `GET /api/proyectos/[id]`'s fast payload), gracefully degrading to `geometria: null` when no cache row exists yet. `POST` handles ZONE-04 (forced refresh, reuses `persistZonificacionParaProyecto(..., { force: true })` — never duplicates orchestration) and ZONE-05 (manual selection via `fetchZonaDetalle`, always writes `zona_origen: 'manual'` + `zona_cache_id: null`, never implies a geocoded match that didn't happen).
- Discovered and worked around a pre-existing, unrelated schema-drift bug live in production (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 0: Migration — add proyectos.zona_codigo** - pre-completed by orchestrator (`e82c943`), confirmed via verify greps this session
2. **Task 1: Extend persistZonificacionParaProyecto with force + zona_origen/zona_cache_id/zona_codigo** - `2777d8d` (feat)
3. **Task 2: Proyecto-scoped zonificación route — GET polygon, POST actualizar/manual** - `abc3d6f` (feat)

**Plan metadata:** (this commit, appended below)

## Files Created/Modified
- `app/api/proyectos/[id]/zonificacion/route.ts` - New: `ownedProject()` auth+ownership guard, `GET` (polygon via cache join), `POST` (manual + forced-refresh branches)
- `lib/zonificacion-server.ts` - `persistZonificacionParaProyecto` gains optional `{ force }` 4th param; `'encontrado'` branch now writes `zona_origen`, `zona_cache_id`, `zona_codigo`
- `.planning/phases/11-vista-de-zonificacion-en-el-proyecto/deferred-items.md` - New: logs the pre-existing `proyectos.lat/lng` schema-drift discovery (out of scope to fix here)

## Decisions Made
- Threaded `force` as an optional 4th parameter rather than a new exported function — smallest additive change, zero risk to the two existing Phase 10 `after()` call sites.
- Manual selection (`POST` with `body.manual`) never touches `zonificacion_cache` or `zona_cache_id` — there's no real geocoded point behind a manual pick, so `zona_cache_id` is explicitly nulled to keep `zona_origen` trustworthy for the UI.
- Route's `ownedProject()` select excludes `proyectos.lat`/`proyectos.lng` (see Deviations) — GET's coordinate fallback comes solely from `zonificacion_cache.lat_r`/`lng_r`, which is actually the more precise value for this route's purpose (polygon confirmation map) anyway.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed `proyectos.lat`/`proyectos.lng` from the route's select — columns don't exist on the live Supabase project**
- **Found during:** Task 2, live verification against the real Supabase project via a service-role Node script
- **Issue:** The plan's exact `ownedProject()` snippet selects `lat, lng` from `proyectos`. Live query confirmed these columns don't exist (`42703 column proyectos.lat does not exist`) even though they're declared in `supabase/migrations/20260705_proyectos_sii.sql` and in `types/index.ts`'s `Proyecto` interface, and are already written by `app/api/proyectos/route.ts`'s SII-enrichment `after()` block. Selecting a nonexistent column makes the entire Supabase query return `data: null` (not a per-field null) — which would make `ownedProject()`'s `if (!proyecto || ...)` guard return a false 404 for every single request to this route, completely breaking it.
- **Fix:** Dropped `lat, lng` from `ownedProject()`'s column list. `GET`'s response now sources `lat`/`lng` exclusively from `zonificacion_cache.lat_r`/`lng_r` (falls back to `null` if no cache row), never from `proyectos.lat`/`lng`.
- **Files modified:** `app/api/proyectos/[id]/zonificacion/route.ts`
- **Verification:** Re-ran `npx tsc --noEmit` and `npx eslint` (both clean). Live-verified against the real Supabase project with a service-role script simulating the exact query the route now runs: `ownedProject()`'s select succeeds with zero error, the `zona_cache_id` join to `zonificacion_cache` returns a real `Polygon` GeoJSON object and correct `lat_r`/`lng_r`. Also live-verified the manual-selection write shape (`zona_origen:'manual'`, `zona_cache_id:null`, `zona_codigo` set) and the unauthenticated 401 path via curl against a real dev server on port 7891. Both mutated live project rows were reverted to their original `pendiente` state immediately after verification — no test data left in production.
- **Committed in:** `abc3d6f` (Task 2 commit, comment + code change included)

**2. [Out of scope, logged not fixed] `supabase/migrations/20260705_proyectos_sii.sql` never applied live**
- **Found during:** Task 2 verification (root cause of deviation #1 above)
- **Issue:** This migration (adds `rol_sii`, `destino_sii`, `avaluo_fiscal_clp`, `superficie_terreno_m2`, `superficie_construida_m2`, `lat`, `lng` to `proyectos`) exists in the repo, is referenced by live code (SII enrichment writes, several AI routes' reads), but was never applied to the live Supabase project — a pre-existing gap predating Phase 10/11 entirely.
- **Why not fixed:** Out of scope for this plan (SCOPE BOUNDARY) and outside this executor session's reach — no `mcp__supabase__*` tools bound in this session (same recurring gap as 11-01/11-05, documented in STATE.md) and no direct Postgres connection string available to apply DDL another way.
- **Logged in:** `.planning/phases/11-vista-de-zonificacion-en-el-proyecto/deferred-items.md`, recommending the orchestrator apply it directly via `mcp__supabase__apply_migration` (idempotent, `ADD COLUMN IF NOT EXISTS` throughout).

---

**Total deviations:** 2 (1 auto-fixed/Rule 3, 1 logged-and-deferred/out of scope)
**Impact on plan:** The Rule 3 fix was essential — without it, the entire new route would 404 on every request in production. The deferred item is unrelated to this plan's own artifacts (Phase 10/11 zona_* columns are all live and correct) but was discovered as a side effect of live-verifying this plan's route.

## Issues Encountered
- No dev server was running at session start; started one on port 7891 (`next dev --webpack -p 7891`) to live-verify against real Supabase/ArcGIS, stopped it after verification completed.
- As in prior Phase 11 plans (11-01, 11-05), no authenticated browser session was available in this environment to drive the full HTTP path (GET/POST through a real logged-in request). Worked around by exercising the exact same Supabase queries the route runs via a service-role script (same effective coverage as an authenticated request for verifying query/schema correctness), plus curl for the unauthenticated 401 path. Full logged-in-session smoke test remains recommended before Phase 11 ships, consistent with the standing note in STATE.md.

## User Setup Required
None - no external service configuration required for this plan. (Separately: `20260705_proyectos_sii.sql` should be applied to Supabase — see deferred-items.md — but that's independent of this plan's own deliverables.)

## Next Phase Readiness
- ZONE-04 and ZONE-05 are fully functional and testable server-side before any UI exists, exactly as this plan's success criteria required.
- 11-07 (wires `ZonificacionMapa` with real GET data) and 11-08 (manual fallback UI, POST with `body.manual`) are both unblocked — this route is the complete backend surface both need.
- Flag for 11-07/11-08 planning: this route's `lat`/`lng` in the GET response come from `zonificacion_cache`, not `proyectos` — do not assume `proyectos.lat`/`proyectos.lng` are populated anywhere reliable until deferred-items.md's migration is applied.

---
*Phase: 11-vista-de-zonificacion-en-el-proyecto*
*Completed: 2026-07-30*

## Self-Check: PASSED
All created files exist (route.ts, zonificacion-server.ts, SUMMARY.md, deferred-items.md); both task commits (2777d8d, abc3d6f) verified present in git log.
