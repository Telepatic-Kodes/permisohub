# Stack Research — v1.4 Zonificación

**Domain:** Zonificación automática por dirección (ArcGIS FeatureServer point-in-polygon lookup + Supabase caching) — PermisoHub v1.4
**Researched:** 2026-07-30
**Confidence:** HIGH

> Supersedes the v1.3 "Army of Skills" research previously in this file for the areas covered below (ArcGIS/zoning lookup, geospatial caching). The v1.3 findings (Copiloto Drawer, AI Analysis API, Background Automations) remain valid for their own milestone but are not part of this scope — see git history if that content is needed for reference.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native `fetch()` (Node 20.9+, bundled with Next.js 16 runtime) | n/a (built-in) | Query ArcGIS FeatureServer REST `/query` endpoint | Verified live against the two production endpoints in scope (`PrcCuencaMaipo` and `PRC_Las_Condes`): both are public, unauthenticated, and return plain JSON (`f=json`) with `attributes` objects for `outFields=REGION,COMUNA,SECTOR,ZONA,NOMBRE,UPERM,UPROH&returnGeometry=false`. No auth token, no CORS concern (server-side call), no binary/geometry parsing needed. This is exactly the shape `lib/sii-lookup.ts` already handles for the SII site — same pattern, same tool. |
| Supabase Postgres (existing) — plain columns, no PostGIS | n/a | Cache ArcGIS query results keyed by rounded lat/lng + comuna | The lookup is a point → attributes query, not a spatial join. The project already stores `lat`/`lng` as `double precision` columns on `proyectos` (see `supabase/migrations/20260705_proyectos_sii.sql`) with zero geospatial operators. Continue that convention — cache the *result attributes*, not geometry. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None beyond the above | — | — | MVP scope (~4-10 comunas, attribute-only queries, `returnGeometry=false`) needs no additional runtime dependency. See "What NOT to Use" below for what was considered and rejected. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Hand-written TS interfaces (in a new `lib/zonificacion.ts` or `lib/zoning-lookup.ts`) | Type the ArcGIS `/query` JSON response | Verified against live response shape (see below) — 3 interfaces (`ArcGISField`, `ArcGISQueryResponse`, `ZonaAttributes`) cover the full contract for this use case. No need for `@esri/arcgis-rest-types` or `@types/arcgis-rest-api`. |
| Zod (already installed, `^4.4.3`) | Runtime-validate the ArcGIS response before trusting it (external, unversioned API) | Same defensive pattern the app should already apply to `sii-lookup` responses — ArcGIS field names/order are not contractually guaranteed to stay stable, so parse-don't-trust at the boundary. |

## Installation

```bash
# No new dependencies required — fetch, URLSearchParams and JSON parsing are
# all native to the Next.js 16 / Node 20.9+ runtime already in use.
```

## Verified Response Shape (live, 2026-07-30)

```
GET https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer/0/query
    ?f=json
    &geometry=-70.5,-33.4
    &geometryType=esriGeometryPoint
    &inSR=4326
    &spatialRel=esriSpatialRelIntersects
    &outFields=REGION,COMUNA,SECTOR,ZONA,NOMBRE,UPERM,UPROH
    &returnGeometry=false
```

Returns:

```json
{
  "objectIdFieldName": "FID",
  "geometryType": "esriGeometryPolygon",
  "spatialReference": { "wkid": 102100, "latestWkid": 3857 },
  "fields": [
    { "name": "ZONA", "type": "esriFieldTypeString", "alias": "ZONA", "length": 25, "...": "..." }
  ],
  "features": [
    {
      "attributes": {
        "REGION": "Metropolitana",
        "COMUNA": "Las Condes",
        "SECTOR": "Las Condes",
        "ZONA": "UEe3/Ee3",
        "NOMBRE": "UEe3/Ee3 Zona Especial 3 Área de Parques",
        "UPERM": "Equipamiento de esparcimiento.",
        "UPROH": "Residencial; equipamiento de comercio, culto, culto, deporte,  educación,  salud, seguridad, servicio y social; actividad productiva; infraestructura; espacio público y áreas verdes."
      }
    }
  ]
}
```

