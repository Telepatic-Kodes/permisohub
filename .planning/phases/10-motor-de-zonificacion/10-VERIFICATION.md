---
phase: 10-motor-de-zonificacion
verified: 2026-07-30T21:10:55Z
status: human_needed
score: 5/5 truths verified (4 by direct evidence, 1 by code-inspection pending manual smoke test)
human_verification:
  - test: "Crear un proyecto (POST /api/proyectos, vía UI logueada) con dirección real en una comuna cubierta (ej. 'Av. Apoquindo 1234', municipio 'Las Condes'), esperar unos segundos, y consultar la fila en Supabase (o GET /api/proyectos/[id])."
    expected: "proyectos.zona_status = 'encontrado', zona_nombre/zona_sector/zona_uperm/zona_uproh/zona_usos_disponibles poblados, zona_consultada_el con timestamp reciente."
    why_human: "El wiring after()->persistZonificacionParaProyecto() fue verificado por inspección de código y por curl directo a GET /api/zonificacion/lookup (10-04), pero nunca se completó un round-trip HTTP autenticado real contra POST /api/proyectos — el chequeo de auth de la sesión de ejecución de 10-05 bloqueó esa prueba (documentado como gap en 10-05-SUMMARY.md)."
  - test: "PATCH /api/proyectos/[id] cambiando 'direccion' (o 'municipio') de un proyecto existente, vía UI logueada, y volver a consultar la fila tras unos segundos."
    expected: "zona_status se re-escribe (a 'encontrado', 'sin_cobertura' o 'error' según corresponda a la nueva dirección) y los campos zona_* reflejan el nuevo lookup, no quedan pegados al valor anterior."
    why_human: "Mismo gap que el ítem anterior — el PATCH handler re-lee la fila completa en background y dispara el mismo helper, pero esa ruta específica (updates.direccion/municipio -> after() -> re-lectura -> persistZonificacionParaProyecto) tampoco fue ejercitada con una sesión autenticada real."
  - test: "Crear o actualizar un proyecto con municipio fuera de las 4 comunas cubiertas (ej. 'Temuco')."
    expected: "zona_status = 'sin_cobertura' escrito en la fila (no 'pendiente' indefinido, no vacío)."
    why_human: "Mismo gap — la lógica de sin_cobertura fue live-verificada directamente contra GET /api/zonificacion/lookup (10-04), pero no a través del flujo completo POST/PATCH /api/proyectos -> after() -> persistZonificacionParaProyecto()."
---

# Phase 10: Motor de Zonificación Verification Report

**Phase Goal:** El sistema puede determinar automáticamente, para una dirección dentro de las comunas cubiertas (Las Condes, Providencia, Vitacura, Ñuñoa), la zona PRC y sus usos permitidos/prohibidos — geocodificando, consultando el FeatureServer ArcGIS de MINVU/OCUC, cacheando el resultado y persistiéndolo en el proyecto — distinguiendo explícitamente "encontrado" / "sin cobertura" / "error", sin exponer aún interfaz al arquitecto.

