---
phase: 11-vista-de-zonificacion-en-el-proyecto
plan: 03
subsystem: api
tags: [zod, openai, zonificacion, compatibilidad-uso, nextjs-route-handler]

# Dependency graph
requires:
  - phase: 10-motor-de-zonificacion
    provides: "proyectos.zona_uperm/zona_uproh/zona_usos_disponibles columns, populated (when available) by lib/zonificacion-server.ts's persistZonificacionParaProyecto()"
provides:
  - "lib/zonificacion-compat.ts — verificarCompatibilidadUso(), a pure async function that classifies a free-text intended use against a zone's uperm/uproh into exactly one of permitido/no_permitido/no_especificado, with a hard deterministic short-circuit before any AI call"
  - "POST /api/proyectos/[id]/compatibilidad — authenticated, ownership-checked route that architects (via future UI) can call to get a live 3-state compatibility answer for a project"
affects: [11-08 (wires this backend into the project UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic short-circuit before AI call: verificarCompatibilidadUso() returns no_especificado synchronously (no network call) whenever usosDisponibles is false or both uperm/uproh are empty/whitespace-only — mirrors the project's isAIAvailable() guard + try/catch degradation pattern from 09-03"
    - "3-state enum validated with Zod safeParse on the AI's raw JSON output before trusting it — never a direct cast of model output"

key-files:
  created:
    - lib/zonificacion-compat.ts
    - app/api/proyectos/[id]/compatibilidad/route.ts
  modified: []

key-decisions:
  - "Route does not persist the compatibility result onto proyectos — a project's uso pretendido can change between checks, so it's answered live rather than stored as a fixed attribute. History/persistence deferred as an additive follow-up, not built speculatively."
  - "ownedProject() pattern copied verbatim from via-tramitacion/route.ts (401 no-auth, 404 non-owner) since this route reads a project's already-persisted zone data, unlike the public /api/zonificacion/lookup and /api/zonificacion/zonas routes."

patterns-established:
  - "Free-text-against-regulatory-text classification via lib/ai.ts's aiComplete({json:true}) with a Zod enum gate on the parsed output — reusable for any future 3-state (or N-state) AI classification against PRC/regulatory source text."

# Metrics
duration: 6min
completed: 2026-07-30
---

# Phase 11 Plan 03: Compatibilidad de Uso Backend (COMPAT-01) Summary

**`verificarCompatibilidadUso()` classifies free-text intended use against a zone's uperm/uproh into permitido/no_permitido/no_especificado via GPT-4o, with a deterministic short-circuit that skips the AI call entirely for zones with no usable data (e.g. Ñuñoa) — exposed via an authenticated, ownership-checked POST route.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-30T17:49:00-04:00 (approx)
- **Completed:** 2026-07-30T17:53:06-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- `lib/zonificacion-compat.ts` exports `verificarCompatibilidadUso()` and `CompatEstadoSchema`, implementing a hard deterministic short-circuit before any AI call and a Zod-validated 3-state classification via `lib/ai.ts`'s existing `aiComplete({json:true})` pattern.
- `app/api/proyectos/[id]/compatibilidad/route.ts` exposes this as an authenticated, ownership-checked POST endpoint (`ownedProject()` pattern from `via-tramitacion`), rate-limited, with 400 on missing input and never a 4th state or boolean leaking through.
- Live-verified the classification function directly against real cached zone data (Las Condes, Providencia, Ñuñoa) pulled from `zonificacion_cache` via the Supabase service role — confirmed both the AI path (returns valid 3-state JSON) and the short-circuit path (0ms elapsed, no OpenAI call) behave exactly as specified.

## Task Commits

Each task was committed atomically:

1. **Task 1: Deterministic-short-circuit + AI classification** - `8578820` (feat)
2. **Task 2: Authenticated proyecto-scoped compat route** - `3623dfe` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `lib/zonificacion-compat.ts` - `verificarCompatibilidadUso(usoPretendido, uperm, uproh, usosDisponibles)` — pure classification logic, exports `CompatEstadoSchema` (Zod enum) and `CompatibilidadResult` type. Never throws; every failure path (no data, AI unavailable, JSON.parse failure, network error) resolves to `{ estado: 'no_especificado', justificacion: '...' }`.
- `app/api/proyectos/[id]/compatibilidad/route.ts` - `POST` handler: `ownedProject()` auth+ownership check → rate limit → validate `usoPretendido` body → call `verificarCompatibilidadUso()` with the project's persisted `zona_uperm`/`zona_uproh`/`zona_usos_disponibles` → return `{ ok: true, estado, justificacion }`. Deliberately stateless (no write to `proyectos`).

## Decisions Made
- No persistence of the compatibility result — it's a live, repeatable check against a free-text input the architect types each time, not a fixed project attribute. If future phases need history, that's additive.
- Copied the exact `ownedProject()` shape from `via-tramitacion/route.ts` rather than introducing a shared helper, consistent with the existing codebase convention (each proyecto-scoped route currently defines its own local `ownedProject()`).

## Deviations from Plan

None — plan executed exactly as written. Both files were created verbatim from the plan's specified implementation (with only a translated comment tweak for internal consistency), verified clean via `tsc`/`eslint`, and live-tested against real Supabase zone data.

## Issues Encountered

- No project in the local Supabase DB currently has `zona_status: 'encontrado'` with populated `zona_uperm`/`zona_uproh` (both existing projects are still `pendiente` — the same persistence-timing gap already flagged in `10-05-SUMMARY.md`'s "Verification gap"). This meant the route's full authenticated HTTP path (`ownedProject()` → real project row → AI call) could not be end-to-end curl-tested with a live session in this environment (same limitation noted in prior phase-11 executions: `auth.getUser()` requires a real session even with the dev middleware bypass).
- Worked around this by testing `verificarCompatibilidadUso()` directly (via `npx tsx`, service-role-fetched real `zonificacion_cache` rows for Las Condes/Providencia/Ñuñoa) to confirm both the AI classification path and the deterministic short-circuit path behave correctly, and separately confirmed the route's auth gate returns 401 for unauthenticated requests via curl. This covers everything the plan's `<verify>` section asks for except the specific "authenticated session + real owned project" combination, which remains an open environment limitation for a future manual smoke test (same recommendation as 10-05).

## User Setup Required

None - no external service configuration required. `OPENAI_API_KEY` was already configured (used by existing AI features); no new environment variables introduced.

## Next Phase Readiness

- COMPAT-01's backend is fully built and independently verified (function-level + route auth-gate level). Plan 11-08 can wire the UI on top of `POST /api/proyectos/[id]/compatibilidad` with confidence in the 3-state contract.
- Recommend the same manual smoke test flagged in 10-05 (log in, create/edit a project with a covered comuna address, confirm `zona_status` reaches `encontrado`) before or during 11-08, so the compatibilidad route has real persisted data to work against for its first live UI use.

---
*Phase: 11-vista-de-zonificacion-en-el-proyecto*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/zonificacion-compat.ts
- FOUND: app/api/proyectos/[id]/compatibilidad/route.ts
- FOUND: commit 8578820
- FOUND: commit 3623dfe
