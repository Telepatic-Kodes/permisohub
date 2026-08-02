# Stack Research

**Domain:** Geospatial market-sizing for retail siting ("Cabida Comercial") — isochrone computation + demographic/competition intersection, Chilean market
**Researched:** 2026-08-02
**Confidence:** MEDIUM-HIGH (isochrone tooling and INE geodata endpoints verified against live sources; EPF/CASEN granularity verified against official INE methodology docs; some ArcGIS field-level details for zona/distrito layers not yet queried live — flagged below)

> Este archivo reemplaza el contenido anterior de `STACK.md` (research de dashboards/reportes de Oportunidades). Ese research no se pierde — queda en el historial de git — pero pertenece a un milestone distinto sin solapamiento con este dominio (isochronas + demografía + competencia retail).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **openrouteservice (ORS) public API** | v2 REST (`/v2/isochrones/{profile}`) | Compute walking/driving isochrone polygons from a geocoded address | Free tier (2,500 req/day, no credit card) explicitly permits commercial use at that volume — verified on `openrouteservice.org/terms-of-service`. Routes on OpenStreetMap data, the same data family already backing your Nominatim geocoding, so street-network assumptions stay consistent across geocoding, zoning (ArcGIS) and now isochrones. Returns native GeoJSON polygons (not a fixed-radius circle) for `foot-walking` and `driving-car` profiles — exactly what's asked for. Zero infrastructure to run. |
| **PostGIS extension (Supabase Postgres)** | bundled with Supabase Postgres, enable via `create extension if not exists postgis;` | Store census polygons + retail POIs as native geometry, run `ST_Intersects`/`ST_Area`/`ST_Intersection` server-side | Already included free in every Supabase project (toggle in Dashboard → Database → Extensions, no plan upgrade). Doing the isochrone∩manzana intersection in SQL (spatial GIST index) scales far better than pulling thousands of manzana polygons into a serverless function and intersecting with Turf in Node — critical since Vercel functions are ephemeral and cold-start-sensitive. Confirmed current in Supabase's official docs (`supabase.com/docs/guides/database/extensions/postgis`). |
| **@turf/turf** | 7.3.5 (latest, published within last few months) | Client/edge-side geometry ops: validating the isochrone GeoJSON before sending to Postgres, computing isochrone area, drawing/debugging on the Leaflet map, and as a fallback intersection method for small ad-hoc computations | Standard JS geospatial toolkit, actively maintained (GIScience/Turfjs), TypeScript types included, works both server (API route) and browser (Leaflet overlay). Use it for *display and light validation*; use PostGIS for the *heavy* intersection/aggregation against hundreds of manzana polygons. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `osmium-tool` (system binary, not npm) | latest via `brew install osmium-tool` (or apt) | One-off/periodic ETL: filter Chile's OSM extract down to retail POIs (`shop=supermarket`, `shop=convenience`, `shop=mall`, `shop=department_store`) before loading into Supabase | Use this **instead of** live Overpass calls if you need a full-country refresh and want it scriptable/reproducible in CI (e.g., a monthly GitHub Action). Input: `chile-latest.osm.pbf` from Geofabrik (~330MB). |
| Overpass API (`overpass-api.de` or `overpass.kumi.systems`) | — (HTTP API, no package) | Simpler alternative to osmium: a single Overpass QL query pulling all Chilean `shop=supermarket`/`shop=convenience`/`shop=mall` nodes+ways, run on a schedule (not per-request) | Use for the *first* implementation — one manually-triggered or cron'd batch query is far simpler than standing up an osmium pipeline, and well within the documented fair-use policy (≤10,000 req/day, ≤1GB/day) since you'd run it maybe monthly, not per page-load. **Do not** call Overpass live inside the Cabida Comercial request path — OSMF's own operations policy warns commercial services their access "may be withdrawn at any point" if usage looks abusive; batch-ingest into Supabase instead, same pattern you already use for the SII retail roster. |
| `@supabase/supabase-js` (existing) | already in project | Query PostGIS RPC functions from Next.js API routes | No new dependency — call a Postgres function (`rpc()`) that runs `ST_Intersects` and returns aggregated population/dwellings for a submitted isochrone GeoJSON. |
| Manual `fetch()` to ORS (no wrapper package) | — | Call the ORS isochrones endpoint from a Next.js server-side API route | Prefer a direct `fetch` over the community `openrouteservice-js` npm wrapper — it's a thin, single-endpoint POST with a stable JSON contract; adding a wrapper dependency isn't worth it for TypeScript-strict code where you'll define the response types yourself anyway. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase SQL editor / migration | Define `census_manzana`, `census_zona`, `retail_competitors` tables with `geometry(Polygon, 4326)` / `geometry(Point, 4326)` columns + GIST index | Follow the same migration-file pattern already used for the SII roster and SII-geo schema (per existing project memory: schema changes for geo layers are pending in Supabase — this milestone should land in the same migration set). |
| Geofabrik download (`download.geofabrik.de/south-america/chile.html`) | Source PBF for the retail-POI ETL | Updated continuously (observed "1 hour ago" at time of research); use dated snapshots if you want reproducible refreshes. |