**Verified:** 2026-07-30T21:10:55Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dirección real en comuna cubierta geocodifica a lat/lng correcto para esa comuna | ✓ VERIFIED | `lib/geocoding.ts` reads `address.suburb` with `address.city` fallback (documented rationale for Santiago's suburb-vs-city quirk), returns numeric `lat`/`lng` (not strings) via `parseFloat`. Live-verified end-to-end via curl for all 4 comunas per 10-04-SUMMARY.md (not re-run this session — trusted per task instructions). |
| 2 | Endpoint de zonificación retorna código de zona PRC + nombre + usos verbatim, validado con Zod contra shape real de ArcGIS | ✓ VERIFIED | `app/api/zonificacion/lookup/route.ts` parses the ArcGIS envelope with `ArcGISQueryResponseSchema.safeParse()` (defined in `lib/zonificacion.ts`, generic `z.record` over `attributes` — doesn't hardcode per-comuna field names), rejects with explicit `status:'error'` on shape mismatch. `zona`/`nombreZona`/`uperm`/`uproh` extracted verbatim via `get()` helper, no transformation. Live-verified for all 4 comunas per 10-04-SUMMARY.md. |
| 3 | Resultado cacheado por coordenadas redondeadas — segunda consulta no repite llamada a ArcGIS | ✓ VERIFIED | `supabase/migrations/20260730_zonificacion.sql` creates `zonificacion_cache` with `UNIQUE INDEX (comuna_id, lat_r, lng_r)`. Route does a `.maybeSingle()` read-through by `(comuna_id, lat_r, lng_r)` *before* constructing the ArcGIS URL/fetch — a cache hit returns early (line 96-105 of the route) without ever reaching the ArcGIS `fetch()` call. Live-verified with a repeat query confirming cache-hit behavior per 10-04-SUMMARY.md. |
| 4 | Crear/actualizar proyecto con dirección persiste zonificación automáticamente con estado explícito (encontrado/sin_cobertura/error, nunca booleano) | ? UNCERTAIN (code inspection passes; no authenticated HTTP round-trip) | See detailed code-inspection findings below. Recommend manual smoke test — flagged as `human_verification` item. |
| 5 | Comuna fuera de las 4 iniciales retorna sin_cobertura explícito, no resultado vacío indistinguible de "sin restricciones" | ✓ VERIFIED | `resolveComunaZonificacion()` in `lib/zonificacion-comunas.ts` returns `null` (never an empty-but-truthy object) for any comuna not in the 4-entry `ZONIFICACION_COMUNAS` registry. The lookup route checks this *before* any Nominatim/ArcGIS call (lines 57-63) and short-circuits to `status:'sin_cobertura'`. Live-verified against Temuco (uncovered) confirming zero network calls per 10-04-SUMMARY.md. |

**Score:** 5/5 truths — 4 directly verified via live testing (documented in 10-04-SUMMARY.md, code re-inspected and confirmed consistent this session), 1 verified by code inspection only, pending a manual smoke test to close the gap.

### Detailed Code Inspection — Criterion 4 (the gap flagged in 10-05-SUMMARY.md)

Read in full for this verification pass: `lib/zonificacion-server.ts`, `app/api/proyectos/route.ts`, `app/api/proyectos/[id]/route.ts`, `lib/supabase/service.ts`.

**`lib/zonificacion-server.ts` — `persistZonificacionParaProyecto(proyectoId, direccion, municipio)`:**
- Self-fetches `GET /api/zonificacion/lookup?direccion=...&comuna=...` (the same route independently live-verified in 10-04).
- Three explicit branches, each ending in an `admin.from('proyectos').update({ zona_status: ... }).eq('id', proyectoId)`:
  - `status === 'encontrado'` → writes `zona_status:'encontrado'` + full zone snapshot (`zona_sector`, `zona_nombre`, `zona_uperm`, `zona_uproh`, `zona_usos_disponibles`, `zona_fuente_url`, `zona_consultada_el`).
  - `status === 'sin_cobertura'` → writes `zona_status:'sin_cobertura'` + `zona_consultada_el`.
  - fallthrough (`status === 'error'` or anything else) → logs a `console.warn` and writes `zona_status:'error'` + `zona_consultada_el`.
- Outer `try/catch` — the `catch` block also writes `zona_status:'error'` (with a `console.error`), so an unhandled exception (network failure, `fetch` throwing, etc.) still terminates in an explicit DB write, never a silent no-op. This directly satisfies "nunca colapsado a un booleano" and "ningún catch silencioso" from the 10-05 must-haves.
- Uses `createServiceClient()` (confirmed in `lib/supabase/service.ts` to use `SUPABASE_SERVICE_ROLE_KEY`, bypassing RLS) — so the write will succeed regardless of `proyectos` RLS policies tied to `user_id`, which matters because this runs inside `after()` with no user session.

**`app/api/proyectos/route.ts` (POST):**
- `after(() => persistZonificacionParaProyecto(proyectoId, direccionZona, municipioZona))` is registered only `if (proyecto?.id && body.direccion && body.municipio)`, placed after the insert succeeds and after the pre-existing SII-fallback block, before the `Response.json` return — matches the documented pattern (mirrors the existing SII `after()` block already in this file).
- `NuevoProyectoSchema` (`lib/schemas.ts`) requires `municipio`; the route separately requires `direccion` via its own `required` array check before reaching the insert — so both fields are guaranteed present whenever a project is successfully created through the normal flow, meaning the `after()` trigger fires on effectively every project creation.

**`app/api/proyectos/[id]/route.ts` (PATCH):**
- Builds `updates` from a whitelist of fields; `if (updates.direccion !== undefined || updates.municipio !== undefined)` gates a second `after()` block registered after the `.update()` succeeds.
- Inside that `after()`, it deliberately re-reads the **current full row** (`direccion`, `municipio`) via `createServiceClient()` rather than trusting the partial `updates` object — correct, since a PATCH touching only `direccion` would otherwise leave `municipio` undefined and vice versa. Guards on `!actual?.direccion || !actual?.municipio` before calling the shared helper. Wrapped in its own `try/catch` with a `console.error` on failure (though note: this outer catch in the route file does *not* itself write `zona_status:'error'` — but `persistZonificacionParaProyecto`'s own internal catch already covers failures inside the helper; this route-level catch only guards the row-read step, which is a reasonable failure mode to just log since no lookup was even attempted).

**Conclusion of inspection:** The code is correct and internally consistent — same shared helper used from both call sites (no drift risk), explicit status on every branch including nested `try/catch`, service-role client bypasses RLS. `npx tsc --noEmit` passes clean across the repo (re-run this session). No stub/placeholder/TODO patterns found in any of the 3 files. This satisfies the letter of criterion 4 by inspection, but — per the task's explicit instruction — the actual authenticated POST/PATCH HTTP path was never exercised end-to-end (documented as a known gap in 10-05-SUMMARY.md, reproduced by this verifier: local auth blocks an unauthenticated curl from driving `/api/proyectos`). Classified as `human_needed`, not a failure.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/zonificacion.ts` | Client-safe types + Zod schema + fetch helper | ✓ VERIFIED | Exists, 54 lines, exports `ZonaStatus`/`ZonaData`/`ZonaLookupResponse`/`ArcGISQueryResponseSchema`/`lookupZonificacion()`. No server-only imports (client-safe as required). Imported by `app/api/zonificacion/lookup/route.ts` and `lib/zonificacion-server.ts`. |
| `app/api/zonificacion/lookup/route.ts` | GET orchestration route | ✓ VERIFIED | Exists, 223 lines, exports `GET`. Registry short-circuit → geocode → cache read-through → ArcGIS query → Zod validate → normalize → cache upsert, exactly as specified. Called by `lib/zonificacion-server.ts` via self-fetch. |
| `lib/zonificacion-server.ts` | Server-only persistence helper | ✓ VERIFIED | Exists, 68 lines, exports `persistZonificacionParaProyecto`. Imported and called by both `app/api/proyectos/route.ts` and `app/api/proyectos/[id]/route.ts`. |
| `app/api/proyectos/route.ts` | POST triggers lookup in background | ✓ VERIFIED | `after()` call present, gated correctly, positioned after successful insert. |
| `app/api/proyectos/[id]/route.ts` | PATCH re-triggers lookup on address change | ✓ VERIFIED | `after()` call present, re-reads current row, positioned after successful update. |
| `lib/zonificacion-comunas.ts` | Per-comuna ArcGIS registry + resolver | ✓ VERIFIED | Exists, 133 lines, 4 comuna entries (`las-condes`, `providencia`, `vitacura`, `nunoa`), `resolveComunaZonificacion()` returns `null` for uncovered comunas, Ñuñoa has `usosDisponibles: false` and UPPERCASE fieldMap as documented. Imported by the lookup route. |
| `lib/geocoding.ts` | Nominatim geocoder | ✓ VERIFIED | Exists, 106 lines, exports `geocodeDireccion()`, reads `address.suburb` with `city` fallback, returns numeric lat/lng, `ok:false` (never throws) on not-found/error. Imported by the lookup route. |
| `supabase/migrations/20260730_zonificacion.sql` | DDL for cache table + zona_* columns + CHECK | ✓ VERIFIED | `zonificacion_cache` table with `UNIQUE INDEX (comuna_id, lat_r, lng_r)`, RLS enabled with service-role-only writes; `proyectos` gains 8 `zona_*` columns idempotently; `zona_status_check` CHECK constraint restricts to the 4 explicit values. Confirmed live/applied per 10-04-SUMMARY.md's successful live curl tests against the cache table (not re-verified live this session; env vars for Supabase connection present in `.env.local`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/api/zonificacion/lookup/route.ts` | `lib/zonificacion-comunas.ts` | `resolveComunaZonificacion(comuna)` | ✓ WIRED | Called at line 57, result gates the `sin_cobertura` short-circuit before any fetch. |
| `app/api/zonificacion/lookup/route.ts` | `lib/geocoding.ts` | `geocodeDireccion(direccion, comuna)` | ✓ WIRED | Called at line 69, error path returns explicit `status:'error'`. |
| `app/api/zonificacion/lookup/route.ts` | `zonificacion_cache` | Service-role read-through by `(comuna_id, lat_r, lng_r)`, upsert after ArcGIS query | ✓ WIRED | Read at lines 88-94, insert at lines 173-193. |
| `app/api/zonificacion/lookup/route.ts` | ArcGIS FeatureServer `/query` | `geometry=lng,lat&inSR=4326&geometryType=esriGeometryPoint&returnGeometry=false` | ✓ WIRED | Lines 112-119 — `geometry` set to `` `${lng},${lat}` `` (lng first, confirmed correct axis order), `inSR` explicitly `'4326'`. |
| `app/api/proyectos/route.ts` (POST) | `lib/zonificacion-server.ts` | `after(() => persistZonificacionParaProyecto(...))` | ✓ WIRED (code-verified, not HTTP-verified) | Present at line 163, gated on `direccion`+`municipio` presence. |
| `app/api/proyectos/[id]/route.ts` (PATCH) | `lib/zonificacion-server.ts` | `after()` gated on `updates.direccion`/`updates.municipio` | ✓ WIRED (code-verified, not HTTP-verified) | Present at lines 129-144, re-reads row before dispatching. |
| `lib/zonificacion-server.ts` | `app/api/zonificacion/lookup/route.ts` | Self-`fetch` to own route | ✓ WIRED | Line 29, builds identical `direccion`+`comuna` query params the route expects. |

### Requirements Coverage

Per `.planning/REQUIREMENTS.md`: Phase 10 has no directly-mapped requirement — documented as enabling infrastructure for Phase 11's user-facing requirements. No requirements to check against.

### Anti-Patterns Found

None. Scanned all 8 files for `TODO|FIXME|XXX|HACK|PLACEHOLDER|not implemented|coming soon` — zero matches (one incidental substring match on the word "Zonificación" in a comment, not a TODO marker). `npx tsc --noEmit` passes clean across the whole repo.

### Human Verification Required

See `human_verification` in frontmatter — 3 items, all converging on the same underlying gap: the `after()` wiring in `app/api/proyectos/route.ts` (POST) and `app/api/proyectos/[id]/route.ts` (PATCH) was verified by close code inspection (this session) and by a direct curl of the underlying `GET /api/zonificacion/lookup` route (10-04's session), but never by a full authenticated HTTP round-trip through `POST`/`PATCH /api/proyectos` itself — both sessions were blocked by the dev server's `supabase.auth.getUser()` check with no session available non-interactively.

Recommend: one manual pass through the actual UI (create a project with an address in Las Condes/Providencia/Vitacura/Ñuñoa, or PATCH an existing project's address) before Phase 11 builds a zonificación view on top of these columns, confirming `zona_status` and the zone snapshot fields populate on the row within a few seconds of the request completing.

### Gaps Summary

No code-level gaps found. All 8 required artifacts exist, are substantive (no stubs/placeholders), and are correctly wired to each other. 4 of 5 success criteria have direct live-test evidence (from 10-04's session, re-confirmed by re-reading the corresponding code this session). The 5th (criterion 4 — automatic persistence on project create/update) is implemented correctly by every code-inspection signal available (shared helper avoiding drift, explicit terminal status on every branch including nested catches, service-role client bypassing RLS, correct gating conditions in both POST and PATCH) but lacks an end-to-end authenticated HTTP test, which was explicitly out of reach in both the 10-05 execution session and this verification session (no interactive browser session to authenticate through). This is classified as `human_needed`, not `gaps_found` — nothing indicates the implementation is wrong, only that the specific verification method (full HTTP round-trip) wasn't available.

---

*Verified: 2026-07-30T21:10:55Z*
*Verifier: Claude (gsd-verifier)*