Minimal TS types to add (illustrative, not exhaustive — extend per-layer as needed):

```typescript
interface ArcGISField {
  name: string
  type: string // 'esriFieldTypeString' | 'esriFieldTypeDouble' | ...
  alias: string
}

interface ArcGISQueryResponse<A extends Record<string, unknown> = Record<string, unknown>> {
  objectIdFieldName: string
  geometryType?: string
  fields: ArcGISField[]
  features: Array<{ attributes: A }>
}

interface ZonaAttributes {
  REGION: string
  COMUNA: string
  SECTOR: string | null
  ZONA: string
  NOMBRE: string
  UPERM: string
  UPROH: string
  url?: string // present on newer per-comuna layers (e.g. Las Condes), absent on older ones
}
```

`features.length === 0` is a normal, expected response (point falls outside any published polygon — e.g. área rural, límite comunal impreciso, or comuna not covered by the configured layer). Treat as "zona no determinada", not an error.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Raw `fetch()` to `/query` endpoint | `@esri/arcgis-rest-request` + `@esri/arcgis-rest-feature-service` (latest `4.10.3`, published 2026-06-17 — actively maintained) | Only if the app later needs generic multi-layer discovery, editing features, authenticated portals, or geometry return/reprojection across many arbitrary services. For a fixed, small registry of known public FeatureServer URLs doing read-only attribute queries, the SDK adds ~4 transitive packages (`@esri/arcgis-rest-fetch`, `@esri/arcgis-rest-form-data`, `mitt`, `tslib`) to replace one `fetch()` call the runtime already provides natively. Verified via npm registry: `@esri/arcgis-rest-fetch@4.10.3` (2026) still lists `node-fetch@^3` as a hard dependency — i.e. the "modern" SDK does not rely on Node's native fetch even in its newest release. |
| Cache result attributes as plain columns/JSONB, no PostGIS | Enable the `postgis` extension on Supabase and store a `geography(Point,4326)` column + spatial index | Only if the app starts doing its *own* spatial computation (e.g. "find all projects within 500m of X", polygon storage/editing, multi-point radius search). Here, the point-in-polygon math is already performed server-side by Esri's ArcGIS service — Supabase never touches geometry, only receives an attribute dict back. Adding PostGIS for this would mean maintaining an extension, spatial indexes, and geometry types to solve a problem you don't have. |
| Round lat/lng to a fixed precision as the cache key | Geocode-then-hash the normalized address as the cache key instead of coordinates | If `lib/sii-lookup.ts`'s geocoding is ever swapped for a provider with non-deterministic coordinates for the same address (jitter), or if you want the cache to survive small geocoder revisions — address-based keys are more stable long-term than coordinate rounding. For MVP, coordinate rounding is simpler and reuses the already-resolved `lat`/`lng` from `sii-lookup`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| ArcGIS JS API (`@arcgis/core` / `esri-leaflet`) | This is a full mapping/rendering SDK (map widgets, layers, symbology, ~MBs of bundle) meant for interactive map UIs in the browser. This feature needs one server-side attribute query, not a map component. | Raw `fetch()` server-side, as above. If a visual map is added in a *later* milestone (e.g. showing the parcel + zone boundary), evaluate `@arcgis/core` or a lighter Leaflet+GeoJSON approach then — not now. |
| `@terraformer/arcgis` (Esri JSON ↔ GeoJSON converter, latest `2.2.2`, actively maintained) | Only needed when requesting `returnGeometry=true` and rendering/manipulating the polygon shape. The MVP query uses `returnGeometry=false` and only reads attribute fields (`ZONA`, `UPERM`, `UPROH`) — no geometry ever crosses the wire. | Nothing needed; if geometry display is added later, reconsider then. |
| PostGIS extension | Solves a spatial-computation problem this feature doesn't have — see "Alternatives Considered" above. Adds an extension dependency, migration complexity, and a new data type family (`geography`/`geometry`) to a codebase that has deliberately stayed on plain `double precision` lat/lng columns everywhere else (`proyectos_sii` migration). | `double precision` lat/lng columns + a rounded cache-key column, matching existing convention. |
| A "universal" ArcGIS service discovery/registry system (auto-detecting FeatureServer URLs for all 345 Chilean comunas) | Out of scope for this milestone (~4-10 comunas) and not reliably automatable — comuna PRC layers are published inconsistently (different orgs, different field names, different URL patterns; e.g. `services7...PrcCuencaMaipo` covers a multi-comuna basin while `services9...PRC_Las_Condes` is comuna-specific with an extra `url` field). Building a generic crawler for this is a multi-week research/scraping project on its own — and `lib/scrapers/plan-reguladores.ts` already shows that even *metadata* discovery from datos.gob.cl is non-trivial. | A small, hand-maintained TypeScript config mapping `comuna → { featureServerUrl, layerIndex, fieldMap, hasSourceUrl }` for the target comunas, extended manually as new comunas are added. This also gives an explicit place to note per-layer quirks (e.g. missing `url` field → fall back to a generic MINVU/observatoriourbano citation, matching the `FUENTE_FALLBACK_URL` pattern already used in `lib/normativa-retrieval.ts`). |
| `node-fetch` / `cross-fetch` / `isomorphic-fetch` polyfills | Needed only if using the `@esri/arcgis-rest-*` SDK (which still bundles `node-fetch` internally as of its 2026-06-17 release) or if targeting Node <18. Next.js 16 requires Node ≥20.9, which has native, stable global `fetch`. | Native `fetch()`. |

