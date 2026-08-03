# Phase 17: Demografía y Consumo - Research

**Researched:** 2026-08-03
**Domain:** Server-side spatial aggregation of Chilean public census data (INE Censo 2017, manzana-level, via live ArcGIS REST polygon-intersect query) + a static, comuna/macro-zona-level consumption/income proxy (EPF + CASEN), composed into an optional `demografia` field on the same `AnalisisCabidaComercial` type Phase 16 (isochrone) and Phase 18 (competencia) already extend
**Confidence:** HIGH on the population/census piece (every claim below is either live-verified against a real HTTP endpoint in this research pass, or a direct reading of this exact codebase's real files) — MEDIUM on EPF/CASEN's exact downloadable file format and full category breakdown (official pages don't expose a machine-readable download link discoverable by this pass; the granularity/vintage/representativity claims themselves ARE verified against official INE/MDS sources, just not the literal file format)

## User Constraints

No `CONTEXT.md` exists for this phase — `/gsd:discuss-phase 17` was skipped. There are no locked user decisions beyond `PROJECT.md`/`REQUIREMENTS.md`/`ROADMAP.md`. Everything in this document is Claude's Discretion within those boundaries, except the three requirements below, which are locked (verbatim from `.planning/REQUIREMENTS.md`) and must be treated as the binding spec, not alternatives to explore:

- **DEMO-01**: El tab muestra población estimada dentro del área de influencia, por intersección geoespacial con Censo 2017 (manzana), con disclaimer de antigüedad del dato
- **DEMO-02**: El tab muestra capacidad de gasto estimada por categoría de consumo (ingreso/pobreza comunal vía CASEN + share de categoría vía EPF), etiquetada explícitamente como "estimado agregado a nivel macro-zona, no medido en el área específica" — nunca presentado con precisión de isócrona
- **DEMO-03**: Cada cifra demográfica/de consumo muestra su fuente y año/vintage de forma visible — nunca mezclando vintages censales (2017 vs. 2024) sin declararlo

**CRITICAL sequencing constraint (from the orchestrator, equally binding):** Phase 17 is being planned out of order, exactly like Phase 18 was. Phase 16 (Ubicación e Isócrona) is **still incomplete** — live-verified in this pass:

```
$ ls lib/cabida-comercial-server.ts lib/isocrona-server.ts
MISSING: lib/cabida-comercial-server.ts
MISSING: lib/isocrona-server.ts
```

Per `.planning/STATE.md` (read live): Plan 16-01 is paused — `ORS_API_KEY` is set, HeiGIT's account migration is mid-propagation, both `api.openrouteservice.org` and `api.heigit.org` return 403 "Access to this API has been disallowed." Plans 16-04 (the file above) and 16-05 (the API route + tab) cannot run until 16-01 unblocks. What **does** exist and is stable: `lib/cabida-comercial.ts` (client-safe types: `UbicacionCabida`, `IsocronaResultado`, `FormatoComercial`, `AnalisisCabidaComercial`, plus Phase 18's additive `competencia?` field) and the narrow `cabida_comercial_cache` table (`supabase/migrations/20260809_cabida_comercial_cache.sql` — isochrone-only columns, explicitly documented in its own header comment as designed for Phase 17/18 to extend additively).

Practical implication, following the exact pattern Phase 18 already used successfully (5/8 plans executed while blocked on Phase 16): Phase 17 must build every self-contained piece — the ArcGIS census query module, the EPF/CASEN static consumption lookup, the additive cache-table migration, the new types — as **standalone, independently testable code that does not import `lib/cabida-comercial-server.ts`**. Exactly one final task composes into `obtenerAnalisisCabidaComercial()`, and it must be isolated into its own plan, gated behind a live prerequisite check (clone Phase 18's Plan 18-07 `Task 1` verbatim: `ls`/`grep` for the file and function, stop cleanly with no stub if absent), not silently interleaved with the independent work.

## Summary

Phase 17 has one genuinely new integration (INE's Census 2017 manzana-level ArcGIS FeatureServer, queried with a polygon spatial filter) and one piece that is deliberately *not* an integration at all (EPF/CASEN, which this research confirms should be static, committed data — there is nothing to query live). Both are decoupled from Phase 16's still-unbuilt isochrone engine and can be built and unit-tested today against a hand-crafted GeoJSON polygon standing in for a real isochrone.

**The single most important finding of this research pass is a correction to the milestone-level `STACK.md`/`ARCHITECTURE.md`, not a confirmation of it.** Those documents cite `services3.arcgis.com/cTnMkBRk4HWkUCRo/.../SHAPES_CENSO_2017/FeatureServer` (layer 8, `MANZANA_IND_C17`) as "live-queried, confirmed" for manzana-level population. This research pass queried that exact service live, with a real polygon around a real Providencia (Santiago) address, following the milestone research's own open question ("does the manzana layer actually support polygon-intersect, not just comuna aggregation?"). The query succeeded mechanically (HTTP 200, correct GeoJSON-shaped response) — but **returned zero features**, and a follow-up aggregate query revealed why: that specific FeatureServer instance contains only 3,928 manzanas total, covering exactly 8 comunas, all in the **Región de Atacama** (Copiapó, Caldera, Vallenar, etc.) — **zero coverage of the Región Metropolitana**, where 100% of `mercado_locales_listings` oportunidades live. The milestone research's "confirmed live" claim was true for field existence but never checked comuna coverage — a real, load-bearing gap this pass closes.

The correct service, found and live-verified in this pass, is `services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0` — same field family (`TOTAL_PERS`, `TOTAL_VIVI`, `MANZENT_I`, `NOM_COMUNA`, plus `NHOMBRES`/`NMUJERES` this one adds), but **158,927 manzanas nationally, 49,974 of them in "REGIÓN METROPOLITANA DE SANTIAGO"** (verified via a live `groupByFieldsForStatistics` call). A polygon-intersect query against a real Providencia bounding box returned real manzana rows (`NOM_COMUNA: "PROVIDENCIA"`, populations from 30 to 583 residents per manzana) on the first successful attempt. **Use this URL, not the one cited in STACK.md/ARCHITECTURE.md.**

Because the live spatial query works and is cheap (a handful of manzana rows per isochrone, well under the layer's 2,000-record page limit for any realistic 10-15 minute walking/driving area), **Phase 17 does not need PostGIS, and does not need to bulk-ingest census geometries into Supabase.** This is a second correction to the milestone-level STACK.md, which recommended a PostGIS-backed bulk-ingestion architecture on the assumption that live polygon queries were unverified/risky. `mcp__supabase__list_extensions` (re-checked live in this pass) confirms `postgis` is still `installed_version: null` — available but not installed — and this research recommends **not installing it for Phase 17**: the same "live query per request, cache-through by rounded coordinates" pattern already proven for zonificación (ArcGIS MINVU/OCUC) and planned for isochrones (ORS) applies unchanged here, just with a polygon geometry instead of a point as the query parameter.

EPF and CASEN are structurally different from census population and must be treated as static, not live-queried, data:
- **EPF (Encuesta de Presupuestos Familiares)**: most recent published edition is the **IX EPF, fieldwork October 2021–September 2022** (the X EPF's fieldwork was still in its testing phase as of mid-2025 per INE's own site, not yet published). It classifies spending into Chile's CCIF 2018.CL system (Chile's COICOP adaptation) — 12 divisions (Alimentos y bebidas no alcohólicas; Bebidas alcohólicas/tabaco; Vestuario y calzado; Vivienda/agua/electricidad/gas; Muebles y equipamiento del hogar; Salud; Transporte; Información y comunicación; Recreación/deportes/cultura; Educación; Restaurantes y alojamiento; Seguros y servicios financieros; Cuidado personal y bienes diversos — INE's own press release groups the last two into one "diversos" bucket in some summaries, so treat the exact division count as 12-13 depending on source, not a single hardcoded number). Real, citable shares from the IX EPF national/regional-capital release: Alimentación 21.2%, Vivienda/agua/electricidad/gas 16.0%, Transporte 15.0% of average household spending. Representative **only** at Gran Santiago / regional-capital level — this is confirmed again in this pass (INE's own EPF methodology framing, unchanged from milestone research) — never comuna, never isochrone.
- **CASEN**: most recent edition is **CASEN 2024** (fieldwork Nov 2024–Feb 2025, results published starting Jan 2026), covering 335 comunas via the Ministerio de Desarrollo Social y Familia's "Estimación de Área Pequeña" (SAE/EAP) methodology at `observatorio.ministeriodesarrollosocial.gob.cl/pobreza-comunal` — this **does** confirm comuna-level granularity for poverty incidence (a real improvement over CASEN's own direct-survey sample, which is only reliable at regional level; SAE statistically borrows strength from administrative records to produce a comuna estimate). The page references a "Data Social" platform (`datosocial.ministeriodesarrollosocial.gob.cl`) for interactive/downloadable access; this pass could not confirm the literal file format (XLSX/CSV/API) behind that portal — flagged as an Open Question, not a blocker, since the underlying comuna-level poverty-rate numbers are a small, static, hand-verifiable dataset regardless of source format.

**Primary recommendation:** Build three independently-testable pieces now, all decoupled from `lib/cabida-comercial-server.ts`: (1) `lib/censo-manzana-server.ts` — a pure function `obtenerPoblacionEnPoligono(geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon)` that queries the corrected `services9.arcgis.com` FeatureServer live with the polygon as spatial filter and aggregates `TOTAL_PERS`/`TOTAL_VIVI`, callable and testable today with a hand-crafted polygon exactly like the one used in this research pass; (2) `lib/consumo-macro-zona.ts` — a static, committed lookup (EPF national/Gran-Santiago spending-share constants + a CASEN comuna→poverty-rate/income table, both hand-verified data, same `type: static-kb` pattern as `lib/strip-power-centers-chile.ts`), pure function `obtenerConsumoEstimado(comuna: string)`, zero external calls, zero caching needed; (3) additive migration on `cabida_comercial_cache` (`demografia_*` columns, same per-field-status discipline as the isochrone columns) applied now via `mcp__supabase__apply_migration`, independent of Phase 16's code. A final, isolated, gated plan — cloning Phase 18's `18-07-PLAN.md` verbatim — wires both into `obtenerAnalisisCabidaComercial()` once `lib/cabida-comercial-server.ts` exists, reusing the isochrone geometry already computed in that same call rather than recomputing it.

## Standard Stack

### Core

| Library/Service | Version | Purpose | Why Standard |
|---|---|---|---|
| INE Censo 2017 ArcGIS FeatureServer (**corrected URL**: `services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0`) | live REST, `esriGeometryPolygon` spatial query | Population/dwellings per manzana within an arbitrary polygon | Live-verified in this pass: national coverage (158,927 manzanas, 49,974 in RM), supports `spatialRel=esriSpatialRelIntersects` with a caller-supplied polygon, returns `TOTAL_PERS`/`TOTAL_VIVI`/`NHOMBRES`/`NMUJERES`/`MANZENT_I`/`NOM_COMUNA` directly. Same ArcGIS-REST integration paradigm this codebase already uses for MINVU/OCUC zoning and INE building permits — new URL/fields, zero new integration pattern. |
| Zod (existing dependency) | already in project | Validate the ArcGIS response shape before trusting `TOTAL_PERS`/`TOTAL_VIVI` | Same discipline this codebase already applies to `ArcGISQueryResponseSchema` in `lib/zonificacion.ts` — this is literally the same ArcGIS `query` response envelope shape, a new Zod schema for a new field set, not a new validation pattern. |
| Static, committed TypeScript data (no library) | n/a | EPF spending-share constants + CASEN comuna poverty/income table | Both sources are periodically-published survey results (EPF every ~5 years, CASEN every 2-3), not live-queryable APIs — same "git-versioned, hand-maintained, PR-reviewed" pattern already established in this codebase for `lib/strip-power-centers-chile.ts` (Phase 18) and `lib/comunas-chile.ts`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| Esri JSON ring conversion (hand-rolled, ~10 lines) or `@turf/turf`'s geometry helpers (already a dependency per Phase 16/18 research) | `@turf/turf@^7.3.5` (already in `package.json`) | Convert the isochrone's GeoJSON `Polygon`/`MultiPolygon` (`IsocronaResultado.geometria`) into the Esri `{rings: [...], spatialReference: {wkid: 4326}}` shape the ArcGIS query endpoint expects | GeoJSON and Esri JSON polygon ring order/nesting are structurally similar (array of linear rings of `[lng, lat]` pairs) but not identical in outer/hole-ring winding convention for complex multi-polygons — write this conversion in exactly one place with an inline comment, same discipline as the `lib/zonificacion-geo.ts` Esri→GeoJSON conversion this codebase already has (this phase needs the inverse direction). |
| `POST` instead of `GET` for the ArcGIS `/query` call | n/a | Avoid URL-length limits when the isochrone polygon has many vertices | A 15-minute walking isochrone from ORS/openrouteservice can have a complex boundary (potentially 100+ vertices) — passing that as a GET query-string parameter risks exceeding typical URL length limits (~8KB in many proxies/CDNs). ArcGIS's REST `query` endpoint accepts the exact same parameters via POST body (`application/x-www-form-urlencoded` or `multipart/form-data`) — use POST unconditionally for this specific call, unlike the simple point-based zonificación query which is small enough for GET. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Live per-request ArcGIS polygon query (recommended) | Bulk-ingest all 49,974 RM manzana geometries into a new `census_manzana` PostGIS table, `ST_Intersects` server-side (the milestone-level STACK.md's original recommendation) | Would require enabling the `postgis` extension (currently `installed_version: null` — confirmed live, again, in this pass) plus a one-time ETL job and an ongoing story for re-syncing if INE ever republishes the layer. Live-verified in this pass that the ArcGIS service itself already does the spatial intersection correctly and cheaply per request — the bulk-ingestion architecture solves a problem (unreliable/unverified polygon query) that this research pass has now closed. Revisit only if the ArcGIS service proves unreliable in production (rate limits, downtime) once Phase 17 ships — not a reason to build the heavier architecture up front. |
| Static, committed EPF/CASEN data | A live scraper/cron against `datosocial.ministeriodesarrollosocial.gob.cl` or INE's EPF page | Both sources publish on a multi-year cadence (EPF ~5 years, CASEN ~2-3 years) with no stable public API discovered in this pass (both official pages point to portals meant for human/dashboard use, not machine consumption) — same reasoning already applied to `lib/strip-power-centers-chile.ts`: nothing would trigger a re-fetch on a useful schedule, so a scraper/cron is pure overhead versus a small, PR-reviewed static table. |

**Installation:** No new packages required. `@turf/turf` is already a `package.json` dependency (added for Phase 16/18's isochrone/distance work, even though Phase 16 hasn't finished executing — confirmed via `grep turf package.json`).

## Architecture Patterns

### Recommended File Structure

```
lib/
├── cabida-comercial.ts              # EXISTING (Phase 16 + 18) — ADD: PoblacionCensoResultado,
│                                     #   ConsumoEstimadoResultado, DemografiaResultado types
├── cabida-comercial-server.ts       # NOT YET BUILT (Phase 16-04) — Phase 17's final wiring
│                                     #   task adds obtenerDemografiaYConsumo() here. GATED.
├── censo-manzana-server.ts          # NEW — live ArcGIS polygon query, standalone/pure by geometry
├── consumo-macro-zona.ts            # NEW — static EPF+CASEN lookup, pure by comuna, no network
supabase/migrations/
└── 2026XXXX_cabida_comercial_cache_demografia.sql   # NEW — additive demografia_* columns
.planning/
└── data-sources.yaml                # ADD 2 entries: ine-censo-2017-manzana (api-endpoint),
                                      #   epf-casen-consumo-estimado (static-kb)
```

### Pattern 1: Pure function by geometry, not by oportunidad or lat/lng point (mirrors Phase 18's `obtenerCompetenciaPorFormato`)

**What:** `obtenerPoblacionEnPoligono(geometria)` takes only a GeoJSON `Polygon`/`MultiPolygon` — never an `oportunidadId`, never even a bare `lat`/`lng`. This is the same "resolver split" discipline Phase 16's own research established (`obtenerAnalisisCabidaComercial` never sees `oportunidadId`) applied one level deeper: the population function doesn't even need to know how the polygon was produced (real isochrone vs. `circulo_equivalente` fallback vs. a hand-drawn test polygon in a unit test).
**Why this matters for the out-of-order sequencing:** it's the exact property that makes this piece buildable and testable *today*, before Phase 16's isochrone engine exists — construct any valid `GeoJSON.Polygon` (as this research pass did with a plain bounding box) and the function works identically whether that polygon came from ORS, `turf.circle()`, or a test fixture.

```typescript
// lib/censo-manzana-server.ts
import { z } from 'zod'

const CENSO_2017_MANZANA_FEATURESERVER =
  'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0/query'
// CORREGIDO en esta investigación — NO usar services3.arcgis.com/cTnMkBRk4HWkUCRo/...
// (esa URL, citada en STACK.md/ARCHITECTURE.md a nivel de milestone, cubre SOLO 8 comunas
// de la Región de Atacama — verificado en vivo, cero cobertura RM). Esta URL SÍ tiene
// cobertura nacional (158.927 manzanas, 49.974 en Región Metropolitana — verificado en
// vivo vía groupByFieldsForStatistics).

const ManzanaFeatureSchema = z.object({
  attributes: z.object({
    TOTAL_PERS: z.number().int(),
    TOTAL_VIVI: z.number().int(),
    MANZENT_I: z.string(),
    NOM_COMUNA: z.string(),
  }),
})
const ArcGisCensoResponseSchema = z.object({
  features: z.array(ManzanaFeatureSchema),
  exceededTransferLimit: z.boolean().optional(),
})

export interface PoblacionCensoResultado {
  totalPersonas: number
  totalViviendas: number
  manzanasIntersectadas: number
  comunasTocadas: string[]
  censoAno: 2017            // NUNCA opcional — DEMO-03
  fuente: 'INE Censo 2017 — manzana censal'
  consultadoEl: string
  paginado: boolean          // true si exceededTransferLimit — ver Pitfall 3
}

/**
 * Pura por geometría — nunca acepta oportunidadId ni lat/lng directo (mismo
 * criterio que obtenerCompetenciaPorFormato() de Fase 18). Convierte GeoJSON
 * → Esri rings, hace la consulta espacial vía POST (no GET — ver Pitfall 3),
 * agrega TOTAL_PERS/TOTAL_VIVI de las manzanas retornadas. Nunca lanza —
 * retorna un resultado con totales en 0 y un flag si la consulta falla,
 * mismo contrato "non-success explícito" que geocodeDireccion().
 */
export async function obtenerPoblacionEnPoligono(
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): Promise<PoblacionCensoResultado> {
  const rings = geometriaGeoJsonARings(geometria) // conversión en UN solo lugar — ver Standard Stack
  const body = new URLSearchParams({
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPolygon',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    outFields: 'TOTAL_PERS,TOTAL_VIVI,MANZENT_I,NOM_COMUNA',
    returnGeometry: 'false',
    f: 'json',
  })
  // POST, no GET — un polígono de isócrona real puede exceder límites de
  // longitud de URL (Standard Stack, Supporting).
  const res = await fetch(CENSO_2017_MANZANA_FEATURESERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  // ... parse con ArcGisCensoResponseSchema, agregar, retornar. Nunca lanza.
}
```

### Pattern 2: Static macro-zone/comuna lookup, zero network, zero cache (EPF + CASEN)

**What:** Unlike population (a live spatial query) and unlike Phase 18's competencia (three live external calls), consumption data needs **no external call at request time at all** — it's a small, static, committed table looked up by `comuna` (already present on `UbicacionCabida` from Phase 16). This is architecturally closer to `lib/comunas-chile.ts` than to `lib/geocoding.ts`.

```typescript
// lib/consumo-macro-zona.ts
export type MacroZonaEpf = 'gran_santiago' | 'resto_capitales_regionales' | 'total_capitales_regionales'

// IX EPF (oct 2021 - sept 2022) — última edición publicada (X EPF en terreno
// desde 2025, no publicada aún — ver Open Questions). Shares nacionales de
// capitales regionales citadas textualmente del informe INE.
export const EPF_PARTICIPACION_POR_CATEGORIA: Record<string, number> = {
  'Alimentos y bebidas no alcohólicas': 0.212,
  'Vivienda, agua, electricidad, gas y combustibles': 0.160,
  'Transporte': 0.150,
  // ... resto de las 12 divisiones CCIF 2018.CL — completar con cifras
  // reales del informe antes de shippear (ver Open Questions: shares
  // exactos de las 9 categorías restantes no confirmados en esta pasada).
}

export interface CasenComunaEstimado {
  comuna: string
  tasaPobrezaPersonas: number   // % — Estimación de Área Pequeña (SAE), CASEN 2024
  fuenteAno: 2024
}
// Tabla estática ~346 filas — a poblar desde
// observatorio.ministeriodesarrollosocial.gob.cl/pobreza-comunal (2024),
// mismo patrón editorial que STRIP_POWER_CENTERS_CHILE (Fase 18): PR-revisada,
// no un scraper (ver Alternatives Considered).
export const CASEN_POBREZA_POR_COMUNA: CasenComunaEstimado[] = [ /* ... */ ]

export interface ConsumoEstimadoResultado {
  categorias: { nombre: string; participacionPct: number }[]
  tasaPobrezaComunal: number | null   // null si la comuna no aparece en la tabla SAE
  nivelGeografico: 'macro_zona_gran_santiago' | 'comunal'  // NUNCA uno solo para todo el objeto — DEMO-02/03
  disclosure: string   // "estimado agregado a nivel macro-zona, no medido en el área específica" — literal, nunca omitido
  epfAno: 2022          // fin del período de terreno IX EPF (oct 2021-sept 2022)
  casenAno: 2024
  fuente: string
}

/** Pura por comuna — cero llamadas de red, cero caché necesario. */
export function obtenerConsumoEstimado(comuna: string): ConsumoEstimadoResultado {
  /* lookup directo, nunca lanza, tasaPobrezaComunal:null si no está en la tabla */
}
```

### Pattern 3: Additive cache columns on `cabida_comercial_cache`, keyed by the SAME `(lat_r, lng_r, modo, minutos)` as the isochrone

**What:** Population depends on the isochrone geometry, so it belongs in the same cache row, keyed identically — exactly the "one table, per-field status, not three tables" decision the milestone `ARCHITECTURE.md` already made explicit for competencia (Key Decision 2), now applied to demografía.
**Consumption does NOT need a cache column at all** — it's a synchronous static lookup by `comuna`, recomputed on every call for free (no I/O, no latency to amortize). Do not add `consumo_*` columns to the cache table; only `demografia_*` (population) needs one.

```sql
-- supabase/migrations/2026XXXX_cabida_comercial_cache_demografia.sql
-- Aditivo, mismo patrón que 20260730_zonificacion.sql → _v2.sql y que
-- Fase 18's 20260810_cadenas_sucursales_geocoding.sql. NO toca las columnas
-- de isócrona existentes.

ALTER TABLE cabida_comercial_cache
  ADD COLUMN demografia_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN demografia_total_personas integer,
  ADD COLUMN demografia_total_viviendas integer,
  ADD COLUMN demografia_manzanas_intersectadas integer,
  ADD COLUMN demografia_censo_ano integer,      -- SIEMPRE 2017 hoy, pero explícito no hardcodeado (DEMO-03)
  ADD COLUMN demografia_consultado_el timestamptz;

ALTER TABLE cabida_comercial_cache
  ADD CONSTRAINT cabida_comercial_cache_demografia_status_check
  CHECK (demografia_status IN ('pendiente', 'encontrado', 'error'));

COMMENT ON COLUMN cabida_comercial_cache.demografia_status IS
  'Independiente de isocrona_status (Fase 16) y competencia_status (Fase 18 — si se agregó) — tres servicios externos con tres fallas independientes, mismo criterio que zona_status nunca-solo-nullability.';
```

This migration **can be applied now** via `mcp__supabase__apply_migration`, exactly as Phase 18's `20260810_cadenas_sucursales_geocoding.sql` was applied independently of Phase 16's code existing — it only touches schema, not `lib/cabida-comercial-server.ts`.

### Pattern 4: The gated final wiring plan (clone `18-07-PLAN.md` verbatim)

**What:** Exactly one plan, last wave, depends on nothing built in this phase's other plans except types — its first task is a live prerequisite check (`ls lib/cabida-comercial-server.ts && grep obtenerAnalisisCabidaComercial`), and if either fails, **the plan stops cleanly, documents the blocked state with literal command output, and does not fabricate a stub.** This is not a new pattern to invent — Phase 18's `18-07-PLAN.md` (read in full for this research) is the exact template, and it worked: Phase 18 has executed 5 of its 8 plans while genuinely blocked on Phase 16, with only the wiring plan waiting.

```typescript
// Inside obtenerAnalisisCabidaComercial(lat, lng, formato), AFTER isocrona
// is resolved (whether red_vial or circulo_equivalente — demografía runs
// against WHATEVER geometry came back, using the same metodo-degradation
// discipline, never re-deriving its own polygon):
const [demografia, consumo] = await Promise.all([
  obtenerPoblacionEnPoligono(isocrona.geometria),
  Promise.resolve(obtenerConsumoEstimado(comuna)), // síncrona, pero Promise.all por uniformidad
])

return {
  formato,
  isocrona,
  competencia,       // si Fase 18 ya está wireada
  demografia: { poblacion: demografia, consumo },  // NUEVO — Fase 17
  generadoEl: new Date().toISOString(),
}
```

### Anti-Patterns to Avoid

- **Re-querying ArcGIS from scratch instead of reusing the isochrone's already-computed geometry.** `obtenerPoblacionEnPoligono()` must receive `isocrona.geometria` from the SAME call that already resolved it — never recompute or re-fetch the isochrone inside the demografía path (same anti-pattern Phase 18's `18-07` explicitly calls out for competencia).
- **Presenting `consumo`'s category shares with the same visual confidence/precision as `demografia`'s population count.** They come from structurally different geographies (isochrone-precise manzana intersection vs. a Gran-Santiago-wide EPF average) — `ConsumoEstimadoResultado.disclosure` and `nivelGeografico` are non-optional fields for exactly this reason (DEMO-02's literal wording: "nunca presentado con precisión de isócrona").
- **Hardcoding `censoAno: 2017` as a bare literal scattered across the codebase instead of a named, typed constant.** Censo 2024 already published comuna-level totals (per `PITFALLS.md` Pitfall 7, already documented at the milestone level) — if this codebase ever adds a Censo 2024 comuna-total figure alongside the 2017 manzana figure, both need their own visible vintage label, never silently combined (DEMO-03's literal wording).
- **Using the URL cited in `STACK.md`/`ARCHITECTURE.md` (`services3.arcgis.com/cTnMkBRk4HWkUCRo/...`) without re-reading this document first.** That service is real, responds successfully, and returns correctly-shaped ArcGIS JSON — it will not throw an error, it will just silently return zero results for every RM-based query, which is a much more dangerous failure mode than an outright HTTP error. This is the single most important correction in this research pass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Population within an arbitrary polygon | A custom point-in-polygon loop against a locally-stored INE dataset | The ArcGIS FeatureServer's own `spatialRel=esriSpatialRelIntersects` query, live-verified in this pass to work correctly and cheaply | The server already does correct polygon-intersect spatial indexing; re-deriving that logic client-side would require exactly the bulk-ingestion architecture this research recommends avoiding for now. |
| GeoJSON↔Esri JSON ring conversion | An ad-hoc inline transform repeated per call site | One shared helper (`geometriaGeoJsonARings()`), written once, with the same "single place that knows this shape" discipline `lib/zonificacion-geo.ts` already established for the inverse direction | Winding-order/nesting mistakes in polygon ring conversion are a classic silent-corruption bug class (wrong rings return wrong or zero features without erroring) — exactly the failure mode this research pass just spent several requests debugging for a DIFFERENT reason (wrong service URL); don't reintroduce a similar class of subtle geometry bug via a second, inconsistent conversion. |
| EPF/CASEN comuna-poverty data ingestion | A scraper against `datosocial.ministeriodesarrollosocial.gob.cl` or INE's EPF portal | A static, PR-reviewed TypeScript table, same pattern as `lib/strip-power-centers-chile.ts` | Both sources publish on a multi-year cadence with no confirmed machine-readable API in this pass — a scraper would be pure maintenance overhead for data that changes roughly once every 2-5 years. |

**Key insight:** The engineering risk in this phase was never "can we query a polygon against ArcGIS" (now confirmed: yes, cleanly) — it was "are we querying the RIGHT ArcGIS service," a distinction the milestone-level research didn't verify and this pass did, live, with a real address.

## Common Pitfalls

### Pitfall 1: Using the wrong (Atacama-only) FeatureServer URL from milestone-level research without re-verifying comuna coverage
**What goes wrong:** `services3.arcgis.com/cTnMkBRk4HWkUCRo/.../SHAPES_CENSO_2017/FeatureServer/8` (cited in `STACK.md`/`ARCHITECTURE.md` as "confirmed live") mechanically works — correct schema, HTTP 200, no error — but silently returns zero manzanas for any RM-based query, because that service instance only contains 8 Atacama comunas (3,928 manzanas total). A developer trusting the milestone research's "verified live" language without re-checking comuna coverage would ship a population feature that always shows "0 personas" for every real oportunidad (100% of which are RM), and — worse — a `0` result reads as a valid, confidently-displayed number, not an error.
**Why it happens:** The milestone research's live verification checked *that the layer and fields exist and are queryable* (true), not *that the specific service instance has the geographic coverage the milestone actually needs* (false) — a scope mismatch between "verified" and "verified for our use case."
**How to avoid:** Use `services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0` (this document's Pattern 1) — live-verified in this pass to cover 49,974 RM manzanas. Any future re-verification of this endpoint should re-run the exact `groupByFieldsForStatistics` coverage check (Sources below has the literal curl commands) before trusting a "confirmed live" claim about comuna coverage specifically.
**Warning signs:** A population query that returns HTTP 200 with a well-formed, empty `features: []` array for a real Santiago address — this is NOT the same failure mode as an HTTP error and will not trip an obvious error path.
**Phase to address:** This phase, first `censo-manzana-server.ts` commit — the URL constant should have an inline comment citing this exact finding so a future maintainer doesn't "helpfully" revert to the milestone-cited URL.

### Pitfall 2: `MANZANA_SIN_INF` (statistically-suppressed low-population blocks) has no equivalent flag in this specific service — TOTAL_PERS=0 is ambiguous
**What goes wrong:** `PITFALLS.md` (milestone research) already flags that INE suppresses population counts for very-low-population manzanas for statistical-disclosure reasons, and warns against treating those as genuine zeros. This research pass confirmed live that the corrected `services9.arcgis.com` layer has **no separate "sin información" category or flag** — it's a single layer with two `NOM_CATEGO` values (`CD`/`PB`, urban/village classification, unrelated to suppression), and 2,541 of 158,927 manzanas nationally have `TOTAL_PERS = 0` with no way to distinguish "genuinely uninhabited block" from "suppressed for disclosure" using this service alone.
**Why it happens:** The `MANZANA_SIN_INF_C17` layer that WOULD carry this distinction exists as a separate named layer (layer 9) in the *other*, Atacama-only service (`services3.arcgis.com/cTnMkBRk4HWkUCRo`) — it is not present in the corrected national-coverage service this research recommends using instead. Fixing Pitfall 1 (coverage) reintroduces this narrower gap.
**How to avoid:** Do not claim in UI copy that a `TOTAL_PERS = 0` manzana is confirmed-uninhabited — treat any manzana in the aggregation with `TOTAL_PERS = 0` the same as any other (sum it in, it contributes 0), but do not build a feature that singles out "0 population = confirmed empty" as a positive claim. This is a lower-severity version of the same discipline COMPE-05 already requires for competencia's "0 competitors ≠ confirmed no competition."
**Warning signs:** Any UI copy asserting a specific manzana is "sin población" as a verified fact rather than simply not contributing to the sum.
**Phase to address:** This phase, at the point the aggregation/disclosure copy is written — a one-line caveat in the methodology section is sufficient, this does not need a schema change.

### Pitfall 3: A real isochrone polygon can exceed a GET request's practical URL length, and/or exceed the layer's 2,000-record page limit
**What goes wrong:** ORS/openrouteservice isochrone polygons (once Phase 16 produces real ones, not the simple bounding box this research used for verification) can have complex, many-vertex boundaries. Sending that geometry as a GET query-string parameter risks exceeding common proxy/CDN URL-length limits (observed failure mode: silent truncation or a 414 from an intermediary, not from ArcGIS itself). Separately, `services9.arcgis.com`'s layer has a `maxRecordCount: 2000` — confirmed live — meaning a very large or dense-urban isochrone could theoretically return `exceededTransferLimit: true` and only a partial manzana set.
**Why it happens:** This research pass's verification queries used simple 5-point bounding boxes, which are small enough that neither issue surfaced — but they are not representative of a real ORS isochrone's geometry complexity or a dense central-Santiago comuna's manzana density.
**How to avoid:** Use POST (not GET) for the ArcGIS query call unconditionally (Standard Stack, Supporting). Check `exceededTransferLimit` in the response and either page via `resultOffset` or (simpler, and sufficient for a 10-15 minute walking/driving area, which realistically won't approach 2,000 manzanas) log/flag it as a known-partial result rather than silently truncating without a trace, mirroring `isocrona_status`'s explicit-state discipline.
**Warning signs:** A population count that looks suspiciously round or low for a dense comuna; `exceededTransferLimit: true` in a raw response during manual testing.
**Phase to address:** This phase, the `censo-manzana-server.ts` implementation task — write the POST-based call and the `exceededTransferLimit` check from the first commit, don't retrofit after a real isochrone from Phase 16 exposes the gap.

### Pitfall 4 (inherited from milestone `PITFALLS.md` Pitfall 1, restated with this phase's concrete types): Presenting `consumo` with the same confidence framing as `demografia`
**What goes wrong:** Population (manzana-precise) and consumption (Gran-Santiago-macro-zone-precise) are categorically different resolutions. A UI or payload shape that gives both fields the same visual weight/confidence badge fabricates precision the EPF source never had.
**How to avoid:** `ConsumoEstimadoResultado.nivelGeografico` and `.disclosure` are non-optional from the type's first commit (Pattern 2 above) — no code path can construct the type without declaring this, same discipline as `IsocronaResultado.metodo` (Phase 16) and `ResultadoCompetenciaFormato.coberturaConocida` (Phase 18).
**Warning signs:** Any UI component rendering `demografia.poblacion` and `demografia.consumo` inside the same visual container/confidence badge without a distinct label for each.
**Phase to address:** This phase, at the type-definition commit.

## Code Examples

### Live-verified ArcGIS polygon-intersect query (the exact request that resolved this phase's biggest open question)

```bash
# Source: this research pass, executed live 2026-08-03 against a real
# Providencia (Santiago) bounding box. HTTP 200, real manzana data returned.
POLY='{"rings":[[[-70.618,-33.423],[-70.610,-33.423],[-70.610,-33.430],[-70.618,-33.430],[-70.618,-33.423]]],"spatialReference":{"wkid":4326}}'
curl -s -G "https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0/query" \
  --data-urlencode "geometry=${POLY}" \
  --data-urlencode "geometryType=esriGeometryPolygon" \
  --data-urlencode "spatialRel=esriSpatialRelIntersects" \
  --data-urlencode "inSR=4326" \
  --data-urlencode "outSR=4326" \
  --data-urlencode "outFields=TOTAL_PERS,TOTAL_VIVI,MANZENT_I,NOM_COMUNA" \
  --data-urlencode "returnGeometry=false" \
  --data-urlencode "f=json"
# Returns: real Providencia manzanas, e.g.
# {"TOTAL_PERS":102,"TOTAL_VIVI":131,"MANZENT_I":"13123021002006","NOM_COMUNA":"PROVIDENCIA"}
# {"TOTAL_PERS":226,"TOTAL_VIVI":112,"MANZENT_I":"13123081002026","NOM_COMUNA":"PROVIDENCIA"}
# ... (10+ manzanas for this small bounding box)
```

### The SAME query against the WRONG (milestone-cited) URL — mechanically successful, semantically empty

```bash
# Source: this research pass. Same polygon, same params, DIFFERENT service —
# the one cited in STACK.md/ARCHITECTURE.md. HTTP 200, well-formed response,
# ZERO features. This is the failure mode Pitfall 1 warns about.
curl -s -G "https://services3.arcgis.com/cTnMkBRk4HWkUCRo/arcgis/rest/services/SHAPES_CENSO_2017/FeatureServer/8/query" \
  --data-urlencode "geometry=${POLY}" --data-urlencode "geometryType=esriGeometryPolygon" \
  --data-urlencode "spatialRel=esriSpatialRelIntersects" --data-urlencode "inSR=4326" --data-urlencode "outSR=4326" \
  --data-urlencode "outFields=TOTAL_PERS,TOTAL_VIVI,MANZENT_I,NOM_COMUNA" --data-urlencode "returnGeometry=false" --data-urlencode "f=json"
# Returns: {"objectIdFieldName":"FID", ..., "features":[]}
```

### Confirming national/RM coverage of the corrected service (the check to re-run if this URL is ever re-verified)

```bash
curl -s -G "https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0/query" \
  --data-urlencode "where=1=1" \
  --data-urlencode 'outStatistics=[{"statisticType":"count","onStatisticField":"FID","outStatisticFieldName":"n"}]' \
  --data-urlencode "groupByFieldsForStatistics=NOM_REGION" --data-urlencode "f=json"
# Returns 15 regions incl. {"n":49974,"NOM_REGION":"REGIÓN METROPOLITANA DE SANTIAGO"}
```

## State of the Art

| Old Approach (milestone-level research) | Current Approach (this phase's research) | When Changed | Impact |
|---|---|---|---|
| `services3.arcgis.com/cTnMkBRk4HWkUCRo/.../SHAPES_CENSO_2017/FeatureServer/8` cited as "confirmed live" for manzana population | `services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0` — the actual national/RM-covering service | This research pass, 2026-08-03 | Load-bearing correction — the old URL would have shipped a population feature that always returns 0 for every real oportunidad. |
| Bulk-ingest census geometries into a new PostGIS-backed `census_manzana` table (STACK.md's original recommendation) | Live per-request polygon query against the ArcGIS FeatureServer, cache-through by `(lat_r, lng_r, modo, minutos)` on `cabida_comercial_cache` — no PostGIS needed | This research pass — the polygon-intersect query, previously an open question, is now live-verified to work correctly and cheaply | Removes a dependency (enabling `postgis`) and an entire ETL subsystem from this phase's scope. Revisit only if the live query proves unreliable in production. |
| EPF "next edition" implicitly assumed close/unclear | X EPF fieldwork still in testing as of INE's own site (mid-2025), not yet published — IX EPF (Oct 2021–Sept 2022) remains the current citable edition | Confirmed in this pass | No functional impact on this phase (IX EPF was already the assumption) but resolves an ambiguity — cite IX EPF explicitly, don't imply a newer edition exists. |

**Deprecated/outdated:** The `services3.arcgis.com/cTnMkBRk4HWkUCRo` URL should be treated as wrong-for-this-purpose (not deprecated by INE — it's a real, functioning service, just scoped to Atacama), not reused anywhere in Phase 17's code.

## Open Questions

1. **Exact literal downloadable file format for EPF's full 12/13-category breakdown and CASEN's comuna-level SAE poverty table.**
   - What we know: EPF's most recent edition (IX EPF), its representativity ceiling (Gran Santiago/regional-capital), its classification system (CCIF 2018.CL, 12 divisions), and 3 real category shares (Alimentación 21.2%, Vivienda 16.0%, Transporte 15.0%) are all confirmed via official INE sources. CASEN 2024's comuna-level poverty methodology (SAE), its 335-comuna coverage, and its portal location (`observatorio.ministeriodesarrollosocial.gob.cl/pobreza-comunal` → `datosocial.ministeriodesarrollosocial.gob.cl`) are confirmed.
   - What's unclear: Neither official page exposed a direct, machine-fetchable file link (CSV/XLSX/SPSS) discoverable by WebFetch/WebSearch in this pass — both appear to gate the actual figures behind an interactive dashboard/portal.
   - Recommendation: This does not block planning — both datasets are small enough (12-13 EPF categories; ~335-346 CASEN comuna rows) to hand-transcribe from the official PDF/dashboard once, committed as a static table exactly like `SEED-STRIP-POWER-CENTERS-CHILE.md` → `lib/strip-power-centers-chile.ts` was in Phase 18. The planner should schedule a dedicated data-transcription task (with a human-verify checkpoint, same pattern as Phase 18's seed-list geocoding script) rather than assume an API/CSV exists to fetch programmatically.

2. **Do the 3 confirmed EPF category shares (Alimentación, Vivienda, Transporte) suffice for a first version of DEMO-02, or does the planner need all 12-13 before shipping?**
   - What we know: DEMO-02's literal wording is "capacidad de gasto estimada por categoría de consumo" (plural, category-by-category), which implies more than 3.
   - What's unclear: Whether a partial category set (the 3 largest, ~52% of total spend) with an honest "categorías restantes pendientes de transcripción" note is acceptable for a first plan, or whether all categories must be populated before the feature ships.
   - Recommendation: Claude's discretion at planning time — either is defensible given this document's "never fabricate" discipline (a partial-but-honest table is safer than inventing plausible-looking numbers for the other 9 categories). Flag explicitly in the plan rather than silently shipping partial data.

3. **Should the additive `demografia_*` migration on `cabida_comercial_cache` be applied now (like this research recommends for `consumo`'s static data) or deferred to the same gated final plan as the code wiring?**
   - What we know: Phase 18's `20260810_cadenas_sucursales_geocoding.sql` (Plan 18-04) applied its additive migration independently of Phase 16, well before the final wiring plan (18-07) — schema changes don't need `lib/cabida-comercial-server.ts` to exist.
   - Recommendation: Apply now, in the same independently-executable plan as `censo-manzana-server.ts` — mirrors 18-04's proven precedent exactly, and lets the final wiring plan be a pure code change with zero migration risk on its own gated critical path.

## Sources

### Primary (HIGH confidence — live-verified in this research pass)
- `curl` against `services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0` — layer metadata (fields, `maxRecordCount: 2000`), national row count (158,927), region-level coverage breakdown (`groupByFieldsForStatistics=NOM_REGION`, RM = 49,974), and a real polygon-intersect query against Providencia returning real manzana rows — all executed live in this pass, raw responses captured.
- `curl` against `services3.arcgis.com/cTnMkBRk4HWkUCRo/.../SHAPES_CENSO_2017/FeatureServer/8` (the milestone-cited URL) — confirmed live to cover only 8 Atacama comunas (3,928 manzanas total), zero RM coverage; confirmed a polygon-intersect query against RM coordinates returns `features: []` with no error.
- `mcp__supabase__list_extensions` (re-run live in this pass) — confirms `postgis` still `installed_version: null`.
- `mcp__supabase__list_tables` — confirms `cabida_comercial_cache` exists (0 rows, per the narrow Phase-16-only schema).
- `ls lib/cabida-comercial-server.ts lib/isocrona-server.ts` (this pass) — confirmed both still missing, matching `.planning/STATE.md`'s documented paused state.
- `supabase/migrations/20260809_cabida_comercial_cache.sql` (read in full) — confirmed exact current schema, and its own header comment explicitly anticipates Phase 17/18 additive columns.
- `.planning/phases/18-competencia-por-formato/18-07-PLAN.md`, `18-04-PLAN.md` (read in full) — the exact gated-plan and additive-migration patterns this document recommends cloning.
- `.planning/phases/16-ubicacion-e-isocrona-motor-desacoplado/16-RESEARCH.md`, `16-04-PLAN.md`, `16-05-PLAN.md`, `16-01-PLAN.md` (read in full) — `UbicacionCabida`/`IsocronaResultado`/`AnalisisCabidaComercial` real type shapes, `obtenerAnalisisCabidaComercial(lat, lng, formato, opts?)` documented signature.
- `lib/cabida-comercial.ts` (read in full, current file) — confirmed the additive-field pattern (`competencia?`) Phase 17 should follow for `demografia?`.
- `.planning/STATE.md` (read live) — confirmed exact current blocked state of Phase 16 (ORS 403, HeiGIT propagation).
- INE, IX EPF press release ("hogares-en-chile-gastan-más-de-1-4-millones...") — confirmed real category shares (21.2% alimentación, 16.0% vivienda, 15.0% transporte) and survey scope (15,134 households, 79 comunas, 16 regions).
- INE EPF general page (`ine.gob.cl/estadisticas-por-tema/.../encuesta-de-presupuestos-familiares`, fetched) — confirmed IX EPF (Oct 2021–Sept 2022) is the latest published edition, X EPF fieldwork still in testing as of the page's content.
- Ministerio de Desarrollo Social y Familia, `observatorio.ministeriodesarrollosocial.gob.cl/pobreza-comunal` (fetched) — confirmed CASEN 2024 comuna-level poverty estimates via SAE methodology, 2024 as latest edition.

### Secondary (MEDIUM confidence)
- WebSearch results on CASEN 2024 methodology/coverage (335 comunas, SAE/UNDP/CEPAL methodology) — cross-referenced across multiple official-domain search results, not fetched from a single primary document.
- WebSearch on EPF's CCIF 2018.CL 12-division classification and full category names — aggregated from search summaries referencing INE conference/methodology PDFs, not independently re-verified against the primary PDF (the one PDF fetch attempted in this pass returned binary/unparseable content).

### Attempted but not verifiable this pass
- `sig.ine.cl` and `geografia.ine.cl` (candidate official INE ArcGIS domains) — both failed to connect from this environment (`HTTP_STATUS:000`, likely a DNS/network restriction specific to this sandbox, not necessarily a dead service) — could not cross-check whether either hosts an even-more-authoritative national census layer than the `services9.arcgis.com` one this document recommends. The recommended URL is proven correct and sufficient (live-verified, national+RM coverage); this gap is about whether a more "official-looking" domain exists, not about whether the recommended one works.
- Direct PDF fetch of INE's "Síntesis de resultados IX EPF" — returned unparseable binary content via WebFetch; the category-share and geography claims in this document are corroborated via secondary press/search sources instead, MEDIUM not HIGH confidence for the categories beyond the 3 explicitly cited.

## Metadata

**Confidence breakdown:**
- Standard stack (census ArcGIS integration): HIGH — the corrected URL, its schema, its RM coverage, and a real polygon-intersect query are all independently live-verified with raw HTTP responses captured in this pass, not inferred from documentation.
- Standard stack (EPF/CASEN): MEDIUM — representativity/vintage/methodology claims are HIGH confidence (multiple official sources agree), but the literal downloadable file format and the full category list beyond 3 confirmed entries are MEDIUM (search-aggregated, one direct PDF fetch failed).
- Architecture (gated composition pattern, additive migration, decoupled pure functions): HIGH — directly mirrors Phase 18's already-executed, already-proven pattern in this exact codebase, not a novel design.
- Pitfalls: HIGH for Pitfall 1 (the wrong-URL failure mode, directly demonstrated live in this pass) and Pitfall 3 (POST vs GET, `maxRecordCount`, both confirmed via live metadata); MEDIUM for Pitfall 2 (suppression-flag absence confirmed live, but downstream UI-copy implications are a judgment call, not a hard technical fact).

**Research date:** 2026-08-03
**Valid until:** ~30 days for the architecture/pattern findings and the live-verified ArcGIS URL/coverage (stable, unlikely to change). Re-verify EPF/CASEN specifically if implementation starts more than ~2-3 months out — CASEN 2024's full comuna dataset publication was still rolling out as of this research (results presentation dated Jan 2026), and a fuller data release could land with a more discoverable download format than what this pass found.
