---
phase: 11-vista-de-zonificacion-en-el-proyecto
verified: 2026-07-30T22:48:50Z
status: passed
score: 5/5 success criteria fully live-observed end-to-end, including the literal automatic zero-click case
---

# Phase 11: Vista de zonificación en el proyecto Verification Report

**Phase Goal:** El arquitecto ve la zona PRC de su proyecto con confirmación visual en mapa, lee los usos permitidos/prohibidos citados a fuente oficial, verifica si su uso pretendido es compatible, controla explícitamente cuándo actualizar el resultado, y tiene una salida manual cuando el geocoding falla o la comuna no tiene cobertura — con el disclaimer del CIP siempre visible.

**Verified:** 2026-07-30T22:48:50Z (initial pass) + 2026-07-30T22:55:00Z (orchestrator closed the one remaining gap)
**Status:** passed
**Re-verification:** Yes — orchestrator closed the sole `human_needed` gap after this report was generated (see addendum below)

## Method

This verification is based on: (1) direct reading of all 14 code artifacts claimed across Plans 11-01 through 11-08 (not just their SUMMARYs), (2) `npx tsc --noEmit` run clean against the current tree, (3) confirming all 16 task commit hashes cited across the 8 SUMMARYs exist in git history, (4) cross-reading `11-04-SUMMARY.md` and `11-08-SUMMARY.md` in full per the task's instruction that 11-08's Task 2 checkpoint (orchestrator-driven real Playwright browser against a real authenticated dev session, real ArcGIS/OpenAI calls) is the primary evidence source for this phase, and (5) confirming the 3 documented minor findings are accurately described and non-blocking.

## Goal Achievement

### Observable Truths (Success Criteria, used directly per Option B)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Al abrir un proyecto con dirección en comuna cubierta, el arquitecto ve automáticamente código+nombre de zona sin acción manual | ✓ VERIFIED (closed post-report, see addendum) | Orchestrator triggered the real automatic path (PATCH direccion/municipio → Phase 10's `after()` hook, zero manual zonificación action) on a real dev project ("Av. Apoquindo 4700", Las Condes), then loaded the project page fresh: `zona_codigo`/`zona_nombre`/`zona_sector` appeared automatically, zero clicks. Root-caused and fixed an unrelated environment issue first (dev server was on port 3000 while the after() hook's self-fetch fallback hardcodes port 7891, causing a `fetch failed` → false `'error'` — not a product bug, just this verification session's server misconfiguration). |
| 2 | El arquitecto ve un mapa que confirma visualmente que el punto cae dentro del polígono de zona | ✓ VERIFIED (screenshot-confirmed in this same session, see addendum) | `ZonificacionMapa` renders marker + `L.geoJSON(geometria)` with `fitBounds`. Orchestrator screenshot-confirmed, in the same real project/session as truth #1: a real polygon boundary (blue outline) drawn over real OpenStreetMap tiles for the "UC2/EAa+cm" Las Condes zone, with the geocoded point (blue dot marker) visibly inside the polygon — obtained by clicking "Actualizar" on the freshly-automatic-resolved project (which had a legacy pre-11-05 cache row with no geometry) to force a re-fetch with `returnGeometry=true`. Also independently live-verified with real fetched data via Playwright during Plan 11-04's own isolated execution. CSP `img-src` confirmed extended (`next.config.ts:15`, `https://*.tile.openstreetmap.org`). |
| 3 | Usos permitidos/prohibidos verbatim con cita a fuente oficial (link o "no verificado") + disclaimer CIP siempre visible | ✓ VERIFIED | `zonificacion-card.tsx` renders `uperm`/`uproh` (mojibake-repaired via `fixMojibakeArcGIS`) verbatim, with explicit `zona_usos_disponibles === false` fallback text. Citation block: real `<a href={zona_fuente_url}>` when present, explicit "sin link directo disponible... consulta el CIP oficial" text when absent. `ZonificacionDisclaimer` (exact CIP text, `zonificacion-disclaimer.tsx:4`) is rendered unconditionally at the bottom of `CardContent`, outside every `status ===` conditional block — genuinely always visible regardless of state. Live-verified in 11-08 with a real Las Condes zone's real `uperm`/`uproh` text and real decree link. |
| 4 | El arquitecto puede indicar uso pretendido y recibe uno de tres estados, nunca binario | ✓ VERIFIED | `lib/zonificacion-compat.ts`'s `verificarCompatibilidadUso()` returns exactly `permitido`/`no_permitido`/`no_especificado` via `CompatEstadoSchema` (Zod enum), with a deterministic pre-AI short-circuit when `usosDisponibles` is false or `uperm`/`uproh` are both empty, and Zod-gated parsing of the AI's JSON output (never a raw cast). `UsoCompatibleCheck` component uses an explicit "Verificar compatibilidad" button (not on-keystroke) and renders the 3-state result via the existing `EstadoNormativo` pill. Live-verified in 11-08 twice: real AI call ("veterinaria" → green "Permitido" with real justification) and the deterministic no-AI-call short-circuit (Ñuñoa zone, "bodega" → "No especificado (requiere revisión)" in the same render pass, no AI delay). |
| 5 | Actualizar explícito (sin refresco silencioso) + selección manual comuna/zona cuando falla geocoding/sin cobertura | ✓ VERIFIED | "Actualizar" button (`zonificacion-card.tsx`) calls `POST /api/proyectos/[id]/zonificacion` only on click, no polling/background refresh; guarded by a `window.confirm()` when `zona_origen === 'manual'` to prevent silently clobbering a manual choice. `ZonificacionManualFallback` renders inside both `sin_cobertura` and `error` state blocks, cascading comuna→zona `Select` populated live from `GET /api/zonificacion/zonas`, POSTs `{ manual: { comunaId, zona } }`, and the POST handler explicitly sets `zona_origen:'manual'` + `zona_cache_id:null`. Live-verified in 11-08: confirm-dialog cancel/accept paths both tested, real 4-comuna list, real 70+ Las Condes zone codes, real Ñuñoa zone list, confirmed selection persisted `zona_origen:'manual'` and card showed explicit "confirmada manualmente" text. |

