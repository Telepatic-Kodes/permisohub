# Architecture Research — v1.7 Cabida Comercial (Demografía y Consumo)

**Milestone:** Tab "Cabida Comercial" en `/mercado-inmobiliario/oportunidades/[id]` — isócrona + demografía/consumo + competencia por formato + veredicto citado, diseñado para correr standalone por dirección en un milestone futuro.
**Researched:** 2026-08-02
**Based on:** Direct inspection of `lib/geocoding.ts`, `lib/zonificacion*.ts`, `app/api/zonificacion/lookup/route.ts`, `lib/mercado-locales-server.ts`, `lib/terrenos-ubicacion.ts` (Overpass), `lib/cadenas-sucursales-server.ts`, `supabase/migrations/20260730_zonificacion*.sql` + `20260802_mercado_locales_listings.sql` + `20260808_cadenas_sucursales.sql`, `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx`, `components/mercado-inmobiliario/oportunidad-detalle/*.tsx`, `.planning/PROJECT.md`, `.planning/data-sources.yaml`, `.planning/RESEARCH-MERCADO-CENTROS-COMERCIALES.md`. Plus targeted web verification of INE ArcGIS census coverage and isochrone-provider free tiers (see Sources).
**Confidence:** HIGH on integration surface (verified against real code). MEDIUM-LOW on external data availability for 2 of 4 target formats — flagged explicitly below, this is the load-bearing uncertainty for the whole milestone.

## Executive Summary

The existing codebase already contains **three of the four building blocks Cabida Comercial needs**, each living in a different subsystem, none of them wired together today:

1. **Geocoding** — `lib/geocoding.ts` (`geocodeDireccion`), server-only, Nominatim-based, already used by zonificación. Reusable as-is, zero changes needed.
2. **"Query an external geo-service, cache by rounded coordinates, expose an explicit `force` refresh"** — the exact orchestration shape in `app/api/zonificacion/lookup/route.ts` (geocode → cache read-through on `(comuna_id, lat_r, lng_r)` → external call → upsert → return). Cabida Comercial's isochrone step is architecturally identical to this, just with a different external service (isochrone provider instead of ArcGIS) and no comuna-tier registry gate.
3. **Nearby-commerce-by-radius via Overpass** — `lib/terrenos-ubicacion.ts` (`obtenerSenalesUbicacion`) already queries OSM for `shop~"mall|supermarket|department_store"` within 1000m of a point, with production-grade rate-limit handling (2 slots/IP, 5s throttle, 429 backoff, `OverpassUnavailableError`). It currently returns **counts only** (`out count`), not named/located POIs — Cabida Comercial needs the POI list itself (name, tag, coordinates), which is a natural extension of the same query shape, not a new integration pattern.

The **fourth block — a true isochrone (not a circle) and granular demographic/consumption data — does not exist anywhere in the codebase today**, and is the genuinely new, unverified piece. Research below (Sources) confirms INE does publish Census 2017 population at **manzana censal** (city-block) granularity via an ArcGIS `MapServer`/`FeatureServer` under the same INE account already used for building-permits data (`sig.ine.cl`, `geoine-ine-chile.opendata.arcgis.com`) — this is directly queryable with the same "point/polygon → ArcGIS query → GeoJSON" pattern zonificación already uses, which is a strong signal the founder's precision bar (isócrona, not comuna) is achievable **for population**. Consumption/spending data (Encuesta de Presupuesto Familiar and similar) is published at a much coarser geography (Gran Santiago / regional-capital level) in INE's standard releases — no manzana-level consumption dataset was found. This means "demografía y consumo" cannot be treated as one uniform data layer: **population intersects the isochrone at high precision; consumption/spend is realistically a comuna-or-GSE-level proxy overlaid on top, not independently isochrone-precise.** This asymmetry should be locked into Requirements explicitly, not discovered mid-build.

A second, code-verified risk is more severe: **`mercado_locales_listings` (the "oportunidad" row) has no structured address field** — only `titulo` (a scraped ad headline) and `comuna`. The one somewhat-usable field is `atributos_raw->>'locationText'` (a sector-level teaser string like "Providencia, Metropolitana", captured by the scraper but never surfaced as a column) — coarser than a street address, comparable to what `proyectos.direccion` gives zonificación today. Geocoding an oportunidad for Cabida Comercial will therefore be **less precise than geocoding a proyecto**, directly undercutting the founder's stated precision priority, independent of which isochrone provider gets chosen. This should be tested with real data before any isochrone-provider decision is locked in.

