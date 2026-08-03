# Phase 18: Competencia por Formato - Research

**Researched:** 2026-08-02
**Domain:** Extending an existing production Overpass (OSM) integration from counts to a named/located POI list, cross-referencing it with an existing-but-uncoordinated SII sucursales table via on-demand geocoding, and formalizing a hand-curated seed list for two Chilean retail formats with no public data source — all composed behind an explicit confidence-degradation model.
**Confidence:** HIGH on architecture/integration points (every finding below is verified by direct inspection of real, currently-in-production code in this exact repo) — MEDIUM on the final wiring point (`obtenerAnalisisCabidaComercial`), because that function does not exist in the codebase yet (see User Constraints).

## User Constraints

<user_constraints>
No `CONTEXT.md` exists for this phase — `/gsd:discuss-phase 18` was skipped. There are no locked user decisions beyond `PROJECT.md`/`REQUIREMENTS.md`/`ROADMAP.md`. Everything in this document is Claude's Discretion within those boundaries, EXCEPT the six requirements below, which are locked (verbatim from `.planning/REQUIREMENTS.md`) and must be treated as the binding spec, not alternatives to explore:

- **COMPE-01**: El usuario puede seleccionar uno de los 4 formatos objetivo (supermercado, minimarket, strip center, power center) para el análisis
- **COMPE-02**: El tab muestra el conteo de competidores existentes por formato dentro del área de influencia, con nombre/tag y distancia, extendiendo la consulta Overpass ya existente (`obtenerSenalesUbicacion`)
- **COMPE-03**: Para supermercado/minimarket, la detección usa tags OSM estándar (`shop=supermarket|convenience|mall|department_store`)
- **COMPE-04**: Para strip center/power center, la detección usa una lista curada a mano de centros conocidos en Chile (mantenida por el equipo), dado que no existe tag OSM ni fuente pública con direcciones para estos formatos
- **COMPE-05**: Un conteo de 0 competidores nunca se interpreta como "confirmado: no hay competencia" cuando la cobertura de la fuente es conocida como incompleta (ej. roster SII sin Unimarc) — el nivel de confianza se degrada explícitamente en ese caso
- **COMPE-06**: El usuario puede ver el nombre real de cadena de cada competidor detectado (ej. "Líder Express"), cruzando OSM con la nómina SII geocodificada on-demand por comuna

**CRITICAL sequencing constraint (from the orchestrator, not CONTEXT.md, but equally binding):** Phase 18 is being planned OUT OF ORDER. Phase 16 is only partially executed — **verified directly in this research pass**: `lib/cabida-comercial-server.ts` and `lib/isocrona-server.ts` do **not exist in the codebase** (Plans 16-01/16-04/16-05 not yet run), and `@turf/turf` is **not installed** (`node_modules/@turf` absent, `package.json` has no `turf` dependency). What DOES exist and is stable: `lib/cabida-comercial.ts` (client-safe types: `UbicacionCabida`, `IsocronaResultado`, `FormatoComercial`, `AnalisisCabidaComercial`) and `supabase/migrations/20260809_cabida_comercial_cache.sql` (the narrow `cabida_comercial_cache` table, isochrone-only columns).

Practical implication for planning: Phase 18 plans can and should build every self-contained piece (Overpass POI-list module, curated seed data, SII on-demand geocoding, the `CompetidorDetectado` type, unit tests for all of it) as **standalone, independently testable code that does not import `lib/cabida-comercial-server.ts`**. The one integration point that composes into `obtenerAnalisisCabidaComercial(lat, lng, formato)` (documented signature in `.planning/phases/16-ubicacion-e-isocrona-motor-desacoplado/16-04-PLAN.md`) cannot be wired and executed end-to-end until Phase 16 finishes — a plan step that edits a file that doesn't exist yet will fail at execution time, not just at "doesn't work yet." The planner should either (a) sequence Phase 18's wiring task explicitly after a Phase 16 completion checkpoint, or (b) have Phase 18 create `lib/cabida-comercial-server.ts` itself with only the competencia-relevant piece if Phase 16 truly hasn't landed by the time Phase 18 executes — this is a real open call, not a settled research finding (see Open Questions).
</user_constraints>

## Summary

Phase 18 sits on top of three pieces of infrastructure that already exist in this codebase, none of which were built for this purpose and all of which need extension, not replacement:

1. **`lib/terrenos-ubicacion.ts`'s `obtenerSenalesUbicacion()`** — a production Overpass integration with mature rate-limit handling (`OverpassUnavailableError`, 5s throttle + 429 backoff, the Overpass-specific User-Agent that avoids a 406 from its WAF). Today it queries `shop~"mall|supermarket|department_store"` and returns **counts only** (`out count`). COMPE-02/03 need this same tag family (plus `shop=convenience` for minimarket, confirmed missing today) rewritten to return actual POIs (name, tag, coordinates) — a query-shape change (`out center` instead of `out count`), not a new integration pattern. Per `.planning/research/ARCHITECTURE.md`'s explicit guidance, this should be a **new module that replicates the pattern**, not a modification that couples `lib/terrenos-ubicacion.ts` (scoped to the Terrenos/`enriquecerTerreno()` domain) to Mercado Inmobiliario.

2. **`cadenas_sucursales` (table) + `lib/cadenas-sucursales-server.ts`** — already has real chain data (Walmart Líder/Líder Express: 211 direcciones vigentes; SMU via Alvi + Super10: ~124 vigentes) ingested monthly from the SII nómina. **It has no `lat`/`lng` columns — only `calle`/`numero`/`comuna` text.** COMPE-06 requires geocoding this on demand, comuna by comuna, reusing `lib/geocoding.ts`'s `geocodeDireccion()` (same call Phase 16 already reuses verbatim) — with a caching decision to make (see below), since Nominatim's 1.1s-per-request throttle makes live per-tab-open geocoding of a whole comuna's rows too slow to do uncached.