## Installation

```bash
# Core (Node/Next.js side)
npm install @turf/turf

# No SDK needed for ORS — plain fetch() against https://api.openrouteservice.org
# No SDK needed for PostGIS — plain SQL via supabase-js .rpc()

# ETL tooling (not an npm dependency — system binary, used in a one-off/cron script)
brew install osmium-tool   # only if you choose the Geofabrik+osmium ingestion path over Overpass batch queries
```

```sql
-- Supabase migration: enable PostGIS
create extension if not exists postgis;

create table census_manzana (
  id text primary key,           -- MANZENT_I from INE/OCUC layer
  comuna_code text not null,
  total_personas int,
  total_viviendas int,
  geom geometry(Polygon, 4326) not null
);
create index census_manzana_geom_idx on census_manzana using gist (geom);

create table retail_competitors (
  id uuid primary key default gen_random_uuid(),
  source text not null,          -- 'sii' | 'osm'
  category text not null,        -- 'supermercado' | 'minimarket' | 'strip_center' | 'power_center'
  chain_name text,
  geom geometry(Point, 4326) not null
);
create index retail_competitors_geom_idx on retail_competitors using gist (geom);
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| ORS public free API for isochrones | Self-hosted Valhalla (Docker, Chile-only OSM extract) | If you exceed 2,500 isochrone requests/day, need sub-second latency at scale, or want to avoid any external-API dependency. Valhalla has *native* isochrone support (unlike OSRM) and a Chile-only tile set would be a few GB, not the 15-20GB quoted for continent-scale extracts — feasible on a small VM later. Not worth the ops overhead for MVP given Cabida Comercial is an analyst-triggered, low-frequency action (per-opportunity, not per-pageview). |
| ORS | Self-hosted OSRM + isochrone hack | Avoid: OSRM has no native isochrone endpoint; community workarounds (running many point-to-point queries and hulling the results) are slower and less accurate than Valhalla's or ORS's native isochrone algorithm. Only relevant if you already run OSRM for turn-by-turn routing elsewhere. |
| ORS | GraphHopper free tier | Comparable free-tier shape (small daily quota, isochrone support). Reasonable fallback if ORS rate-limits you or changes terms — worth keeping as a documented Plan B, not worth integrating both now. |
| ORS/Valhalla-based isochrone | Fixed-radius circle (`turf.circle` around geocoded point) | Only as a *degraded-mode fallback* if ORS is down or the address geocodes somewhere ORS' road network can't route (rural areas). Never as the primary method — the whole point of this feature is that walkability/drive-time shape ≠ circle, especially in gridded Chilean cities with one-way streets and blocked-off areas. |
| Batch/scheduled Overpass query or Geofabrik+osmium ETL into Supabase | Live Overpass calls per Cabida Comercial request | Never for a commercial SaaS in the hot path — OSMF operations policy explicitly flags commercial services as being cut off first under load; batch ingestion (same pattern as your existing SII roster) avoids any runtime dependency on Overpass uptime. |
| PostGIS `ST_Intersects`/`ST_Area` for isochrone∩manzana aggregation | Turf.js `booleanIntersects`/`intersect` in a Node/serverless function | Use Turf only for small, one-off client-side computations (e.g., highlighting overlap on the Leaflet map) or if you decide *not* to persist census geometries in Postgres and instead fetch them ad hoc from the ArcGIS FeatureServer per request — in that case Turf becomes necessary since there's no DB to push the SQL work to. Recommended path is to persist census geometries in Supabase, so PostGIS should be primary. |
| INE/OCUC manzana-level census (`TOTAL_PERS`, `TOTAL_VIVI`) as the spatial population layer | ENGH/EPF (Encuesta de Presupuestos Familiares) as the spatial layer | **Never use EPF for spatial intersection.** EPF/IX-EPF is only statistically representative at three macro-areas: Gran Santiago, "resto de capitales regionales," and "total capitales regionales" (confirmed in INE's own EPF methodology PDF). It has no comuna-level, let alone zona-censal or manzana-level, representativity — using it as if it had spatial granularity would silently fabricate precision the source data doesn't have. Use EPF only as a *citywide average household-spending multiplier* applied to the population figure the isochrone actually gives you (see Stack Patterns below). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Mapbox Isochrone API / Google Distance Matrix for isochrones | Paid, usage-billed API — violates founder's explicit no-pay-for-third-party-data stance, even though both have "free" starter credits that convert to billing | ORS free tier (OSM-based, no card required at this volume) |
| Any geodemographic data vendor (e.g., commercial "mapa socioeconómico"/GSE-by-zone products sold by Chilean real-estate data firms) | Paid vendor data — explicitly out of scope per founder decision | INE Census 2017 manzana/zona layers (free, official) + CASEN (free, official, comuna-level) as the closest free proxy for socioeconomic gradient |
| Treating EPF/ENGH as if it were geocoded to zona censal or comuna | It isn't — see Alternatives table above. This is the single easiest mistake to make in this milestone and would corrupt every "cabida" number downstream | Use EPF as a single citywide/region-wide multiplier only, applied on top of isochrone-level population |
| Live Overpass API calls inside the user-facing request path | Fair-use policy explicitly deprioritizes and can withdraw access from commercial/heavy users | Scheduled batch ingestion into Supabase (weekly/monthly), same as your existing SII roster ingestion pattern |
| `MANZANA_SIN_INF_C17` layer treated as "zero population" | These are manzanas where INE suppressed the count for statistical-disclosure reasons (very low population), not manzanas that are actually empty — silently reading them as 0 will systematically undercount dense-but-small blocks | Flag these manzanas in the UI as "sin información INE" and fall back to zona-censal aggregate for that patch of the isochrone, rather than defaulting to 0 |

## Stack Patterns by Variant

**If the isochrone falls entirely within Gran Santiago or another regional capital:**
- Population/dwellings: intersect isochrone against `census_manzana` (or `census_zona` if manzana coverage is patchy) via PostGIS.
- Household spending proxy: apply the EPF "Gran Santiago" (or "resto de capitales regionales") average household expenditure figure uniformly — do not attempt to vary it within the isochrone; the source data doesn't support that resolution.
- Income/poverty gradient (optional refinement): pull comuna-level CASEN indicators (poverty rate, average income) for the comuna(s) the isochrone touches, to at least differentiate between comunas even though EPF itself can't.

**If the isochrone spans a smaller/non-capital comuna:**
- Manzana/zona coverage from the ArcGIS census layers should still exist (national coverage), but EPF only differentiates "Gran Santiago" vs "resto de capitales regionales" vs "total capitales" — smaller comunas outside regional capitals may fall outside EPF's sampling frame entirely. Check INE's EPF sampling frame per case; if the comuna isn't a regional capital, use the national/aggregate EPF figure and flag lower confidence in the UI.

**If ORS free-tier quota (2,500/day) becomes a real constraint:**
- Move to self-hosted Valhalla with a Chile-only extract before considering any paid isochrone API — this keeps the zero-third-party-cost stance intact and is realistic given Chile's extract size (~330MB PBF vs. multi-GB continental extracts).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@turf/turf@7.3.5` | Node 18+/20+ (Next.js 16 requirement already satisfied) | ESM-first; Next.js 16 App Router server components/route handlers support ESM imports natively, no config changes needed. |
| Supabase PostGIS extension | Any Supabase Postgres project (Postgres 15/17 depending on project age) | Enabling the extension is non-destructive and reversible; do it via a numbered SQL migration file, not the Dashboard toggle, to keep it reproducible across environments (matches existing project convention of tracked migrations). |
| ORS isochrones GeoJSON output | Leaflet (existing) | ORS returns standard GeoJSON `FeatureCollection` of `Polygon`s — drop directly into a Leaflet `L.geoJSON()` layer, same pattern already used for ArcGIS zoning polygons. |