Finally, the target formats named in `.planning/PROJECT.md` split into two very different data-availability tiers: `supermercado` and `minimarket` map cleanly onto standard OSM shop tags (`shop=supermarket`, `shop=convenience`) that Overpass already proved queryable in this exact codebase (`terrenos-ubicacion.ts`). `strip_center` and `power_center` are Chilean commercial-real-estate typologies, **not OSM shop tags** — no node/way in OSM is tagged "this building is a strip center." The only lead found (`.planning/RESEARCH-MERCADO-CENTROS-COMERCIALES.md`, from the sales-research track) cites a Cámara Chilena de Centros Comerciales count of 277 assets (53 malls / 76 power centers / 70 strip centers / 68 stand-alone / 10 outlets) with **no public address list or API** — that number is marketing-verified, not integration-verified. Treat automated strip/power-center detection as **unresolved**, not merely "needs more research time" — it may not be automatable within v1.7's public-data constraint at all, and Requirements needs to decide a fallback (manual entry, AI-assisted inference from Overpass `landuse=retail` clusters, or explicit "sin datos suficientes" per format) before roadmap phases are cut.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXISTING — reused as-is                                                     │
│  lib/geocoding.ts :: geocodeDireccion(direccion, comuna) → {lat,lng}         │
│  (Nominatim, server-only, throttled 1.1s — same instance zonificación uses)  │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW — lib/cabida-comercial-server.ts (orchestration, mirrors                │
│  app/api/zonificacion/lookup/route.ts's shape, NOT its code)                 │
│                                                                                │
│  resolverUbicacionDesdeOportunidad(oportunidadId)  ──┐                       │
│  resolverUbicacionDesdeDireccion(direccion, comuna) ──┼──► UbicacionCabida    │
│  (lat, lng override, same seam zonificacion/lookup    │    {lat,lng,comuna,   │
│   already exposes for pre-geocoded callers)          ─┘     direccionLabel}  │
│                                                                                │
│  obtenerAnalisisCabidaComercial(ubicacion, opts) — single entry point,       │
│  same signature regardless of caller (v1.7: oportunidad; future: dirección)  │
│    1. obtenerIsocrona()      → cache-through → external isochrone provider   │
│    2. obtenerDemografia()    → cache-through → INE ArcGIS (manzana censal)   │
│    3. obtenerCompetencia()   → cache-through → Overpass (extended query)     │
│    4. evaluarCabidaPorFormato() — PURE function, single source of truth      │
│       (same role as evaluarOportunidad() in mercado-locales-server.ts)       │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW table — cabida_comercial_cache (Supabase)                              │
│  keyed by (lat_r, lng_r, modo, minutos) — same rounding/UNIQUE-index pattern │
│  as zonificacion_cache. Per-field status (NOT one blanket status column) so  │
│  a demografía failure doesn't blank an already-fetched competencia result.  │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW — app/api/cabida-comercial/analisis/route.ts                           │
│  Accepts oportunidadId OR direccion+comuna OR lat+lng — same "generic core, │
│  entity-specific caller resolves first" shape as zonificacion/lookup.       │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                 │  fetch() on user action, NOT eager SSR
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW — components/mercado-inmobiliario/oportunidad-detalle/                 │
│         cabida-comercial-tab.tsx  ("use client", follows ResumenTab's       │
│         on-demand-fetch pattern, NOT the eager-server-fetch pattern of      │
│         Posicionamiento/Historial/Comparables)                              │
│                                                                                │
│  MODIFIED — app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx │
│  adds a 5th <TabsTrigger>/<TabsContent>, passes only oportunidad.id + comuna │
│  (no eager data fetch added to the parent Promise.all — see rationale below) │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Integration Points (real file names)

| File / Module | New or Modified | Role |
|---|---|---|
| `lib/geocoding.ts` | **Reused, unmodified** | `geocodeDireccion()` — same Nominatim call zonificación uses. No change. |
| `app/api/zonificacion/lookup/route.ts` | **Reused as reference pattern only** | Not called by Cabida Comercial — its *shape* (geocode → cache-through → external call → upsert → explicit `force`) is the template for the new route. Zoning and Cabida Comercial stay fully decoupled subsystems; they only share the geocoding primitive. |
| `lib/terrenos-ubicacion.ts` | **Reused pattern, not the module itself** | `obtenerSenalesUbicacion()`'s Overpass query construction, throttle (5s/`MIN_INTERVAL_MS`), and `OverpassUnavailableError` handling are the direct template for the new competencia query — but that file is scoped to the Terrenos domain (`enriquecerTerreno()`) and returns counts only. Do not import it from Mercado Inmobiliario; replicate its *pattern* in a new module that returns POIs, not counts. |
| `lib/cadenas-sucursales-server.ts` + `cadenas_sucursales` table | **Reused as a secondary signal, not primary** | Already has Walmart (211 direcciones, alta confianza) and partial SMU (Alvi + Super10; Unimarc explicitly not resolved — founder decision 1 ago 2026 to stop chasing it). No `lat`/`lng` columns — only `calle`/`comuna` text, so it cannot be intersected with an isochrone polygon without a geocoding pass of its own. Useful as a "known national chain present in this comuna" cross-check (same role it already plays via `obtenerSenalesExpansionPorComuna()` on the oportunidad detail page today), not as the primary competencia-por-formato source. |
| `lib/mercado-locales-server.ts` | **Unmodified** | `obtenerOportunidadPorId()` stays the read path for the oportunidad itself; Cabida Comercial consumes its output (`id`, `comuna`, `titulo`) but does not modify this file. |
| `supabase/migrations/20260802_mercado_locales_listings.sql` | **Read-only finding** | Confirms `mercado_locales_listings` has no `direccion`/`lat`/`lng` columns — only `titulo`, `comuna`, `atributos_raw jsonb`. This is a hard constraint on v1.7 geocoding precision, documented above. |
| `lib/scrapers/portalinmobiliario.ts` | **Read-only finding** | `atributos_raw.locationText` (from `poly-component__location`) is captured for mercado-locales cards but currently unused beyond raw storage — the best available geocoding input for an oportunidad, better than `titulo`, still sector-level not street-level. |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` | **Modified** | Add a 5th tab. Do **not** add Cabida Comercial's data fetch to the existing `Promise.all([...])` eager fetch — see rationale in "Tab integration" below. |
| `components/mercado-inmobiliario/oportunidad-detalle/*.tsx` | **New sibling added, existing 4 untouched** | `PosicionamientoTab`/`HistorialTab`/`ComparablesTab`/`ResumenTab` are unmodified. New: `cabida-comercial-tab.tsx`. |
| `lib/cabida-comercial-server.ts` | **New** | Server-only orchestration module (see Service-Layer Interface below). |
| `lib/cabida-comercial.ts` | **New** | Client-safe types + Zod schemas + fetch helper — mirrors `lib/zonificacion.ts` exactly (never imports the service-role Supabase client). |
| `lib/cabida-comercial-geo.ts` (only if the chosen isochrone provider needs geometry conversion) | **New, conditional** | Mirrors `lib/zonificacion-geo.ts`'s role (Esri rings → GeoJSON) but for whatever the isochrone provider returns. If the provider returns GeoJSON natively (OpenRouteService does), this file may not be needed at all — confirm during Phase 1 of build order before creating it. |
| `app/api/cabida-comercial/analisis/route.ts` | **New** | Orchestration endpoint, generic-by-location with an oportunidad-resolving convenience path — see Service-Layer Interface. |
| `supabase/migrations/2026XXXX_cabida_comercial_cache.sql` | **New migration** | `cabida_comercial_cache` table — see Cache Design below. |
| `components/proyecto/zonificacion-mapa.tsx` (Leaflet) | **Reused pattern, likely copied not imported** | Same dynamic-`import("leaflet")` + GeoJSON-layer pattern needed to render the isochrone polygon + competitor pins. It's currently coupled to a single zone polygon prop shape; a new `cabida-comercial-mapa.tsx` following the same structure (not extending this one) keeps the two domains decoupled, matching how zonificación itself stayed decoupled from Terrenos' own Overpass usage. |
| `components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx` + `lib/sse-client.ts` | **Reused pattern, not the code** | On-demand client-fetch-on-button-click pattern (loading/error/result states, no auto-run) is the direct template for `cabida-comercial-tab.tsx`. SSE streaming itself is optional for Cabida Comercial (the payload is structured JSON, not narrated text) — a plain `fetch()` + JSON response is simpler and sufficient; reuse the *state-machine* shape of `ResumenTab`, not its SSE transport. |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/informe/page.tsx` | **Modified, later phase** | Print report re-fetches oportunidad data independently server-side (does not receive props from the tab page) — Cabida Comercial's result should be addable here the same way, calling `obtenerAnalisisCabidaComercial()` directly, once the tab itself is stable. Not part of the initial build. |

## Key Decision 1 — Isochrone computation: reuse vs. parallel to zonificación

**Decision: parallel subsystem, shared primitive only.** Do not add isochrone logic to `lib/zonificacion*.ts` or trigger it from `persistZonificacionParaProyecto()`. Reasons, all verified against the actual code:

- Zonificación's cache key is `(comuna_id, lat_r, lng_r)` and its coverage gate (`resolveComunaZonificacion`) is a **comuna allow-list** tied to specific ArcGIS MINVU/OCUC FeatureServers per comuna. An isochrone has no such allow-list — it's computable for any address the geocoder resolves, nationwide (subject to the provider's own routing-network coverage, not a curated comuna registry). Bolting isochrone logic onto `zonificacion-comunas.ts`'s registry pattern would import a constraint that doesn't apply.
- `zonificacion_cache` snapshots onto `proyectos.zona_*` columns via `persistZonificacionParaProyecto()` — a proyecto-specific side effect (fire-and-forget `after()` trigger on proyecto creation). Cabida Comercial has no equivalent "snapshot onto the owning row" need in v1.7 — the analysis result lives in its own cache table and is fetched on-demand by the tab, not eagerly attached to `mercado_locales_listings`.
- The one thing that *should* carry over 1:1 is the **`lat`/`lng` override seam** already present in `app/api/zonificacion/lookup/route.ts` (`"cuando el llamador ya tiene coordenadas precisas de otra fuente... se saltan Nominatim por completo"`). The new `app/api/cabida-comercial/analisis/route.ts` should expose the identical override, for the identical reason: a future caller (e.g., a terreno or proyecto that already resolved its own coordinates) shouldn't re-geocode.

**Where it actually lives:** `lib/cabida-comercial-server.ts` calls `geocodeDireccion()` (imported directly from `lib/geocoding.ts`, no wrapper) as its first step when given a raw address, then calls a new isochrone-provider client. That provider client is its own small module (`lib/isocrona-provider.ts` or inlined if small enough — decide during Phase 1) — a sibling of `lib/geocoding.ts`, not a member of the zonificación family, because it talks to a routing service (OpenRouteService or equivalent), a fundamentally different API shape than ArcGIS `query` or Nominatim `search`.

## Key Decision 2 — New cache table, analogous to `zonificacion_cache`

**Yes, a new table is warranted — `cabida_comercial_cache`.** Recommended shape, directly modeled on `zonificacion_cache` (`supabase/migrations/20260730_zonificacion.sql`) but adapted for three independent external calls instead of one:

```sql
CREATE TABLE IF NOT EXISTS cabida_comercial_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_r numeric(9,6) NOT NULL,
  lng_r numeric(9,6) NOT NULL,
  modo text NOT NULL,              -- 'caminando' | 'auto' — isochrone profile
  minutos integer NOT NULL,        -- isochrone range, e.g. 10/15

  isocrona_status text NOT NULL DEFAULT 'pendiente',   -- explicit 4-state enum, same discipline as proyectos.zona_status
  isocrona_geometria jsonb,        -- GeoJSON Polygon, NULL until fetched
  isocrona_proveedor text,         -- e.g. 'openrouteservice' — forward-compat if provider changes

  demografia_status text NOT NULL DEFAULT 'pendiente',
  demografia jsonb,                -- population intersected at manzana level; shape TBD by Phase 1 findings
  demografia_fuente_url text,

  competencia_status text NOT NULL DEFAULT 'pendiente',
  competencia jsonb,               -- array of {formato, nombre, lat, lng, distanciaM, fuente}
  competencia_fuente text,         -- 'overpass' | 'cadenas_sucursales' | mixed

  consultado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cabida_comercial_cache_geo
  ON cabida_comercial_cache (lat_r, lng_r, modo, minutos);

ALTER TABLE cabida_comercial_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabida_comercial_cache_read" ON cabida_comercial_cache
  FOR SELECT TO authenticated USING (true);
-- writes only via service role, same as zonificacion_cache and cadenas_sucursales
```

**Why per-field status, not one column:** this is a direct, deliberate application of the lesson already documented in this codebase's own zonificación code (`lib/zonificacion-server.ts`'s comment citing "Pitfall 6: estado explícito, nunca solo nullability" and writing `zona_status` on every branch including failure). Cabida Comercial orchestrates **three independent external services** with three independent failure modes (isochrone provider quota, INE ArcGIS availability, Overpass's well-documented 2-slots/IP throttling). A single blanket `status` column would force an all-or-nothing retry and would make "demografía failed, competencia succeeded" indistinguishable from "nothing ran yet" — exactly the bug class Pitfall 6 exists to prevent. Each sub-fetch gets cached and retried independently; the "Actualizar" action (matching `?force=true` on `/api/zonificacion/lookup`) should support refreshing one field or all three, not force an all-three refresh every time (this also reduces isochrone-provider quota burn on retries triggered by an unrelated Overpass hiccup).

**Why one table, not three:** all three pieces are keyed by the *same* location+mode+range tuple and are always read together by the tab — splitting into `cabida_isocrona_cache` / `cabida_demografia_cache` / `cabida_competencia_cache` would require three round-trips and three separate unique-index lookups for what is, from the UI's perspective, a single "analysis." One row per location-lookup matches `zonificacion_cache`'s own philosophy (a single row is "the answer for this point," not decomposed into per-source rows) and is simpler for the "Actualizar" button to reason about even with per-field status inside it.

## Key Decision 3 — Tab integration on the opportunity detail page

**Add a 5th `<TabsTrigger>`/`<TabsContent>` pair, but do not fetch its data eagerly in `page.tsx`.** This is a deliberate deviation from how Posicionamiento/Historial/Comparables/Resumen-context data is currently assembled (all inside the single `Promise.all([...])` at the top of `OportunidadDetallePage`), for a reason verified by the code itself: everything in that `Promise.all` today is a **cheap, already-cached Supabase read** (`mercado_locales_stats_diarias`, `mercado_locales_historial_precio`, `cadenas_sucursales`) — nothing in it makes a live external network call at page-render time. Cabida Comercial's data requires three live external calls (geocoding if not cached, isochrone provider, INE ArcGIS, Overpass) each with real latency and, for Overpass specifically, a documented hard quota (2 slots/IP) shared with the Terrenos module's own usage. Eagerly running this on every oportunidad-detail page view — most of which will never open that tab — would both slow down the page for everyone and burn shared, rate-limited quota for no reason.

The existing precedent for this exact tradeoff already exists on the same page: `ResumenTab` (AI executive summary) is **not** in the `Promise.all` either — it's a `"use client"` component that calls its own API route on button click, with its own loading/streaming/error state. `CabidaComercialTab` should follow that shape exactly: pass it only `{ oportunidadId: oportunidad.id }` (or `{ oportunidadId, comuna: oportunidad.comuna }` for a nicer empty-state label before the user clicks "Analizar"), and let it own its own `fetch()` to `app/api/cabida-comercial/analisis/route.ts` on demand. Cached results (from `cabida_comercial_cache`) mean a second visit to an already-analyzed oportunidad returns instantly without re-hitting any external service — the button becomes "Ver análisis" / "Actualizar" rather than "Analizar" once a cache row exists, mirroring the "Actualizar" button precedent from zonificación (Plan 11-06) rather than any silent background refresh.

## Key Decision 4 — Service-layer interface for "given an oportunidad" now, "given a raw address" later

**This exact split already has a working precedent in this codebase — replicate its shape, not just its spirit.** `app/api/zonificacion/lookup/route.ts` is a generic, entity-agnostic endpoint that takes `direccion`+`comuna` (with an optional `lat`/`lng` override for callers who already have coordinates); `lib/zonificacion-server.ts::persistZonificacionParaProyecto()` is a thin, proyecto-specific adapter that calls it and writes the result onto `proyectos`. The generic route has zero knowledge of "proyecto" as a concept. Cabida Comercial should be structured identically:

```typescript
// lib/cabida-comercial.ts — client-safe (mirrors lib/zonificacion.ts)
export interface UbicacionCabida {
  lat: number
  lng: number
  comuna: string
  direccionLabel: string   // display string only, not necessarily geocodable itself
}

// lib/cabida-comercial-server.ts — server-only orchestration

// Resolution layer — one function per input shape. Each produces the SAME
// canonical UbicacionCabida; nothing downstream cares which one ran.
export async function resolverUbicacionDesdeOportunidad(oportunidadId: string): Promise<UbicacionCabida | null>
// v1.7: reads mercado_locales_listings, prefers atributos_raw.locationText
// over titulo as the geocoding input (see Executive Summary finding),
// falls back to titulo if locationText is absent, geocodes via
// geocodeDireccion(), returns null (never throws) if geocoding fails —
// same "explicit non-success, no thrown exception for an expected miss"
// contract as geocodeDireccion() itself.

export async function resolverUbicacionDesdeDireccion(direccion: string, comuna: string): Promise<UbicacionCabida | null>
// Exists NOW, called by nothing in v1.7 except tests — this is the real seam
// for the future standalone milestone. It is intentionally almost identical
// to resolverUbicacionDesdeOportunidad's tail end (both end in the same
// geocodeDireccion() call) — the duplication is the point: each resolver
// owns exactly the "how do I get a direccion+comuna out of MY input shape"
// logic and nothing else.

// Analysis layer — ONE function, takes ONLY the canonical shape.
// Never accepts an oportunidadId or a raw address string directly — that
// would let a caller skip the resolution step and reintroduce
// entity-specific logic into the analysis itself, the exact coupling this
// split exists to prevent.
export async function obtenerAnalisisCabidaComercial(
  ubicacion: UbicacionCabida,
  opts?: { modo?: 'caminando' | 'auto'; minutos?: number; force?: boolean },
): Promise<AnalisisCabidaComercial>
```

`app/api/cabida-comercial/analisis/route.ts` accepts `{ oportunidadId }` OR `{ direccion, comuna }` OR `{ lat, lng, comuna }` in the request body, calls the matching resolver, then always calls `obtenerAnalisisCabidaComercial()`. **v1.7's UI only ever sends `{ oportunidadId }`** — but the route, the server module, and the cache table already support the other two shapes from day one, so the future standalone-by-address milestone is additive (a new page + a new UI entry point calling the same route with a different body shape), not a rewrite. This directly satisfies the founder's explicit standalone-later requirement, and is not speculative: it's the same pattern this codebase already shipped once for zonificación.

One consequence worth flagging for Requirements: because `resolverUbicacionDesdeOportunidad()` geocodes off `atributos_raw.locationText`/`titulo` (sector-level text, not a real street address — see Executive Summary), the `UbicacionCabida` it produces will typically be **less precise** than one produced by `resolverUbicacionDesdeDireccion()` with a real user-typed address in the future standalone flow. The interface doesn't hide this — `AnalisisCabidaComercial` should carry the resolved `direccionLabel` and ideally a `precision: 'exacta' | 'aproximada'` flag so the tab can disclose it, consistent with this module's "never fabricate/hide" data discipline (same discipline already named explicitly in `.planning/PROJECT.md`'s v1.7 goal).

## The Risky Piece — Data Availability (do this first)

Ranked by how much it could force a scope change, most dangerous first:

### 1. Can an oportunidad be geocoded precisely enough at all? (CONFIRM BEFORE ANYTHING ELSE)

**Confidence: LOW — untested against real data.** `mercado_locales_listings` has no `direccion` column (verified: `supabase/migrations/20260802_mercado_locales_listings.sql`). The best available input, `atributos_raw->>'locationText'`, is a scraped card teaser (e.g., "Providencia, Metropolitana") — sector-level at best, sometimes just a comuna name. Feeding that into `geocodeDireccion()` (which builds `"{direccion}, {comuna}, Santiago, Chile"` and takes Nominatim's first result) will often resolve to a comuna centroid or an arbitrary point within the sector, not the actual listing's building. **This directly undermines the founder's stated reason for choosing isócrona over comuna-level ("precisión sobre disponibilidad garantizada")** — a 10-minute walking isochrone drawn from an imprecise point can meaningfully change which competitors and which population fall inside it. Action: before selecting an isochrone provider, pull ~20 real `mercado_locales_listings.atributos_raw.locationText` values and run them through `geocodeDireccion()` to see the actual precision distribution. If it's consistently comuna-centroid-grade, Requirements needs to decide whether v1.7 ships with an explicit "ubicación aproximada" disclosure (cheap) or invests in improving the scraper's address capture first (bigger, likely out of scope for this milestone).

### 2. Does INE's ArcGIS census service actually support point/polygon intersection queries at manzana level, live? (VERIFY WITH A REAL REQUEST)

**Confidence: MEDIUM — found via web search, not yet verified with a live HTTP call the way `.planning/data-sources.yaml` verified the INE building-permits service.** Sources found: `sig.ine.cl/server/rest/services/Open_Data/Censos/MapServer` and `geoine-ine-chile.opendata.arcgis.com` publish Census 2017 population by manzana. The existing INE building-permits integration (`.planning/data-sources.yaml`, entry investigated 1 ago 2026) confirms the *same account family* (`publicaciones_geodatos`) is real, CC BY-SA 4.0 (commercial use fine, attribution required), and was verified live rather than trusted from docs alone — apply that identical discipline here before committing to it in Requirements: confirm the manzana layer supports a spatial `query` with an isochrone polygon geometry (not just `groupByFieldsForStatistics` by comuna, which is what the permits integration uses), and confirm the polygon-intersect query performs acceptably (isochrone polygons can have complex boundaries; ArcGIS spatial queries against them are heavier than the single-point query zonificación already does).

### 3. Consumption/spending data — comuna-level proxy, not isochrone-precise (LOCK THIS INTO SCOPE, DON'T DISCOVER IT LATE)

**Confidence: MEDIUM.** No manzana- or isochrone-level consumption/spend dataset was found for Chile in this research pass. INE's Encuesta de Presupuestos Familiares and similar consumption surveys publish at "área geográfica" granularity (Gran Santiago vs. other regional capitals) — far coarser than population. Realistic design: population is genuinely isochrone-precise; consumption/GSE is a comuna-level (or, at best, a small number of sub-comuna zones if a socioeconomic-segmentation dataset with finer geography turns out to exist — not yet found) figure overlaid on the isochrone-derived population. `AnalisisCabidaComercial`'s `demografia` field should carry its own precision/granularity label per sub-metric (population vs. spend), not one blanket confidence for "demografía y consumo" as a whole — this is the same "per-field status, not one column" discipline as the cache table, applied to the output payload too.

### 4. Strip center / power center detection has no confirmed automated data source (SCOPE DECISION NEEDED, NOT JUST RESEARCH TIME)

**Confidence: LOW that this is automatable within v1.7's public-data constraint.** `supermercado` (`shop=supermarket`) and `minimarket` (`shop=convenience`) map cleanly onto OSM tags Overpass already proved queryable in this codebase. `strip_center` and `power_center` are Chilean commercial-real-estate categories with **no corresponding OSM primary tag** — verified by inspecting the actual Overpass query already in production (`lib/terrenos-ubicacion.ts`, tag whitelist `mall|supermarket|department_store`; no strip/power-center equivalent exists in OSM's tagging scheme). The only lead is the Cámara Chilena de Centros Comerciales count (277 assets, from `.planning/RESEARCH-MERCADO-CENTROS-COMERCIALES.md`) — a marketing-research figure with no confirmed public address list or API behind it. Options for Requirements to choose between, none currently validated: (a) approximate via Overpass `landuse=retail` polygon clusters + node density (heuristic, will have false positives/negatives), (b) manual/curated seed list maintained like `CADENAS_RUT_CONOCIDOS`, (c) explicitly ship `strip_center`/`power_center` verdicts as "sin datos suficientes para automatizar — verificar manualmente" rather than fabricating a count. Do not let this get resolved implicitly during implementation — it changes what "4 formats" means in the milestone goal.

## Recommended Build Order (risk-first, matches downstream_consumer requirement)

1. **Spike, no UI, no persistence:** geocode ~20 real `locationText` values (item 1 above) + one live INE ArcGIS manzana-level spatial query against a hand-drawn test polygon (item 2) + one live Overpass query for `shop=supermarket|convenience` returning actual POIs, not counts (extends `lib/terrenos-ubicacion.ts`'s query pattern). Answers: is geocoding precise enough, does INE's spatial query work as expected, does Overpass return usable POI density for at least 2 of 4 formats. This is a few hours of throwaway scripts, not a phase — but it must happen before Requirements locks the "4 formats, isócrona-level" scope, because item 4 above may force a scope renegotiation.
2. **Isochrone provider decision + `lib/geocoding.ts`-adjacent client:** based on spike results, pick the isochrone provider (OpenRouteService's free tier — 500/day, 20/min, walking+driving profiles, GeoJSON polygon output — is the leading OSM-family candidate consistent with this codebase's existing Nominatim/Overpass choices; confirm Chile network coverage specifically before committing, same "verify against real requests" discipline as every other data source in `.planning/data-sources.yaml`).
3. **Cache table + service-layer skeleton:** `cabida_comercial_cache` migration, `lib/cabida-comercial-server.ts` with the resolver split (Key Decision 4) wired to real isochrone + demografia + competencia calls behind per-field cache-through, `evaluarCabidaPorFormato()` as a pure function from day one (testable without network).
4. **API route + tab UI:** `app/api/cabida-comercial/analisis/route.ts`, `CabidaComercialTab` (on-demand fetch, following `ResumenTab`'s state-machine shape), wired into the 5th tab slot on `oportunidades/[id]/page.tsx`.
5. **Map + polish + informe integration:** Leaflet isochrone/competitor map (pattern from `zonificacion-mapa.tsx`), then (separate, later) wiring into `oportunidades/[id]/informe/page.tsx`'s print report.

Steps 1-2 are the course-correction checkpoint: if geocoding precision or INE's spatial-query granularity comes back worse than expected, Requirements should revisit "isócrona, no nivel comuna" before any cache table or UI work is built against an assumption that doesn't hold.

## Anti-Patterns to Avoid (grounded in this codebase's own documented pitfalls)

### Anti-Pattern 1: One blanket cache-row status for three independent external calls
Zonificación's own code explicitly documents why a single nullable/status field is wrong when "not yet checked" must stay distinguishable from "checked and failed" (Pitfall 6, cited directly in `lib/zonificacion-server.ts`). Cabida Comercial has three failure domains, not one — replicate the per-field-status shape from Key Decision 2, not a single `status` column.

### Anti-Pattern 2: Eagerly fetching Cabida Comercial data in the oportunidad detail page's `Promise.all`
Would add three live, quota-constrained external calls to every page view of `/oportunidades/[id]`, most of which never open that tab, and would contend with Terrenos' own Overpass usage for the same shared 2-slots/IP quota. Follow `ResumenTab`'s on-demand pattern instead (Key Decision 3).

### Anti-Pattern 3: Treating "demografía y consumo" as one uniformly isochrone-precise dataset
Population (manzana-level, INE ArcGIS) and consumption (comuna-level proxy, at best) have genuinely different achievable precision. Presenting both with the same confidence framing would violate this project's own "never fabricate/hide data" discipline (named explicitly in `.planning/PROJECT.md`'s v1.7 goal) by implying a precision the consumption figure doesn't have.

### Anti-Pattern 4: Silently degrading strip_center/power_center to "0 competitors found" when no data source actually covers them
Overpass returning zero results for a tag that doesn't exist in OSM's schema is not the same as "verified: no strip centers nearby" — it's "this format was never actually checked." Any format without a validated data source must surface as an explicit non-finding (matching item 4's option (c) above), never as a silent zero that reads as a positive signal for cabida.

### Anti-Pattern 5: Coupling the analysis function to `oportunidadId`
Would make the future standalone-by-address milestone a rewrite instead of an additive change — the entire point of Key Decision 4's resolver split. `obtenerAnalisisCabidaComercial()` must never accept an `oportunidadId` or a raw address string as a parameter, only the canonical `UbicacionCabida`.

## Sources

- Direct codebase inspection (see file list under "Based on" above) — HIGH confidence, all integration-surface claims verified against real code, not the milestone brief's assumptions.
- INE Chile Census 2017 manzana-level ArcGIS services — `sig.ine.cl/server/rest/services/Open_Data/Censos/MapServer`, `geoine-ine-chile.opendata.arcgis.com` — found via web search, MEDIUM confidence (not yet verified with a live spatial-intersect HTTP request the way this project's own `data-sources.yaml` discipline requires before committing).
- OpenRouteService isochrone API — free tier 500 isochrones/day, 20/min, `foot-walking`/`driving-car`/`cycling-regular` profiles, GeoJSON polygon output, max 120km range / 1hr driving / 20hr walking — found via web search, MEDIUM confidence (Chile-specific coverage/quality not yet spot-checked).
- OSRM isochrone support — noted as an alternative, self-hostable if OpenRouteService's quota proves insufficient at scale; not evaluated further in this pass.
- `.planning/data-sources.yaml` (existing project research) — HIGH confidence, confirms the INE ArcGIS account family is real and already integrated for a different dataset (building permits), and documents the verification discipline ("verificado en vivo con consultas HTTP reales, no solo documentación") this milestone's Phase 1 spike should replicate.
- `.planning/RESEARCH-MERCADO-CENTROS-COMERCIALES.md` (existing project research, sales-focused) — LOW confidence as a data-integration source (no addresses/API, marketing-verified figures only), used here solely to establish that strip/power-center counts exist publicly but lack the geodata Cabida Comercial needs.
- `.planning/PROJECT.md` (v1.7 milestone definition) — HIGH confidence, primary source for scope/goal/founder decisions quoted above.

---
*Architecture research for: PermisoHub v1.7 Cabida Comercial*
*Researched: 2026-08-02*