3. **`.planning/research/SEED-STRIP-POWER-CENTERS-CHILE.md`** — a real, sourced (2 Aug 2026) pre-work document: 15 strip centers + 4 power centers in RM with addresses and per-row confidence (`Alta`/`Media`/`Baja`), plus explicit documentation of what's missing (Grupo Patio's ~91-158 properties, Más Center's ~30 operating strip centers — neither has a single named/addressed entry in the seed). This is the raw input for COMPE-04's "lista curada a mano" — it needs to become a typed, committed data structure, and its **own gaps need to be tracked with the same discipline data-sources.yaml already applies to the Unimarc gap**, because an incomplete curated list is exactly the kind of "known incomplete coverage" COMPE-05 is about — not just the SII/Unimarc case the requirement explicitly names.

The single hardest design constraint across all of this is COMPE-05: nothing in this phase may let `competidores.length === 0` alone justify a clean "no hay competencia" reading. `.planning/data-sources.yaml` already has a structured, governance-level entry (`sii-nomina-sucursales-holdings-sin-tiendas`) documenting exactly why the SII roster is incomplete for supermercado/minimarket (Unimarc unresolved) — Phase 18's confidence-degradation code must **read from/cite that same entry**, not invent a second, drifting description of the same fact. The strip/power-center seed list needs an equivalent registered gap (it doesn't have one yet — it's brand new).

**Primary recommendation:** Build four small, independently-testable pieces this phase, all decoupled from the not-yet-built `lib/cabida-comercial-server.ts`: (1) `lib/overpass-competencia.ts` — new Overpass module returning POIs with name/tag/coords, cloning `terrenos-ubicacion.ts`'s rate-limit discipline; (2) `lib/strip-power-centers-chile.ts` — a static, git-versioned TypeScript array (not a DB table — see rationale below), seeded from `SEED-STRIP-POWER-CENTERS-CHILE.md`, with `direccion: string | null` and pre-geocoded `lat`/`lng` only for the "Alta"/"Media" confidence rows that have a real address; (3) an extension to `lib/cadenas-sucursales-server.ts` adding on-demand-by-comuna geocoding with results persisted back onto `cadenas_sucursales` (new nullable `lat`/`lng`/`geocodificado_el` columns via an additive migration — the row-level cache-through pattern, not a separate cache table); (4) a `CompetidorDetectado`/`ResultadoCompetenciaFormato` type pair in `lib/cabida-comercial.ts` (additive to the file Phase 16 already built) carrying `fuente: 'osm' | 'seed_list' | 'sii_geocodificado'` and a mandatory `coberturaConocida`/`confianza` pair per COMPE-05. Wire all four into `obtenerAnalisisCabidaComercial()` as the final integration task, explicitly flagged as blocked on Phase 16's `lib/cabida-comercial-server.ts` existing.

## Standard Stack

### Core

| Library/Service | Version | Purpose | Why Standard |
|---|---|---|---|
| Overpass API (OSM) | public REST, same endpoint already in use | POI list for `shop=supermarket\|convenience\|mall\|department_store` with name/tag/coords | Already the production choice in this exact codebase (`lib/terrenos-ubicacion.ts`) — same data family as Nominatim, free, no key. COMPE-02/03 lock this in, not re-litigated here. |
| `lib/geocoding.ts`'s `geocodeDireccion()` (existing) | n/a | Geocode `cadenas_sucursales` rows (calle+numero+comuna) on demand | Zero new code needed for the call itself — reuse verbatim, exactly as Phase 16 already does for `mercado_locales_listings`. Same Nominatim throttle (1.1s/req) applies. |
| Zod (existing dependency, `^4.4.3`) | already in project | Validate the reshaped Overpass POI response before trusting `tags.name`/`tags.shop` | Same discipline this codebase already applies to ArcGIS (`ArcGISQueryResponseSchema`) and (per Phase 16 research) plans to apply to ORS — an external JSON shape should never be trusted without a runtime check here. |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@turf/turf` | **not yet installed** (Phase 16-04 will install it; verified absent as of this research) | `turf.distance()` for competitor distance-from-origin, `turf.booleanPointInPolygon()` to filter POIs against the *real* isochrone polygon instead of a fixed circular radius | If Phase 18 executes before Phase 16-04, the planner must add an explicit `npm install @turf/turf` task (idempotent if Phase 16-04 also does it later) rather than assume it's present. A hand-rolled haversine function is a viable fallback if the team wants zero dependency on Phase 16-04's timing, but this codebase's own convention (`Don't Hand-Roll` in 16-RESEARCH.md) already chose turf for exactly this class of geometry problem — don't diverge for Phase 18 alone. |
| JSZip (existing, via `lib/scrapers/sii-nomina-sucursales.ts`) | already in project | No new use needed — `cadenas_sucursales` is already ingested | Confirms no new scraping infrastructure is needed for COMPE-06; the data is already in Supabase, only geocoding is missing. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Static TS file for strip/power seed list | New `strip_power_centers` Supabase table + INSERT migration | A table adds RLS/migration/service-role plumbing for ~25 rows with no automated ingestion pipeline (nothing upserts into it on a schedule, unlike `cadenas_sucursales`). A table would only pay for itself if the team wants to edit entries from a UI without a deploy — not requested anywhere in COMPE-04's wording ("mantenida por el equipo" reads as "the team maintains this," which a PR-reviewed static file satisfies as well as an admin UI would, with far less plumbing). See Architecture Patterns below for the full comparison against `lib/comunas-chile.ts` and `cadenas_sucursales`. |
| Row-level geocode cache (`cadenas_sucursales.lat`/`.lng` columns) | Separate `cadenas_sucursales_geocode_cache` table keyed by address string | A separate table would need its own upsert/RLS/join logic for data that is 1:1 with an existing table's rows and already has a stable natural key (`rut,calle,numero,comuna`). Enriching the existing row is simpler and matches how the row is already upserted monthly — no new table needed for what is fundamentally "fill in two more columns on a row that already exists." |
| Overpass circular radius filter only | `turf.booleanPointInPolygon()` against the real isochrone/`circulo_equivalente` geometry | A circle is required as the *Overpass query's* search radius regardless (Overpass's `around:` filter is circular, there's no polygon-shaped Overpass query), but the *result set shown to the user* should be filtered against the actual isochrone polygon Phase 16 computed — otherwise "dentro del área de influencia" (the phase goal's literal wording) is not what's actually being tested. Recommend: query Overpass with a generous circular radius (covering the isochrone's bounding extent), then filter the returned POIs with `turf.booleanPointInPolygon()` against the real `IsocronaResultado.geometria`. |