## Sources

- `openrouteservice.org/services/`, `openrouteservice.org/restrictions/`, `openrouteservice.org/terms-of-service/` — verified isochrone endpoint capabilities (foot/driving profiles, GeoJSON polygon output, max 5 locations/10 intervals/120km/20h-foot), free-tier commercial-use allowance (2,500 req/day) via WebFetch/WebSearch, MEDIUM-HIGH confidence (official docs, current)
- `supabase.com/docs/guides/database/extensions/postgis` — confirmed PostGIS is a free, one-click extension on all Supabase plans, HIGH confidence (official docs)
- `npmjs.com/package/@turf/turf` — confirmed v7.3.5 as latest, actively published, HIGH confidence
- `ine.gob.cl/herramientas/portal-de-mapas/geodatos-abiertos`, `geoine-ine-chile.opendata.arcgis.com` datasets ("Microdatos Censo 2017: Manzana", "Distrito Censal") — confirmed manzana-level population/dwelling data exists as open geodata, HIGH confidence (official INE portal)
- `services3.arcgis.com/cTnMkBRk4HWkUCRo/arcgis/rest/services/SHAPES_CENSO_2017/FeatureServer` — live-queried FeatureServer: confirmed 13 layers spanning REGION→PROVINCIA→COMUNA→DISTRITO→ZONA→MANZANA(3 variants)→ENTIDAD, and confirmed layer 8 (`MANZANA_IND_C17`) exposes `TOTAL_PERS` and `TOTAL_VIVI` fields directly queryable via standard ArcGIS REST — HIGH confidence, directly verified live, and notably this is the **same ArcGIS REST service pattern already integrated for MINVU/OCUC zoning**, meaning no new integration paradigm is needed, only a new FeatureServer URL and field mapping (confirm at implementation time whether this is the same ArcGIS org already whitelisted in the project's existing MINVU/OCUC integration, or a distinct org requiring its own URL/config entry)
- INE, "Manual de Usuario de la Base de Datos del Censo 2017" (`redatam-ine.ine.cl/manuales/Manual-Usuario.pdf`) — confirmed REDATAM full cross-tab data is published at zona-localidad level (not manzana) for detailed sociodemographic variables, and that a separate "Manzana-Entidad" summary table exists with limited fields due to statistical-disclosure suppression for low-population blocks — MEDIUM confidence (search-summarized, not directly fetched PDF; recommend re-verifying exact suppressed-field list before building the UI copy for `MANZANA_SIN_INF_C17`)
- INE, VIII/IX EPF methodology and results documents (`ine.gob.cl/docs/.../metodologia-ix-epf.pdf`, informe-principales-resultados) — confirmed EPF statistical representativity is limited to Gran Santiago / resto de capitales regionales / total capitales regionales, explicitly stating fieldwork occurs at finer geography but published results do not — HIGH confidence, this is the load-bearing finding for the whole milestone's granularity ceiling
- `wiki.openstreetmap.org/wiki/Overpass_API`, `operations.osmfoundation.org/policies/api/` — confirmed Overpass fair-use policy (~10,000 req/day, ~1GB/day) and explicit warning that commercial services may have access withdrawn under load — MEDIUM-HIGH confidence (official OSMF policy page, summarized via search)
- `download.geofabrik.de/south-america/chile.html` — confirmed current Chile OSM extract exists and is actively updated (~330MB PBF), usable for `osmium-tool` batch retail-POI extraction — HIGH confidence
- `pistack.xyz` (2026-04-25) OSRM vs Valhalla vs GraphHopper comparison — confirmed OSRM lacks native isochrone support while Valhalla has first-class isochrone generation, and rough self-hosting memory footprint — MEDIUM confidence (single third-party blog, not official docs; directionally consistent with Valhalla's own published architecture docs but should be re-verified against `valhalla.github.io/valhalla` if self-hosting is actually pursued)

---
*Stack research for: Cabida Comercial (isochrone + demographic/competition intersection) — PermisoHub milestone*
*Researched: 2026-08-02*