## Stack Patterns by Variant

**If the feature stays read-only attribute lookups for a fixed small set of comunas (current MVP scope):**
- Use raw `fetch()` + hand-written TS interfaces + Zod validation at the boundary
- Cache in a plain Supabase table keyed by rounded lat/lng (and/or `rol_sii` if available from the existing SII flow)
- Because this is the lowest-dependency path that fully satisfies the requirement, and matches every existing external-lookup pattern in the codebase (`sii-lookup.ts`, `plan-reguladores.ts` scraper)

**If the product later needs to render the actual zone polygon on a map (e.g. showing parcel + zone boundary visually):**
- Reconsider `returnGeometry=true` + `@terraformer/arcgis` (convert Esri JSON geometry → GeoJSON) + a lightweight map lib (Leaflet/MapLibre) for client-side rendering
- Because geometry conversion and rendering are genuinely non-trivial and worth a dedicated library at that point — but this is NOT needed for "determine the zone + usos permitidos/prohibidos and cite the source," which is the actual v1.4 scope

**If the registry of comunas grows beyond ~15-20 and per-comuna FeatureServer quirks multiply:**
- Reconsider moving the comuna→FeatureServer mapping from a TS config file into a Supabase table (admin-editable, no redeploy needed to add a comuna)
- Because a hardcoded TS config is the right MVP choice for 4-10 comunas but becomes an operational bottleneck at scale (every new comuna requires a code change + deploy)

## Integration Notes (this milestone specifically)