**Installation:**
```bash
npm install @turf/turf   # only if not already installed by Phase 16-04 at the time Phase 18 executes
```

## Architecture Patterns

### Recommended File Structure

```
lib/
├── cabida-comercial.ts                 # EXISTING (Phase 16) — ADD to it: CompetidorDetectado,
│                                        #   ResultadoCompetenciaFormato, FuenteCompetidor types
├── cabida-comercial-server.ts          # NOT YET BUILT (Phase 16-04) — Phase 18's final wiring
│                                        #   task adds obtenerCompetencia() here, composing the
│                                        #   3 sources below. BLOCKED until this file exists.
├── overpass-competencia.ts             # NEW — Overpass POI-list query (supermercado/minimarket),
│                                        #   clones lib/terrenos-ubicacion.ts's rate-limit pattern,
│                                        #   does NOT import that file (different domain scope)
├── strip-power-centers-chile.ts        # NEW — static, git-versioned curated seed array (COMPE-04)
├── cadenas-sucursales-server.ts        # EXISTING — ADD to it: geocodificarSucursalesPorComuna()
│                                        #   (COMPE-06), cache-through onto cadenas_sucursales rows
├── terrenos-ubicacion.ts               # UNMODIFIED — stays scoped to Terrenos/enriquecerTerreno()
├── geocoding.ts                        # UNMODIFIED — geocodeDireccion() reused verbatim
supabase/migrations/
└── 2026XXXX_cadenas_sucursales_geocoding.sql   # NEW — additive lat/lng/geocodificado_el columns
.planning/
└── data-sources.yaml                    # ADD entry: strip-power-centers-chile-seed (static-kb,
                                          #   with explicit known-gaps note, same shape as the
                                          #   existing sii-nomina-sucursales-holdings-sin-tiendas entry)
```

### Pattern 1: Extend Overpass from `out count` to a located POI list (clone `terrenos-ubicacion.ts`'s discipline, new module)