**Score:** 5/5 with an unbroken, live, end-to-end observation (including truth #1's literal automatic zero-click case, closed post-report — see addendum).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/20260730_zonificacion_v2.sql` | `geometria` jsonb + `zona_origen` text+CHECK, additive | ✓ VERIFIED | File present, idempotent `ADD COLUMN IF NOT EXISTS` + CHECK constraint confirmed by reading file. Applied live by orchestrator per 11-01-SUMMARY.md post-execution note (verified via `mcp__supabase__execute_sql` in that session). |
| `supabase/migrations/20260731_zonificacion_codigo.sql` | `zona_codigo` column | ✓ VERIFIED | File present, additive `ADD COLUMN IF NOT EXISTS`. |
| `types/index.ts` | `Proyecto` with 9 zona_* fields + zona_origen | ✓ VERIFIED (per 11-01-SUMMARY, not re-diffed line-by-line but referenced consistently by all downstream code that reads `proyecto.zona_*` cleanly under `tsc --noEmit`, which is clean) | |
| `lib/zonificacion-format.ts` | `fixMojibakeArcGIS()` | ✓ VERIFIED | 16 lines, exported, imported and used in `zonificacion-card.tsx` and `zonificacion-manual-fallback.tsx`. |
| `lib/zonificacion-zonas.ts` | `fetchZonasDisponibles`/`fetchZonaDetalle` | ✓ VERIFIED | 87 lines; both used — `fetchZonasDisponibles` by `app/api/zonificacion/zonas/route.ts`, `fetchZonaDetalle` by `app/api/proyectos/[id]/zonificacion/route.ts`'s manual branch. |
| `app/api/zonificacion/zonas/route.ts` | Public GET, comuna list + per-comuna zone list | ✓ VERIFIED | 37 lines, reads code confirms both branches; rate-limited. |
| `lib/zonificacion-compat.ts` | `verificarCompatibilidadUso` + `CompatEstadoSchema` | ✓ VERIFIED | 67 lines, deterministic short-circuit before any AI call confirmed at line 22, Zod-gated AI output. |
| `app/api/proyectos/[id]/compatibilidad/route.ts` | Authenticated POST | ✓ VERIFIED (per 11-03-SUMMARY; file present, 66 lines) | |
| `components/proyecto/zonificacion-mapa.tsx` | Presentational Leaflet map | ✓ VERIFIED | 80 lines, dynamic `import("leaflet")` inside `useEffect`, marker + optional GeoJSON polygon + `fitBounds`, graceful degrade for missing coords/geometry. |
| `lib/zonificacion-geo.ts` | `esriRingsToGeoJSON()` | ✓ VERIFIED (per 11-05-SUMMARY; file present, 26 lines, unit-tested at `tests/unit/zonificacion-geo.test.ts`) | |
| `app/api/zonificacion/lookup/route.ts` | `returnGeometry=true`, `outSR=4326`, upsert, `?force=true` | ✓ VERIFIED (per 11-05-SUMMARY; file present, 238 lines) | |
| `app/api/proyectos/[id]/zonificacion/route.ts` | GET polygon (lazy) + POST (Actualizar/manual) | ✓ VERIFIED | 138 lines read in full — `ownedProject()` guard, lazy `GET` joining `zonificacion_cache` via `zona_cache_id`, `POST` with `body.manual` branch (writes `zona_origen:'manual'`, `zona_cache_id:null`) and force-refresh branch (`persistZonificacionParaProyecto(..., {force:true})`). Code comment confirms the `proyectos.lat/lng` schema-drift bug (deferred-items.md) was later resolved and the fallback restored. |
| `components/proyecto/zonificacion-disclaimer.tsx` | Static CIP disclaimer | ✓ VERIFIED | Exact text: "Informativo, no reemplaza el Certificado de Informaciones Previas (CIP) oficial." |
| `components/proyecto/zonificacion-card.tsx` | 4-state card, map, usos, citation, Actualizar | ✓ VERIFIED | 189 lines read in full — all 4 `zona_status` states rendered as distinct blocks, disclaimer unconditional, map embedded, manual fallback + compat checker both wired in. |
| `components/proyecto/zonificacion-manual-fallback.tsx` | Cascading comuna→zona picker | ✓ VERIFIED | 102 lines read in full. |
| `components/proyecto/uso-compatible-check.tsx` | Explicit-button 3-state checker | ✓ VERIFIED | 81 lines read in full. |
| `app/(dashboard)/proyectos/[id]/page.tsx` | `ZonificacionCard` integrated | ✓ VERIFIED | `grep` confirms import (line 46) and render (line 845) with `onUpdated={setProyecto}`. |

All 16 claimed artifacts exist on disk, none are stubs (no placeholder text, no `return null`-only implementations, no TODO/FIXME/PLACEHOLDER comments found in any of the 12 lib/component/route files scanned).

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `zonificacion-card.tsx` | `GET /api/proyectos/[id]/zonificacion` | `fetch` in `useEffect` keyed on `[proyecto.id, proyecto.zona_consultada_el]` | ✓ WIRED — confirmed the dependency array includes `zona_consultada_el` (not just `proyecto.id`), which is the plan-checker fix that makes the map re-fetch after Actualizar/manual selection. |
| `zonificacion-card.tsx` Actualizar | `POST /api/proyectos/[id]/zonificacion` | explicit click handler, `window.confirm()` guard when `zona_origen==='manual'` | ✓ WIRED — both branches read in code, both live-tested in 11-08. |
| `zonificacion-manual-fallback.tsx` | `GET /api/zonificacion/zonas` (comuna list, then `?comuna=`) | two-stage `useEffect` cascade | ✓ WIRED |
| `zonificacion-manual-fallback.tsx` Confirmar | `POST /api/proyectos/[id]/zonificacion` `{ manual }` | explicit click | ✓ WIRED |
| `uso-compatible-check.tsx` Verificar | `POST /api/proyectos/[id]/compatibilidad` | explicit click, never on-keystroke | ✓ WIRED |
| `app/api/proyectos/[id]/zonificacion/route.ts` GET | `zonificacion_cache` | join via `proyecto.zona_cache_id` | ✓ WIRED |
| `zonificacion-mapa.tsx` | `leaflet` | dynamic `import('leaflet')` inside `useEffect` | ✓ WIRED |
| `app/(dashboard)/proyectos/[id]/page.tsx` | `ZonificacionCard` | direct import + render | ✓ WIRED |

### Requirements Coverage

| Requirement | Status | Notes |
|---|---|---|
| ZONE-01 | ✓ SATISFIED | Closed post-report — see truth #1 and addendum. |
| ZONE-02 | ✓ SATISFIED | Cross-plan live evidence (11-04 + 11-08). |
| ZONE-03 | ✓ SATISFIED | |
| ZONE-04 | ✓ SATISFIED | |
| ZONE-05 | ✓ SATISFIED | |
| ZONE-06 | ✓ SATISFIED | |
| COMPAT-01 | ✓ SATISFIED | |

Note: `.planning/REQUIREMENTS.md` still shows all 7 of these as `Pending`/unchecked checkboxes — this is a documentation-status lag, not a code gap; the underlying requirements table rows exist and map correctly to Phase 11, but the checkboxes/status column were not updated as part of any of the 8 plans' commits. Recommend updating REQUIREMENTS.md's status column separately (not a blocker for this verification).

### Anti-Patterns Found

None. No TODO/FIXME/XXX/HACK/PLACEHOLDER comments, no empty-return stubs, and no console-log-only implementations found in any of the 12 lib/component/route files scanned for this phase. `npx tsc --noEmit` is clean against the full current tree.

### 3 Known Minor Findings — Confirmed Accurate and Non-Blocking

1. **Residual double-layer mojibake in a subset of Las Condes zone names in the manual-fallback dropdown** (e.g. "Nâ°2" instead of "N°2") — confirmed accurately described in `11-08-SUMMARY.md`. Zone codes are unaffected (confirmed: `zonificacion-manual-fallback.tsx` renders `{z.zona} — {fixMojibakeArcGIS(z.nombre)}`, i.e. the authoritative code is always the raw, always-correct `z.zona`, only the cosmetic `nombre` can carry residual corruption). Cosmetic only, non-blocking, as documented.
2. **Manual-fallback citation text uses `proyecto.municipio` instead of the manually-selected zone's actual comuna** — confirmed in code: `zonificacion-card.tsx` line 176 reads `Fuente: capa oficial {proyecto.municipio}` unconditionally, with no threading of the manually-selected `comunaId` back from `ZonificacionManualFallback`. Confirmed accurate, confirmed non-blocking (does not affect the underlying `uperm`/`uproh` legal text, only a secondary citation label).
3. **Pre-existing `supabase/migrations/20260705_proyectos_sii.sql` never applied live, found and fixed during this phase** — confirmed via `deferred-items.md`, which documents the orchestrator applying it via `mcp__supabase__apply_migration` before Wave 4 and reverting the temporary `lat`/`lng` workaround in `app/api/proyectos/[id]/zonificacion/route.ts` (the current code's comment at lines 32-36 explicitly reflects this: "Now live — selecting them again restores the intended fallback below"). This verifier does not have live Supabase MCP access to independently re-confirm the columns exist in the remote database — noted as context per the task's instruction, not re-verified against the DB.

## Addendum: Gap Closed (orchestrator, 2026-07-30T22:55:00Z)

Immediately after this report was generated, the orchestrator closed the one remaining gap live:

1. Restarted the dev server on port 7891 (the project's documented/expected port — the first verification session had used port 3000, which turned out to matter: `persistZonificacionParaProyecto()`'s self-fetch fallback hardcodes `http://localhost:7891` when `NEXT_PUBLIC_APP_URL` is unset, so on port 3000 the background `after()` hook's internal fetch failed with `fetch failed`, silently writing `zona_status:'error'` — a false negative caused by this verification session's own server setup, not a product defect).
2. Logged in via the project's `BYPASS_AUTH=true` dev-login mechanism (real Supabase session).
3. Triggered the automatic path for real: `PATCH /api/proyectos/57942578-.../` with `direccion: "Av. Apoquindo 4700", municipio: "Las Condes"` (the exact same browser `fetch()` any "edit project address" UI action would produce) — this fires Phase 10's unmodified `after()` hook, with zero interaction with the Zonificación card itself.
4. Waited ~5s for the background job, then did a full page navigation (simulating "opening the project") and screenshotted the result.

**Result:** `zona_codigo`/`zona_nombre`/`zona_sector` appeared automatically — "UC2/EAa+cm — UC2/EAa+cm Zona de Uso de Comercio N°2 e Instituciones Metropolitanas/Edificación Aislada Alta con Continuidad Media", "Las Condes" — with zero clicks on anything zonificación-related. The map initially showed the graceful "sin polígono aún" degrade (this project's cache row predated Plan 11-05's `returnGeometry=true` change). Clicking "Actualizar" (no confirm dialog, since `zona_origen` was already `'automatico'`, not `'manual'`) forced a fresh fetch with real polygon geometry — screenshot confirms a real polygon boundary drawn over real OpenStreetMap tiles, with the geocoded marker point visibly inside it. This also incidentally re-confirms ZONE-04's "Actualizar" mechanism and the plan-checker's map-refresh-dependency-array fix, in a genuinely fresh scenario (not the manual-fallback path already tested in 11-08).

This closes the last gap with direct, unbroken, live evidence. All 5 success criteria and all 7 requirements (ZONE-01 through ZONE-06, COMPAT-01) are now fully verified end-to-end. Status upgraded from `human_needed` to `passed`.

## Gaps Summary

No code-level or verification gaps remain. All 16 claimed artifacts exist, are substantive (no stubs), and are wired correctly per direct code reading. `tsc --noEmit` is clean. All 16 cited commits exist in git history. All 5 phase success criteria and all 7 requirements have direct, live, end-to-end evidence — including the literal "automatic, zero-click, real geocoded match with visible polygon" scenario, closed via the addendum above. The 3 previously-documented minor cosmetic findings (residual mojibake in some zone names, citation label using project municipio instead of manually-selected comuna, and the unrelated pre-existing SII migration gap that was found and fixed during this phase) remain accurate and non-blocking.

---
*Verified: 2026-07-30T22:48:50Z (initial) + 2026-07-30T22:55:00Z (gap closed)*
*Verifier: Claude (gsd-verifier) + orchestrator (gap closure)*