- **Reuse `sii-lookup`'s resolved `lat`/`lng`.** `lib/sii-lookup.ts` already returns `SIIData.lat` / `SIIData.lng` from `/api/sii/lookup`. The new zoning API route should accept `lat`/`lng` directly (already resolved) rather than re-geocoding — don't duplicate geocoding logic.
- **Follow the citation-engine convention from `lib/normativa-retrieval.ts`.** That module's pattern — a `verificado: boolean` flag, a specific `url` when available, and a generic `FUENTE_FALLBACK_URL` per source when not — maps directly onto the zoning result: `url` field present (Las Condes-style layers) → cite it directly; absent (older layers like `PrcCuencaMaipo`) → fall back to a generic MINVU/observatoriourbano.cl link, and mark the citation as needing manual verification, consistent with how unverified DDU/OGUC citations are flagged today.
- **New Supabase table, not new columns on `proyectos`.** Unlike `proyectos_sii` (1:1 enrichment of a project), a zoning lookup is really an external-cache table keyed by location, potentially shared across multiple projects at the same address. Model it as its own table (e.g. `zonificacion_cache`) with `lat_r`/`lng_r` (rounded, e.g. `numeric(9,6)` ≈ 11cm precision) + `comuna` as the practical lookup key, plus the raw ArcGIS `attributes` JSON, `fetched_at`, and a `verificado`/`url_fuente` pair mirroring the citation convention above. Then reference this cache from `proyectos` (e.g. `zonificacion_cache_id` FK) rather than duplicating zoning data per project.
- **Cache freshness:** PRC documents change on the order of years (municipal decree amendments), not days. A generous TTL (e.g. re-fetch if `fetched_at` is older than 90-180 days) avoids hammering the public ArcGIS service on every request while still self-healing if a comuna updates its plan. No need for webhook/push invalidation for MVP — this isn't in `lib/scrapers/plan-reguladores.ts`'s CKAN metadata scope either, so there's no existing "PRC changed" signal to hook into yet.
- **Feed into `lib/due-diligence.ts` / `lib/via-tramitacion.ts` as a typed result, not raw ArcGIS JSON.** Those engines should consume a normalized shape (`{ zona, upermitidos: string[], uprohibidos: string[], comuna, citable: ArticuloCitable-like }`), not the raw `attributes` object — keeps the ArcGIS response shape (which varies per comuna layer) isolated to the new zoning lookup module.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Next.js `16.2.9` (Node ≥20.9 required) | Native `fetch`, `URLSearchParams`, `AbortSignal.timeout()` | All used natively in API routes; no polyfill packages needed for this feature. |
| Supabase JS `@supabase/supabase-js@^2.108.2` / `@supabase/ssr@^0.12.0` (existing) | Plain `double precision`, `text`, `jsonb`, `timestamptz` columns | No PostGIS extension enable/migration needed; consistent with existing `proyectos_sii` and `plan_reguladores` migrations, which use plain scalar types throughout. |
| ArcGIS FeatureServer REST `f=json` | Any HTTP client with JSON support | Confirmed unauthenticated and CORS-irrelevant when called server-side (Next.js API route, not client component) — matches how `lib/sii-lookup.ts` already proxies an external Chilean government-adjacent source through an internal `/api/*` route. |

## Sources

- Live verification (this session, 2026-07-30): `curl` against `https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer/0/query` — confirmed unauthenticated JSON response, field schema, and a real feature match (Las Condes, zona `UEe3/Ee3`) for a point-in-polygon query. HIGH confidence (primary source, directly observed).
- https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer-.htm — official ArcGIS REST API query endpoint reference (params, response structure). HIGH confidence.
- https://www.npmjs.com/package/@esri/arcgis-rest-request and https://registry.npmjs.org/@esri/arcgis-rest-request — confirmed latest version `4.10.3`, published 2026-06-17 (actively maintained), dependency tree. HIGH confidence.
- https://registry.npmjs.org/@esri/arcgis-rest-fetch — confirmed this SDK dependency still requires `node-fetch@^3` even in its newest 2026 release, i.e. does not rely on Node's native fetch. HIGH confidence (primary source: npm registry metadata).
- https://registry.npmjs.org/@terraformer/arcgis — confirmed latest `2.2.2`, published 2026-06-29 (actively maintained, only relevant if geometry conversion is later needed). HIGH confidence.
- https://nextjs.org/docs/app/guides/upgrading/version-16 (via WebSearch, MEDIUM confidence, not directly fetched) — Next.js 16 minimum Node.js version 20.9+, confirming native `fetch` availability without polyfills.
- Existing codebase (read directly): `lib/sii-lookup.ts`, `lib/normativa-retrieval.ts`, `supabase/migrations/20260705_proyectos_sii.sql`, `supabase/migrations/20260630_plan_reguladores.sql` — confirmed established project conventions (plain lat/lng columns, no PostGIS, citation fallback-URL pattern, external-lookup-via-internal-API-route pattern). HIGH confidence (ground truth).

---
*Stack research for: Zonificación automática por dirección (PermisoHub v1.4)*
*Researched: 2026-07-30*