**What:** Same query family, same throttle/backoff/`*UnavailableError` discipline, different Overpass output clause and a new return shape.
**When to use:** For COMPE-02/03's core detection.
**Example (the exact pattern to clone — from the real, currently-running file):**
```typescript
// Source: lib/terrenos-ubicacion.ts (read in full, lines 1-143)
// Current: counts only
const query = `[out:json][timeout:15];
(
  node["shop"~"^(mall|supermarket|department_store)$"](around:${RADIO_ANCHORS_M},${lat},${lng});
  way["shop"~"^(mall|supermarket|department_store)$"](around:${RADIO_ANCHORS_M},${lat},${lng});
)->.anchors;
.anchors out count;`

// Phase 18's shape — POIs with name/tag/coords, tags EXTENDED to include
// shop=convenience for minimarket (COMPE-03's literal tag list):
const query = `[out:json][timeout:20];
(
  node["shop"~"^(supermarket|convenience|mall|department_store)$"](around:${radioM},${lat},${lng});
  way["shop"~"^(supermarket|convenience|mall|department_store)$"](around:${radioM},${lat},${lng});
)->.competidores;
.competidores out center tags;`
// "out center tags" — "center" gives a computed lat/lon for ways (which have
// no single coordinate natively, only a geometry) so nodes AND ways return a
// usable point uniformly; "tags" ensures shop=* and name=* come back per
// element instead of being stripped (the "out count" clause strips ALL tags
// by design — this is the concrete mechanical change, not just a bigger radius).
```
Same User-Agent requirement (`'PermisoHub/1.0 (+https://permisohub.cl)'`, default UA gets 406'd by Overpass's WAF — verified live per `terrenos-ubicacion.ts`'s own comment) and same throttle module (`MIN_INTERVAL_MS = 5000`, 429 → 20s backoff → retry once → `OverpassUnavailableError`) must be cloned into the new module — this is a SEPARATE throttle-state instance from `terrenos-ubicacion.ts`'s (each module has its own module-level `lastRequestAt`), meaning the two together do not share a single rate limiter against Overpass's global "2 slots/IP" quota. Flagged as a pitfall below.

### Pattern 2: Filter Overpass's circular result set against the real isochrone polygon

**What:** Overpass's `around:radius,lat,lng` filter is inherently circular — there is no polygon-shaped Overpass query. But Phase 16 already computes a real isochrone (or `circulo_equivalente` fallback) polygon, which is the actual "área de influencia" the phase goal refers to.
**When to use:** After the Overpass query returns POIs within a generous circular search radius (radius should cover the isochrone's bounding extent, not just replicate `terrenos-ubicacion.ts`'s fixed 1000m — a 15-minute walking isochrone can extend past 1km in some directions), filter the result set with `turf.booleanPointInPolygon([poiLng, poiLat], isocrona.geometria)` before counting/displaying — this makes "dentro del área de influencia" literally true rather than "within an arbitrary circle," and correctly excludes POIs Overpass returned that fall outside the isochrone's actual (non-circular) shape.
**Axis order warning:** Overpass's own filter syntax is `around:radius,lat,lng` (lat-first) but `turf.booleanPointInPolygon()` (like all GeoJSON-native turf functions) expects `[lng, lat]` point order — this codebase has already been bitten by exactly this class of bug once (documented as Pitfall 2 in `16-RESEARCH.md` for ORS). Write the conversion in exactly one place with an inline comment, same discipline.

### Pattern 3: SII sucursales geocoding-on-demand, cached on the row (not a separate cache table)

**What:** Extend `lib/cadenas-sucursales-server.ts` (the file that already owns `cadenas_sucursales`) with a function that geocodes only the rows for a requested comuna, only once per row, persisting the result back onto the same row.
**Example:**
```typescript
// NEW in lib/cadenas-sucursales-server.ts — composes with the existing
// obtenerSenalesExpansionPorComuna() in the same file, same normalizarNombreComuna()
// cross-check for SII's ALL-CAPS-no-tildes comuna text vs. mercado_locales_listings' normal case.
export async function obtenerCadenasGeocodificadasPorComuna(
  comuna: string
): Promise<{ cadena: string; lat: number; lng: number; direccionLabel: string }[]> {
  const supabase = createServiceClient()
  const comunaNormalizada = normalizarNombreComuna(comuna)

  const { data: filas } = await supabase
    .from('cadenas_sucursales')
    .select('id, rut, cadena, calle, numero, comuna, lat, lng')
    .eq('vigente', true)
    // .eq() on a normalized column, OR fetch broader and filter in JS with
    // normalizarNombreComuna() — same tradeoff obtenerSenalesExpansionPorComuna()
    // already accepted (it fetches all vigentes and normalizes in JS).

  const resultado: { cadena: string; lat: number; lng: number; direccionLabel: string }[] = []
  for (const fila of filas ?? []) {
    if (fila.lat != null && fila.lng != null) {
      resultado.push({ cadena: fila.cadena, lat: fila.lat, lng: fila.lng, direccionLabel: `${fila.calle} ${fila.numero}` })
      continue
    }
    // Not yet geocoded — geocode once, persist, THEN use. Nunca lanza
    // (mismo contrato que geocodeDireccion()) — una fila que no geocodifica
    // simplemente no aparece en el roster, no rompe el resto.
    const geo = await geocodeDireccion(`${fila.calle} ${fila.numero}`, fila.comuna)
    if (!geo.ok || geo.lat === undefined || geo.lng === undefined) continue
    await supabase.from('cadenas_sucursales')
      .update({ lat: geo.lat, lng: geo.lng, geocodificado_el: new Date().toISOString() })
      .eq('id', fila.id)
    resultado.push({ cadena: fila.cadena, lat: geo.lat, lng: geo.lng, direccionLabel: geo.displayName ?? `${fila.calle} ${fila.numero}` })
  }
  return resultado
}
```
**Why on the row, not a separate cache table:** `cadenas_sucursales` already has a stable natural key and is already upserted monthly by the existing cron — adding `lat numeric`, `lng numeric`, `geocodificado_el timestamptz` as nullable columns (additive migration, same convention as `zonificacion.sql` → `zonificacion_v2.sql`) means the geocoding step is naturally invalidated/re-attempted only when a row is genuinely new (a fresh SII address that was never geocoded), not on every monthly re-upsert of already-known addresses (the monthly upsert already only updates `vigente`/`fecha_registro`/`ultima_vez_visto_el` — it doesn't need to touch `lat`/`lng` once populated).
**Latency note:** the FIRST time any user opens the Cabida Comercial tab for a comuna with un-geocoded chain rows, this synchronously pays Nominatim's 1.1s/request throttle for however many un-geocoded rows exist in that comuna (typically small — a handful of Walmart/SMU addresses per comuna, not hundreds). Every subsequent open for that comuna is instant (all rows already have `lat`/`lng`). This mirrors the exact "compute once, cache forever, serve fast after" shape `obtenerIsocrona()` already uses for isochrones (Phase 16-04).

### Pattern 4: Curated static seed list, not a database table (COMPE-04)

**What:** A plain, git-versioned, hand-maintained TypeScript array — same shape as `CADENAS_RUT_CONOCIDOS` in `lib/scrapers/sii-nomina-sucursales.ts` (a small, hand-verified, occasionally-edited-by-a-developer array, not a table with an ingestion pipeline) and `lib/comunas-chile.ts` (static reference data, no per-request computation, no upsert/cron writing to it).
**Why not a table:** Nothing writes to this data on a schedule (unlike `cadenas_sucursales`, refreshed monthly by a real cron) and nothing computes/caches it per-request (unlike `zonificacion_cache`/`cabida_comercial_cache`, which cache the *result of an external API call* keyed by location). It is closer to configuration than to data — the team adds/edits/verifies an entry via a PR when they learn about a new strip/power center, exactly the same editorial process `CADENAS_RUT_CONOCIDOS` already uses for chain RUTs. A DB table would only be justified if the team wanted to edit entries from an admin UI without a code deploy — not implied anywhere in COMPE-04's wording, and not worth the RLS/migration/service-role plumbing for ~25 rows that change rarely.
**Example (derived from `SEED-STRIP-POWER-CENTERS-CHILE.md`'s actual verified rows):**
```typescript
// lib/strip-power-centers-chile.ts
export type StripPowerConfianza = 'alta' | 'media' | 'baja'

export interface StripPowerCenterSeed {
  nombre: string
  formato: 'strip_center' | 'power_center'
  operador: string
  comuna: string
  direccion: string | null       // null / "no confirmada" rows from the seed doc — NOT geocoded
  lat: number | null             // pre-geocoded ONCE by a developer, committed — null when direccion is null
  lng: number | null
  fuente: string                 // URL/citation, never omitted (SEED doc's own discipline)
  confianza: StripPowerConfianza
}

export const STRIP_POWER_CENTERS_CHILE: StripPowerCenterSeed[] = [
  {
    nombre: 'Punta Blanca Maipú (Los Pajaritos)',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Maipú',
    direccion: 'Av. Los Pajaritos 1.948',
    lat: null, // TODO: pre-geocode before shipping — see plan task
    lng: null,
    fuente: 'https://puntablanca.cl/comercial',
    confianza: 'alta',
  },
  // ... remaining ~18 rows from SEED-STRIP-POWER-CENTERS-CHILE.md Tables 1-2,
  // "no confirmada" rows kept with direccion: null / lat: null / lng: null
  // (excluded from spatial matching, but visible for team QA/audit trail).
]
```
**Register in `data-sources.yaml`** (`type: static-kb`, `owner_files: [lib/strip-power-centers-chile.ts]`, `trigger: none`) with a `notes` field that explicitly states the KNOWN gaps (Grupo Patio ~91-158 properties absent, Más Center ~30 operating strip centers absent) — mirroring the exact shape of the existing `sii-nomina-sucursales-holdings-sin-tiendas` entry, so a `strip_center`/`power_center` competencia result has an equally-citable coverage caveat as the SII/Unimarc one does.

### Pattern 5: `CompetidorDetectado` composing into Phase 16's types (additive to `lib/cabida-comercial.ts`)

```typescript
// ADD to lib/cabida-comercial.ts — existing file, do not create a duplicate
// FormatoComercial. IMPORTANT: lib/terrenos-comercial.ts ALSO exports a type
// named FormatoComercial ('local' | 'strip_center' | 'power_center') for the
// unrelated Terrenos-development-potential feature — different value set,
// different module, same name. Never import both into the same file without
// an alias; always import Phase 18's from '@/lib/cabida-comercial', never
// from terrenos-comercial.ts. (See Pitfalls.)

export type FuenteCompetidor = 'osm' | 'seed_list' | 'sii_geocodificado'
export type NivelConfianza = 'alta' | 'media' | 'baja'

export interface CompetidorDetectado {
  nombre: string                  // real chain name (seed_list / sii_geocodificado) or raw OSM tag/name (osm)
  formato: FormatoComercial       // reuses the FormatoComercial already defined in THIS file (Phase 16)
  fuente: FuenteCompetidor
  lat: number
  lng: number
  distanciaM: number
  confianza: NivelConfianza       // per-competitor: e.g. a seed_list row with direccion:null never reaches 'alta'
  direccionLabel?: string
}

export interface ResultadoCompetenciaFormato {
  formato: FormatoComercial
  competidores: CompetidorDetectado[]
  coberturaConocida: boolean      // false = the underlying source(s) for THIS formato are known-incomplete
  confianzaGlobal: NivelConfianza // MUST be capped, never derived purely from competidores.length (COMPE-05)
  disclosure: string              // human-readable line always rendered next to the count — never omitted
  consultadoEl: string
}

// Extends the AnalisisCabidaComercial Phase 16 already defined — additive
// field, does not break existing Phase 16 consumers that don't read it yet.
export interface AnalisisCabidaComercial {
  formato: FormatoComercial
  isocrona: IsocronaResultado
  competencia?: ResultadoCompetenciaFormato   // NEW, optional until Phase 18's server wiring lands
  generadoEl: string
}
```

### Anti-Patterns to Avoid

- **Importing `lib/terrenos-comercial.ts`'s `FormatoComercial` anywhere near this feature.** It is a real, currently-exported type with the same name and an overlapping-but-different value set (`'local' | 'strip_center' | 'power_center'`, no `supermercado`/`minimarket`, used for a completely unrelated feature — lot-size-based development potential classification in the Terrenos module). A stray `import type { FormatoComercial } from '@/lib/terrenos-comercial'` in a Phase 18 file would compile (structurally similar) but silently narrow/corrupt the type. Always import from `@/lib/cabida-comercial`.
- **Letting `competidores.length === 0` set `confianzaGlobal: 'alta'` by construction.** This is COMPE-05's entire point (and `PITFALLS.md` Pitfall 3, already documented at the milestone level with the exact Unimarc example). The confidence computation must check `coberturaConocida` (or an equivalent known-gap flag) BEFORE looking at the count, not after.
- **Geocoding `cadenas_sucursales` rows synchronously inside the Overpass throttle window, or vice versa.** These are two independent external services (Nominatim vs Overpass) with two independent throttles — run them with `Promise.all`, not sequentially, same discipline `app/api/zonificacion/lookup/route.ts` already uses for its own parallel calls (per `16-RESEARCH.md` Pattern 1).
- **Treating the strip/power seed list as complete.** `SEED-STRIP-POWER-CENTERS-CHILE.md` itself documents named, sourced gaps (Grupo Patio, Más Center) — a `strip_center`/`power_center` result must carry the same "known incomplete" caveat as the SII/Unimarc case, not just the one COMPE-05's example text names.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Distance from origin point to each competitor | A manual haversine formula scattered per call site | `turf.distance(origin, poi, { units: 'meters' })` (once `@turf/turf` is installed — see Standard Stack) | Same "don't hand-roll geometry" convention Phase 16 already adopted for `turf.circle()`; a hand-rolled haversine is a second implementation to keep in sync if the team ever needs `turf`'s other functions (point-in-polygon, below) anyway. |
| Filtering Overpass's circular result set to the real isochrone shape | A second, ad-hoc bounding-box or distance check | `turf.booleanPointInPolygon()` against `IsocronaResultado.geometria` | Same library, same "already the team's choice" reasoning; avoids two different, possibly-inconsistent notions of "inside the area." |
| Address-to-coordinate resolution for SII rows | A second geocoding client/wrapper for `cadenas_sucursales` specifically | `geocodeDireccion()` from `lib/geocoding.ts`, called exactly as Phase 16 already calls it | Same throttle instance, same User-Agent, same error contract (`{ ok: false, error }`, never throws) — a second geocoding implementation would double the Nominatim-abuse risk surface for no benefit. |
| Overpass rate-limiting for the new competencia query | A shared global limiter spanning `terrenos-ubicacion.ts` and the new module | Clone `terrenos-ubicacion.ts`'s exact throttle constants (5s min interval, 20s 429-backoff, retry-once, then `OverpassUnavailableError`) into the new module | A cross-module shared limiter would be architecturally cleaner but is a bigger change (touches a stable, unrelated Terrenos file) than this phase's scope justifies — cloning the same conservative constants is the pragmatic choice already implicitly endorsed by `ARCHITECTURE.md`'s "replicate its pattern in a new module" guidance. Flagged as a real, accepted tradeoff below (Pitfall), not silently ignored. |

**Key insight:** Every genuinely new piece of infrastructure this phase needs (Overpass POI-list shape, SII on-demand geocoding, curated seed data) is a *small, mechanical extension* of an already-proven pattern in this exact codebase — the actual engineering risk is in the composition/confidence logic (COMPE-05), not in any of the individual data-fetching pieces.

## Common Pitfalls

### Pitfall 1: `competidores.length === 0` silently read as "confirmed: no competition" (COMPE-05's core failure mode)
**What goes wrong:** The simplest, most "obvious" implementation of the count — literally `competidores.length` — carries no information about whether the underlying source could have found a competitor if one existed. Nothing in the returned array itself signals "Unimarc isn't even in this roster" or "this seed list has no Grupo Patio properties."
**Why it happens:** The coverage-gap information lives in prose (`data-sources.yaml`'s `notes` field, this research doc) — not in the data itself. It's easy to write `formato.competidores.length === 0 ? 'sin competencia' : ...` without realizing the count's honesty depends on a fact that lives in a completely different file.
**How to avoid:** `coberturaConocida`/`confianzaGlobal` are mandatory, non-optional fields on `ResultadoCompetenciaFormato` from the type's very first commit (mirrors `IsocronaResultado.metodo`'s "never optional" discipline from Phase 16, `16-RESEARCH.md` Pitfall 1) — no code path can construct the result type without deciding this. Confidence-degradation logic must reference `data-sources.yaml`'s `sii-nomina-sucursales-holdings-sin-tiendas` entry ID directly in a code comment (not restate the fact independently) so both stay in sync if Unimarc's RUT is ever found.
**Warning signs:** Any code that derives `confianzaGlobal` purely from `competidores.length` without first checking `formato` against a known-incomplete-coverage list.
**Phase to address:** This phase — retrofitting it after Phase 19's veredicto/UI consumes this type means touching every downstream consumer.

### Pitfall 2: A third, uncoordinated Overpass throttle instance increases collision risk with the existing one
**What goes wrong:** `lib/terrenos-ubicacion.ts` already has its own module-level `lastRequestAt`/throttle (5s interval) for the Terrenos domain's scheduled crons (`vercel.json` staggers 5 terrenos-source crons specifically to avoid exhausting Overpass's documented "2 slots/IP" quota — see `data-sources.yaml`'s `terrenos-ubicacion-overpass` notes). A new, independent module for competencia (on-demand, user-triggered, not cron-scheduled) adds a THIRD caller (after `terrenos-ubicacion-overpass` and, separately, `geocoding-nominatim` which shares the same OSM family infra) with no shared rate-limit state between them.
**Why it happens:** Each module's throttle is a local closure over a module-level variable — there is no process-wide or cross-request Overpass rate limiter in this codebase today (confirmed: `data-sources.yaml`'s own note on `geocoding-nominatim` already flags this exact gap: "sin circuit breaker compartido").
**How to avoid:** Since competencia calls are user-triggered (button click on the Cabida Comercial tab), not cron-scheduled in bulk, the collision risk is lower in practice than the terrenos crons colliding with each other — but the new module must still clone the full defensive discipline (5s floor, 429 backoff, `OverpassUnavailableError`) rather than a weaker ad-hoc throttle, and the plan should note this as an accepted, documented tradeoff (not a silent gap) in the new module's own header comment, same style as `terrenos-ubicacion.ts`'s.
**Warning signs:** A competencia Overpass call succeeding in isolation during dev/testing but returning sustained 429s in production shortly after a terrenos cron run.
**Phase to address:** This phase, first Overpass-competencia integration commit — document the tradeoff, don't silently accept it.

### Pitfall 3: `FormatoComercial` name collision between `lib/terrenos-comercial.ts` and `lib/cabida-comercial.ts`
**What goes wrong:** Two real, currently-exported types share the exact name `FormatoComercial` with different, overlapping-but-incompatible value sets. A future file that needs both (e.g., a cross-module report mixing Terrenos' development-potential classification with Cabida Comercial's competitor formats) will hit either a silent type-narrowing bug (if only one is imported and misused) or a compile error requiring an alias.
**Why it happens:** Both were named independently by different phases/sessions without cross-checking the other module — `terrenos-comercial.ts` predates Phase 16/18 and was never revisited.
**How to avoid:** Phase 18 code must always import `FormatoComercial` from `@/lib/cabida-comercial`, never from `@/lib/terrenos-comercial`. If a plan task ever needs both in the same file, alias explicitly (`import type { FormatoComercial as FormatoTerreno } from '@/lib/terrenos-comercial'`). Not a blocking issue for Phase 18 in isolation (nothing in this phase touches Terrenos), but worth a one-line plan-task comment so a future maintainer doesn't `Cmd+click` into the wrong definition.
**Warning signs:** TypeScript errors about `'strip_center'` not being assignable, or (worse) no error at all because the two unions happen to overlap on the literal being used.
**Phase to address:** This phase, at the type-definition commit — cheap to flag now, expensive to discover later via a confusing bug report.

### Pitfall 4: Geocoding `cadenas_sucursales` synchronously inside a user-facing request without a cache check first
**What goes wrong:** If `obtenerCadenasGeocodificadasPorComuna()` (Pattern 3) is called without first checking which rows already have `lat`/`lng`, every tab-open re-geocodes the same handful of addresses at 1.1s/request — slow, and wastes Nominatim's shared public quota for no reason (the addresses don't change between requests).
**Why it happens:** It's the simplest correct-looking implementation to "just geocode what's needed each time" without threading the persisted-cache check through.
**How to avoid:** The `if (fila.lat != null && fila.lng != null) { ...skip geocoding... }` branch in Pattern 3's example is not optional — it is the entire point of persisting `lat`/`lng` onto the row instead of geocoding into a throwaway in-memory result.
**Warning signs:** The Cabida Comercial tab taking multiple seconds to load competencia data on EVERY open for the same oportunidad/comuna, not just the first.
**Phase to address:** This phase, the geocoding-extension task itself.

## Code Examples

### Existing Overpass call (the exact pattern to clone, not import)
```typescript
// Source: lib/terrenos-ubicacion.ts, lines 62-93 (read in full)
async function consultarOverpass(lat: number, lng: number): Promise<Response> {
  const query = `[out:json][timeout:15]; ... `
  return fetchWithTimeout('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'PermisoHub/1.0 (+https://permisohub.cl)',  // REQUIRED — default UA gets 406'd
    },
    body: `data=${encodeURIComponent(query)}`,
  }, 20_000)
}
```

### Existing geocoding call (reuse verbatim for COMPE-06)
```typescript
// Source: lib/geocoding.ts, lines 65-119 (read in full)
export async function geocodeDireccion(direccion: string, comuna: string): Promise<GeocodeResult>
// Builds query = `${direccion}, ${comuna}, Santiago, Chile`. Never throws;
// { ok: false, error } on any failure. 1.1s module-level-queued throttle.
```

### `sii-nomina-sucursales-holdings-sin-tiendas` — the exact source-of-truth entry COMPE-05's code must cite
```yaml
# Source: .planning/data-sources.yaml, lines 439-450 (read in full)
- id: sii-nomina-sucursales-holdings-sin-tiendas
  name: "SII nómina — RUTs de holding sin cobertura real de tiendas (Walmart, SMU) — RESUELTO, cobertura de SMU parcial por decisión"
  # ...
  notes: "... Unimarc — la marca más grande de SMU, mayoría de sus ~300
    tiendas — no aparece como razón social propia en la nómina ...
    Decisión founder (1 ago 2026): NO seguir invirtiendo tiempo de agente en
    encontrar el RUT de Unimarc — cobertura parcial de SMU (Alvi + Super10)
    es aceptable por ahora."
```
Phase 18's confidence-degradation code should cite this `id` literally in a comment (see Pattern 5 / Pitfall 1) so the two artifacts (governance doc + code) never drift independently.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `obtenerSenalesUbicacion()` returns Overpass counts only | Phase 18 needs a POI-list variant (name/tag/coords) | This phase | Cannot literally extend the existing function's return type without breaking its one current caller (`lib/terrenos-server.ts`'s `enriquecerTerreno()`, which only wants a count) — a new function/module is the correct move, not a signature change to the existing one. |
| `cadenas_sucursales` used only for comuna-level "chain present" signals (`obtenerSenalesExpansionPorComuna()`) | Phase 18 needs per-store lat/lng for point-radius competitor matching | This phase | The existing comuna-level function stays useful and unmodified for its current caller (oportunidades list page); the new geocoded function is an addition, not a replacement. |

**Deprecated/outdated:** Nothing in this phase deprecates existing code — every change is additive (new files, new nullable columns, new optional type fields).

## Open Questions

1. **When does the final wiring into `obtenerAnalisisCabidaComercial()` actually happen, given Phase 16 isn't done?**
   - What we know: `lib/cabida-comercial-server.ts` doesn't exist yet. Phase 18's four standalone pieces (Overpass POI module, seed data, SII geocoding extension, types) can be built and unit-tested with zero dependency on that file. Only the final composition step needs it.
   - What's unclear: Whether the planner should (a) write Phase 18's plans assuming Phase 16 will have landed by execution time (treating the wiring task as a normal task, accepting it'll fail-fast and need a rerun if sequencing slips), or (b) explicitly gate the wiring task behind a documented human/orchestrator checkpoint, or (c) have Phase 18 itself create a minimal `lib/cabida-comercial-server.ts` stub (just enough for `obtenerCompetencia()` to exist and be tested standalone) that Phase 16-04's real build would then need to merge with rather than create fresh.
   - Recommendation: (b) is safest — mirrors how `16-RESEARCH.md`'s own Open Question 1 already asks the planner to explicitly confirm sequencing rather than default silently. Phase 18's plan should produce 3-4 fully executable, independently-verifiable plans for the standalone pieces, and a final plan explicitly marked "depends on Phase 16 completion" for the wiring — not silently interleaved.

2. **Pre-geocode the entire strip/power seed list now (committed lat/lng), or geocode on-demand like `cadenas_sucursales`?**
   - What we know: The seed list is small (~19-25 rows) and static (edited rarely, by a developer PR) — unlike `cadenas_sucursales` (605 rows, refreshed monthly by a cron), there's no ongoing ingestion process that would naturally re-trigger geocoding.
   - What's unclear: Whether the planner wants a one-time geocoding script (run once, commit the resulting `lat`/`lng` literals into `lib/strip-power-centers-chile.ts`) or the same on-the-row on-demand pattern as `cadenas_sucursales`.
   - Recommendation: Pre-geocode and commit literal `lat`/`lng` values for the "Alta"/"Media" confidence rows with real addresses — since the list changes by PR, not by an automated pipeline, there's no reason to pay Nominatim's throttle at runtime for data that's already known at commit time. Leave `lat: null, lng: null` for "no confirmada" rows (they can't be geocoded meaningfully anyway).

3. **Does `radioM` for the Overpass competencia query come from a fixed constant (like `terrenos-ubicacion.ts`'s `RADIO_ANCHORS_M = 1000`) or derived from the actual isochrone's bounding extent?**
   - What we know: Pattern 2 above recommends filtering the *result* against the real isochrone polygon, but Overpass's own `around:` search still needs SOME radius parameter to bound the query itself.
   - What's unclear: Whether a fixed generous constant (e.g., 3000m, comfortably covering a 15-minute walking or 15-minute driving isochrone in either direction) is acceptable, or whether the radius should be computed per-request from the isochrone's actual bounding box (more precise, more code).
   - Recommendation: A fixed, generous constant is simpler and sufficient — Overpass query cost scales with area searched, so an oversized-but-fixed radius is cheap relative to the precision gained from a computed bounding box, and the `turf.booleanPointInPolygon()` filter (Pattern 2) already does the real precision work downstream.

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `lib/terrenos-ubicacion.ts` (read in full, 143 lines) — Overpass query shape, throttle/backoff/`OverpassUnavailableError` discipline, User-Agent 406 gotcha
- `lib/cabida-comercial.ts` (read in full, 84 lines) — Phase 16's real, stable client-safe types (`UbicacionCabida`, `IsocronaResultado`, `FormatoComercial`, `AnalisisCabidaComercial`)
- `lib/scrapers/sii-nomina-sucursales.ts` (read in full, 161 lines) — `CADENAS_RUT_CONOCIDOS` curated-array precedent, real coverage numbers (Walmart 211, SMU ~124), Unimarc gap narrative
- `lib/cadenas-sucursales-server.ts` (read in full, 226 lines) — confirmed no `lat`/`lng` columns exist yet; `obtenerSenalesExpansionPorComuna()`'s `normalizarNombreComuna()` cross-check pattern to reuse
- `lib/geocoding.ts` (read in full, 185 lines) — `geocodeDireccion()`/`geocodeComunaCentroide()` contracts, throttle-via-promise-chain pattern
- `lib/terrenos-comercial.ts` (read in full, 54 lines) — confirmed the `FormatoComercial` name collision (Pitfall 3)
- `supabase/migrations/20260808_cadenas_sucursales.sql`, `20260809_cabida_comercial_cache.sql` (read in full) — confirmed exact current schema (no lat/lng on either table's Phase-16-narrow version)
- `.planning/phases/16-ubicacion-e-isocrona-motor-desacoplado/16-04-PLAN.md` (read in full, 383 lines) — the documented-but-not-built `obtenerAnalisisCabidaComercial(lat, lng, formato, opts?)` signature, `obtenerIsocrona()` cache-through shape
- `.planning/phases/16-ubicacion-e-isocrona-motor-desacoplado/16-RESEARCH.md` (read in full, 363 lines) — file-splitting convention, Pitfall 1/2 patterns (explicit-status-never-optional, axis-order), resolver-split precedent
- `.planning/research/SEED-STRIP-POWER-CENTERS-CHILE.md` (read in full, 118 lines) — the actual sourced seed data (15 strip + 4 power centers, RM, with confidence per row) and its own documented gaps (Grupo Patio, Más Center)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md` (grepped/read relevant sections) — milestone-level competencia design (per-field cache status, `obtenerCompetencia()` composition point, Pitfall 3's exact "Unimarc → confianza BAJA" guidance)
- `.planning/data-sources.yaml` (read relevant entries in full) — `sii-nomina-sucursales-holdings-sin-tiendas` (the exact source-of-truth entry for COMPE-05), `terrenos-ubicacion-overpass`, `geocoding-nominatim` (confirmed no shared circuit breaker), `static-kb` type precedent for the new seed-list entry
- Filesystem checks (`ls lib/cabida-comercial-server.ts`, `ls node_modules/@turf`, `grep turf package.json`) — confirmed live that Phase 16-04/16-01 have not executed and `@turf/turf` is not installed, the load-bearing fact behind the sequencing constraint

### Secondary (MEDIUM confidence)
- None — every finding in this document is grounded in direct inspection of files that exist in this exact repository today; no external web research was needed (the domain here is "how does this codebase already do X," not "what does an external library/API support").

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library choice (Overpass, Nominatim, turf, Zod) is either already in production use in this codebase or an explicit, already-settled milestone-level decision (turf, per Phase 16 research) not re-litigated here.
- Architecture: HIGH for the four standalone pieces (verified against real, currently-in-production code); MEDIUM for the final wiring point specifically, because it composes into a function (`obtenerAnalisisCabidaComercial`) that is documented but does not exist yet — its exact eventual shape is trusted (it's a written, reviewed plan file) but unverified by execution.
- Pitfalls: HIGH — Pitfall 1 (coverage-gap silently read as "confirmed none") is directly sourced from `PITFALLS.md`'s own explicit Unimarc example at the milestone level; Pitfall 3 (type name collision) and Pitfall 4 (uncached geocoding) are both grounded in direct inspection of real code, not speculation.

**Research date:** 2026-08-02
**Valid until:** ~30 days for the architecture/pattern findings (stable, code-verified). Re-verify the Phase 16 completion status specifically before starting execution — if `lib/cabida-comercial-server.ts` exists by then, the sequencing constraint in User Constraints is resolved and the final wiring task can proceed normally; if it still doesn't exist, Open Question 1 needs an explicit answer before that task is executed.
