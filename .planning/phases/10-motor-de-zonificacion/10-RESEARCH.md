# Phase 10: Motor de Zonificación - Research

**Researched:** 2026-07-30
**Domain:** Per-comuna ArcGIS FeatureServer registry, Nominatim geocoding, Supabase cache/schema shape for address→PRC zone lookup (Las Condes, Providencia, Vitacura, Ñuñoa)
**Confidence:** HIGH

> No CONTEXT.md exists for this phase (`/gsd:discuss-phase` was not run). No locked user decisions beyond PROJECT.md/STATE.md/REQUIREMENTS.md — this document has no `<user_constraints>` section as a result. It is a **supplement** to the milestone-level research (STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md in `.planning/research/`), which the planner should read first — this document exists to close five specific gaps that research explicitly flagged as unresolved for this phase, all now closed with live verification (this session, 2026-07-30).

## Summary

The milestone research already specifies the stack, architecture, and pitfalls in full (native `fetch()`, no PostGIS, a `lib/zonificacion-comunas.ts` per-comuna registry, a `zonificacion_cache` table, three-state result). This document supplies the concrete data the planner needs to actually write that registry and migration: verified FeatureServer URLs, layer indices, and exact field-name casing for **all four** target comunas (only two were verified in the milestone pass), a live-tested Nominatim geocoding readout for the address style this app will feed it, and a migration shape that mirrors the two existing conventions in `supabase/migrations/`.

**The single most important finding, not previously known:** Providencia and Vitacura *do* have their own dedicated OCUC FeatureServer layers (same organization, same owner, same schema shape as Las Condes — `services9.arcgis.com/kKJR3Qt68ohAWuet`). Ñuñoa does **not** have an OCUC dedicated layer, and the one dedicated Ñuñoa layer that exists (a different, non-OCUC-owned service) failed to return a result for a real, verified Ñuñoa address — it should not be used. Ñuñoa resolves only through the aggregate `PrcCuencaMaipo` layer already known from the milestone pass, and critically, **that aggregate layer returns a correct zone code/name for Ñuñoa but a 100%-empty `UPERM`/`UPROH` (usos permitidos/prohibidos) field for every Ñuñoa zone sampled** (0/200 filled, vs. 200/200 filled for Las Condes, Providencia, and Vitacura in the same layer). This is a genuine data-completeness gap in the free public source, not a coverage gap, not a code bug — the planner must design an explicit UI/status treatment for it (see "Ñuñoa's usos are structurally unavailable" below), not just the three-state `encontrado`/`sin_cobertura`/`error` split already scoped.

**Primary recommendation:** Build the registry with three tiers, not two — `dedicada` (Las Condes, Providencia, Vitacura — full zona+usos), `agregada` (Ñuñoa — zona+nombre only, usos always empty, must be disclosed), and `sin_cobertura` (everything else). Do not silently coalesce Ñuñoa's empty usos into "sin restricciones" (this is exactly Pitfall 3 from PITFALLS.md, now proven to be a real, not just theoretical, risk for one of the four target comunas).

## Verified Per-Comuna Registry (live, 2026-07-30)

| Comuna | `comuna_id` (matches `lib/comunas-chile.ts`) | Tier | FeatureServer URL | Layer | Field casing | `url` field (decree link)? | Live test result |
|---|---|---|---|---|---|---|---|
| Las Condes | `las-condes` | `dedicada` | `https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Las_Condes/FeatureServer` | `0` | lowercase: `region, comuna, sector, zona, nombre, upref, uperm, uproh, url` | **Yes** | Real address (Av. Apoquindo 4700) → zona `UC2/EAa+cm`, uperm/uproh filled, `url` → observatoriourbano.cl decree page |
| Providencia | `providencia` | `dedicada` | `https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Providencia/FeatureServer` | `0` | lowercase: `region, comuna, sector, zona, nombre, upref, uperm, uproh` (no `url`) | No | Real address (Av. Providencia 1208) → zona `UpEC/EC3+AL`, uperm/uproh filled |
| Vitacura | `vitacura` | `dedicada` | `https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Vitacura/FeatureServer` | `0` | lowercase: `region, comuna, sector, zona, nombre, upref, uperm, uproh` (no `url`) | No | Real address (Av. Vitacura 3568) → zona `U-PC/E-Am5`, uperm/uproh filled |
| Ñuñoa | `nunoa` | `agregada` | `https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer` (same aggregate layer from milestone STACK.md — **no dedicated OCUC layer exists**) | `0` | UPPERCASE: `REGION, COMUNA, SECTOR, ZONA, NOMBRE, UPERM, UPROH` | No | Real address (Av. Irarrázaval 3000) → zona `Z-1A` correctly resolved, **but `UPERM`/`UPROH` empty** (confirmed systematic: 0/200 sampled Ñuñoa rows have any usos text, vs. 200/200 for the other 3 comunas in the same layer) |

**All four comunas confirmed owned/hosted by `isidro.puigOCUC`** (Las Condes, Providencia, Vitacura) **or the pre-existing `PrcCuencaMaipo` aggregate** (Ñuñoa) — same organization/pattern the milestone research already validated for Las Condes. This means `lib/zonificacion-comunas.ts` needs exactly **two field-mapping shapes**, not four:

```typescript
// lib/zonificacion-comunas.ts — illustrative shape, not exhaustive
type Tier = 'dedicada' | 'agregada' | 'sin_cobertura'

interface ComunaZonificacionConfig {
  comunaId: string           // matches ComunaChile.id in lib/comunas-chile.ts
  tier: Tier
  featureServerUrl: string
  layerIndex: number
  fieldMap: {
    region: string; comuna: string; sector: string; zona: string
    nombre: string; uperm: string; uproh: string; url?: string
  }
  usosDisponibles: boolean   // false for Ñuñoa — usos fields will be empty, must be disclosed
}

export const ZONIFICACION_COMUNAS: Record<string, ComunaZonificacionConfig> = {
  'las-condes': {
    comunaId: 'las-condes', tier: 'dedicada',
    featureServerUrl: 'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Las_Condes/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh', url: 'url' },
    usosDisponibles: true,
  },
  'providencia': {
    comunaId: 'providencia', tier: 'dedicada',
    featureServerUrl: 'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Providencia/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
  },
  'vitacura': {
    comunaId: 'vitacura', tier: 'dedicada',
    featureServerUrl: 'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Vitacura/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
  },
  'nunoa': {
    comunaId: 'nunoa', tier: 'agregada',
    featureServerUrl: 'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: false,  // verified empty for 100% of sampled Ñuñoa rows — do not present as "sin restricciones"
  },
}
```

Note the query `where=COMUNA='Ñuñoa'` against the aggregate layer must filter server-side by comuna name (the layer covers Las Condes, Providencia, Vitacura and other basin comunas too) — a plain point-in-polygon query without a comuna filter already disambiguates by geometry, so this is informational, not a required query param; only needed if doing bulk/admin queries.

### Rejected candidate: third-party "PRCñuñoa" layer

A separate, non-OCUC-owned FeatureServer exists (`https://services3.arcgis.com/cTnMkBRk4HWkUCRo/arcgis/rest/services/PRCñuñoa/FeatureServer/0`, owner `SERVIU13_ADMIN`, dataset title "PRC Ñuñoa 2019", last edited 2023-09-27). It was tested live against the same verified Ñuñoa address (Av. Irarrázaval 3000, lat/lng from Nominatim) and **returned zero features** — the point falls outside its digitized coverage, or its geometry/SR handling silently disagrees with the input despite explicit `inSR=4326`. Its field schema is also structurally different from the OCUC family (`OBJECTID, Id, REG, COM, LOC, ZONA, NOM, UPERM, UPROH, P_DO, N_DOC, T_DO, OBS`, spatial reference natively `32719`) and it isn't part of the trusted OCUC org used for the other three comunas. **Do not use this layer.** Ñuñoa should resolve via `PrcCuencaMaipo` only, with the `usosDisponibles: false` flag from above.

## Field-Name Casing (Gap 2 — resolved)

Confirmed exactly as the milestone research hypothesized, now verified for all four:

- **`PrcCuencaMaipo` (aggregate, covers Ñuñoa in scope):** UPPERCASE — `REGION, COMUNA, SECTOR, ZONA, NOMBRE, UPERM, UPROH`
- **All three OCUC dedicated layers (Las Condes, Providencia, Vitacura):** lowercase — `region, comuna, sector, zona, nombre, upref, uperm, uproh` (+ `upref`, a field not previously documented in STACK.md — "uso preferente", present on all three OCUC layers but not requested/used by the milestone example query; harmless to ignore or optionally surface as supplementary context)
- **Only Las Condes has the extra `url` field** (decree-page link, `observatoriourbano.cl`) — confirmed absent from both Providencia's and Vitacura's field lists (checked via `FeatureServer/0?f=json` metadata, not just a missing value in one query). The registry's `fieldMap.url` must be `undefined` for those two, and any citation UI must handle the missing case (fall back to a generic MINVU/observatoriourbano link, exactly as ARCHITECTURE.md's Integration Notes already prescribe).

**Conclusion for the adapter:** two field-mapping shapes suffice (uppercase-aggregate vs. lowercase-OCUC), each comuna entry in the registry just points to one. No per-comuna bespoke parser is needed beyond the `fieldMap` indirection already planned.

## Nominatim Geocoding for Chilean Addresses (Gap 3 — resolved)

Live-tested against the public API (`https://nominatim.openstreetmap.org/search`) with the required `User-Agent` header and ~1.2s spacing between requests (compliant with the 1 req/sec usage policy), using 4 realistic Chilean addresses across the target comunas:

| Query | Result | Comuna cross-check field |
|---|---|---|
| "Av. Apoquindo 4700, Las Condes, Santiago, Chile" | Exact house-number match (node, `office`/embajada at that address) — lat/lng precise to the building | `address.suburb = "Las Condes"` ✓ (note: `address.city = "Santiago"`, NOT the comuna) |
| "Av. Providencia 1208, Providencia, Santiago, Chile" | 3 exact house-number matches (different POIs at the same street number — office/shop/notary), all with identical lat/lng to 4 decimal places | `address.suburb = "Providencia"` ✓ AND `address.city = "Providencia"` (this one matches) |
| "Av. Vitacura 3568, Vitacura, Santiago, Chile" | 2 exact house-number matches (building + bank), lat/lng precise | `address.suburb = "Vitacura"` ✓ (`address.city = "Santiago"`, not the comuna) |
| "Av. Irarrázaval 3000, Ñuñoa, Santiago, Chile" | 1 exact house-number match (bank POI) | `address.suburb = "Ñuñoa"` ✓ (`address.city = "Santiago"`, not the comuna) |

**Findings:**
1. **4/4 real addresses geocoded successfully on the first request**, all returning a node/way tagged with the exact requested house number (not street-level interpolation) — small sample (n=4), but consistent with Santiago's dense OSM POI/address coverage in these four affluent, well-mapped comunas. Do not generalize this 100% hit rate to rural or less-mapped comunas without separate testing — this finding is scoped to these 4 target comunas specifically.
2. **Critical implementation detail for Pitfall 1's comuna cross-check:** Nominatim's `address.city` field is **not reliably the comuna** in the Santiago context — it returned `"Santiago"` for 3 of 4 queries even though the actual comuna (Las Condes, Vitacura, Ñuñoa) was correctly present in `address.suburb`. **`lib/geocoding.ts` must read `address.suburb` (with `address.city` as a fallback only), never `address.city` alone**, or the mandatory comuna cross-check from PITFALLS.md Pitfall 1 will silently and systematically fail for exactly the comunas this phase targets.
3. Multiple results are common for a single query (Providencia returned 3, Vitacura returned 2) — all near-identical in lat/lng (same building, different POIs). Taking `results[0]` is safe for this address style since they agree on location; no special disambiguation logic needed for the MVP.
4. Response format matches the standard Nominatim JSON shape exactly (`lat`/`lon` as **strings**, not numbers — must `parseFloat()`), with `address.house_number`, `address.road`, `address.suburb`, `address.postcode` all present and reliable for these addresses.
5. No rate-limit errors or blocking encountered at ~1.2s spacing across 4 sequential requests + a `countrycodes=cl` filter (recommended: reduces false-positive matches outside Chile, low-cost to include).

**Miss/fallback rate:** Could not be empirically characterized beyond "0/4 in this small, favorable sample" — this is not enough data to state a reliable miss rate. **Recommendation for the planner:** budget for the manual comuna/zone fallback UI that ARCHITECTURE.md already specifies as table-stakes (not merely a nice-to-have), since Nominatim gives no SLA and this sample, while clean, is too small to extrapolate a production miss rate from.

## Decree/Publication Date Field (Gap 4 — resolved, quick check)

No layer exposes a **per-feature** decree/publication date field. What exists instead, checked via each layer's `FeatureServer/{layer}?f=json` metadata:

| Layer | `editingInfo.lastEditDate` | `editingInfo.schemaLastEditDate` | Interpretation |
|---|---|---|---|
| `PrcCuencaMaipo` (aggregate) | 2021-06-15 | 2021-06-15 | Last full data reload |
| `PRC_Las_Condes` | 2026-04-30 | 2020-03-09 | Schema unchanged since 2020; **data** last resynced 2026-04-30 |
| `PRC_Providencia` | 2026-04-30 | 2020-03-09 | Same pattern — resynced same day as Las Condes |
| `PRC_Vitacura` | 2026-04-30 | 2020-03-09 | Same pattern — resynced same day as Las Condes |

All three OCUC layers show `lastEditDate` within **minutes of each other on 2026-04-30**, strongly suggesting a scheduled batch re-publish job on OCUC's side (not per-decree editorial updates) — this is a "when OCUC's pipeline last touched the data" timestamp, not "when the PRC modification decree was published." It's still useful as the staleness-disclosure field PITFALLS.md's Pitfall 5 calls for (`fuente_actualizada_el` alongside the cache's own `consultado_el`), but the copy shown to users should say something like "capa municipal sincronizada el [fecha]" rather than implying it reflects the decree's own publication date.

**The only genuine per-zone provenance pointer found is Las Condes' `url` field** (linking to `observatoriourbano.cl`'s decree page for that specific zone) — absent on the other three. This confirms ARCHITECTURE.md's citation fallback design is correct and necessary: real per-zone decree links exist for at most 1 of 4 comunas; the other 3 need the generic MINVU/observatoriourbano fallback link.

## Supabase Migration Shape (Gap 5 — resolved)

Read `20260705_proyectos_sii.sql` and `20260630_plan_reguladores.sql` directly for conventions. Both are short, idempotent, lowercase-snake-case, no `updated_at` trigger boilerplate beyond a plain column, RLS via `ENABLE ROW LEVEL SECURITY` + one `SELECT`-only policy for `authenticated`, no `INSERT`/`UPDATE` policy (writes implicitly require service role, bypassing RLS — this is *not* stated explicitly as a comment in either file, it's just the absence of a write policy).

Recommended migration (consistent with both existing files' exact style — `plan_reguladores`' explicit `CREATE POLICY`/RLS block, `proyectos_sii`'s `add column if not exists` idempotency and comment-header style):

```sql
-- Motor de zonificación: caché compartida de consultas PRC (ArcGIS MINVU/OCUC)
-- + snapshot denormalizado en proyectos. Ver .planning/research/ARCHITECTURE.md
-- (Anti-Pattern 1: cache keyed by ubicación, no por proyecto) y PITFALLS.md
-- (Pitfall 6: estado explícito, nunca solo nullability).

CREATE TABLE IF NOT EXISTS zonificacion_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comuna_id text NOT NULL,               -- matches ComunaChile.id: 'las-condes' | 'providencia' | 'vitacura' | 'nunoa'
  lat_r numeric(9,6) NOT NULL,           -- rounded to 6 decimals (~11cm) — cache key component
  lng_r numeric(9,6) NOT NULL,
  capa text NOT NULL,                    -- 'dedicada' | 'agregada' — never trust these as equal-confidence (Pitfall 3)
  region text,
  sector text,
  zona text,
  nombre_zona text,
  uperm text,                            -- usos permitidos, verbatim from ArcGIS (may be NULL/empty — see agregada tier)
  uproh text,                            -- usos prohibidos, verbatim from ArcGIS (may be NULL/empty)
  usos_disponibles boolean NOT NULL DEFAULT true,  -- false for Ñuñoa-style rows where uperm/uproh are structurally empty
  fuente_url text,                       -- per-zone decree link when available (Las Condes only today); NULL otherwise
  fuente_actualizada_el timestamptz,     -- ArcGIS layer's own editingInfo.lastEditDate — upstream staleness signal, distinct from consultado_el
  raw jsonb NOT NULL,                    -- full feature attributes as returned, forward-compat / debugging
  consultado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zonificacion_cache_geo
  ON zonificacion_cache (comuna_id, lat_r, lng_r);

ALTER TABLE zonificacion_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zonificacion_cache_read" ON zonificacion_cache
  FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE policy for authenticated — writes only via service role
-- (createServiceClient()), matching plan_reguladores' pattern exactly.

-- Snapshot columns on proyectos — fast, join-free reads for UI/via-decision/due-diligence.
-- Idempotent, matching 20260705_proyectos_sii.sql's exact style.
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS zona_status text NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'encontrado' | 'sin_cobertura' | 'error'
  ADD COLUMN IF NOT EXISTS zona_cache_id uuid REFERENCES zonificacion_cache(id),
  ADD COLUMN IF NOT EXISTS zona_sector text,
  ADD COLUMN IF NOT EXISTS zona_nombre text,
  ADD COLUMN IF NOT EXISTS zona_uperm text,
  ADD COLUMN IF NOT EXISTS zona_uproh text,
  ADD COLUMN IF NOT EXISTS zona_usos_disponibles boolean,
  ADD COLUMN IF NOT EXISTS zona_fuente_url text,
  ADD COLUMN IF NOT EXISTS zona_consultada_el timestamptz;

-- Optional but recommended: enforce the explicit 4-state enum at the DB layer,
-- consistent with PITFALLS.md Pitfall 6 ("never a nullable column masquerading
-- as status"). Use a CHECK constraint (lighter than a Postgres ENUM type given
-- the rest of the schema uses plain text columns throughout, e.g. plan_reguladores.fuente):
ALTER TABLE proyectos
  ADD CONSTRAINT zona_status_check
  CHECK (zona_status IN ('pendiente', 'encontrado', 'sin_cobertura', 'error'));
```

**Design notes distinct from what ARCHITECTURE.md already sketched:**
- ARCHITECTURE.md's draft schema used `lat_r double precision`; recommend `numeric(9,6)` instead — deterministic decimal rounding for a cache *key* is safer than `double precision`'s binary floating-point representation, which can produce subtly different values for the "same" rounded coordinate depending on how the rounding is performed application-side (a classic float-equality footgun for a `UNIQUE INDEX` key). `proyectos.lat`/`lng` (unrounded, from `20260705_proyectos_sii.sql`) can stay `double precision` since they're not used as an index key.
- Added `usos_disponibles` (cache) / `zona_usos_disponibles` (proyecto snapshot) — not in ARCHITECTURE.md's original sketch, but required given the Ñuñoa finding above: the three-state `encontrado`/`sin_cobertura`/`error` split is necessary but not sufficient — a `capa: 'agregada'` row can be `encontrado` and still have no usable usos text, and the UI/due-diligence integration needs a machine-readable way to know that, not just an empty-string check (which Pitfall 6 already warns is exactly the anti-pattern to avoid for nullability).
- `zona_status` as a plain `text` + `CHECK` constraint, not a Postgres `ENUM` type — matches the codebase's existing convention (`plan_reguladores.fuente text NOT NULL DEFAULT 'datos_gob_cl'`, no enum types found anywhere in the two reference migrations) and is cheaper to extend later (adding a state is an `ALTER CONSTRAINT`, not an `ALTER TYPE ... ADD VALUE` with its transactional caveats).
- Did **not** add a `NOT NULL` requirement to `zonificacion_cache.uperm`/`uproh` — Ñuñoa rows will have `NULL` or empty-string here by design; the `usos_disponibles` flag is the authoritative signal, not the nullability of these columns (this directly follows PITFALLS.md Pitfall 6's warning against relying on nullability alone, applied to a case the milestone pass hadn't yet discovered).

## Common Pitfalls (supplementing PITFALLS.md)

### Pitfall 8 (NEW — discovered this session): Ñuñoa's "usos" are structurally unavailable, not just occasionally missing

**What goes wrong:** A planner or implementer, seeing that Ñuñoa resolves via `PrcCuencaMaipo` (the "aggregate" tier already anticipated for it) and returns a real, correctly-matched `ZONA`/`NOMBRE`, could reasonably assume it behaves like "Las Condes but slightly less authoritative" — i.e., that it's just a lower-confidence version of the same complete data. It is not: **`UPERM`/`UPROH` are empty for 100% of Ñuñoa records in this layer** (verified: 0 filled out of 200 sampled, out of 424 total Ñuñoa rows), while the exact same layer has them 100% filled for Las Condes, Providencia, and Vitacura. A due-diligence or `via-decision.tsx` compatibility check that only branches on `capa === 'agregada'` vs `'dedicada'` (as ARCHITECTURE.md's Anti-Pattern 3 correctly warns to distinguish) will still get a **zone name with no usos to compare against** for Ñuñoa — different from what "agregada, less fresh" implies for the other basin comunas this layer also covers.

**Why it happens:** Whoever digitized the `PrcCuencaMaipo` layer evidently populated zone geometry/codes for all basin comunas but only transcribed the usos-permitidos/prohibidos text for some of them — an editorial gap in the free public source, invisible until queried and compared across comunas (a spot-check on one comuna wouldn't reveal it; the milestone pass's single example was Las Condes, which is fully filled).

**How to avoid:** Treat `usos_disponibles` (see migration above) as a first-class field, not derivable from `capa` alone. Any UI/AI-context consumer must show "zona: Z-1A (Zona Z-1A)" with an explicit "usos permitidos/prohibidos no disponibles para esta comuna en la fuente pública — consulta la Ordenanza Local o el CIP" message for Ñuñoa, rather than an empty usos section that reads as "nothing prohibited."

**Warning signs:** Any comuna in the `agregada` tier returning empty-string usos across many/most of its rows on a periodic re-check — worth automating as a health-check assertion (mirrors PITFALLS.md Pitfall 3's "100% empty results = coverage gap, not real data" logic, applied to a single field instead of the whole feature set).

**Phase to address:** Schema time (this phase — the `usos_disponibles` column) and UI-render time (Phase 11, per the milestone roadmap, when the architect-facing interface is built) — flag this explicitly for Phase 11's planning so it isn't rediscovered the hard way.

## Sources

### Primary (HIGH confidence — live verification this session, 2026-07-30)
- `curl` against `https://www.arcgis.com/sharing/rest/search` (ArcGIS Online item search API) — discovered `PRC_Providencia` and `PRC_Vitacura` under owner `isidro.puigOCUC`, same org as the milestone-verified `PRC_Las_Condes`; confirmed no OCUC-owned `PRC_Nunoa`/`PRC_Ñuñoa` exists among the 46 `PRC_*` titles under that owner.
- `curl` against each `FeatureServer/0?f=json` endpoint (Las Condes, Providencia, Vitacura, aggregate `PrcCuencaMaipo`, and the rejected third-party `PRCñuñoa`) — confirmed exact field lists, casing, and `editingInfo` timestamps.
- `curl` against each `FeatureServer/0/query` endpoint with real geocoded points — confirmed live point-in-polygon resolution for all 4 target comunas, and the empty-usos finding for Ñuñoa (both a single-point check and a 200-row/424-total sample via `where=COMUNA='Ñuñoa'`).
- `curl` against `https://nominatim.openstreetmap.org/search` with required `User-Agent` header and ToS-compliant request spacing — 4 real Chilean addresses across all 4 target comunas, 4/4 successful house-number-precise matches.
- Direct read of `supabase/migrations/20260705_proyectos_sii.sql`, `supabase/migrations/20260630_plan_reguladores.sql`, `lib/comunas-chile.ts`, `lib/rate-limit.ts`, `lib/sii-lookup.ts` — confirmed exact migration/RLS/slug/pattern conventions to match.

### Secondary / carried forward (from milestone research, not re-verified here)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` — all HIGH-MEDIUM confidence per their own metadata; this document does not repeat their content, only extends it.

## Metadata

**Confidence breakdown:**
- Per-comuna registry (URLs, layers, field casing): HIGH — every entry live-verified against the real endpoint this session, including a real point-in-polygon query per comuna.
- Nominatim geocoding behavior: MEDIUM-HIGH — 4/4 clean hits is a strong signal for these specific comunas, but n=4 is too small to state a production miss rate; treat the manual-fallback UI as required, not optional, per the existing milestone research's own recommendation.
- Migration shape: HIGH — directly derived from the two existing migrations' exact conventions, with two deliberate deviations (both justified above: `numeric` vs `double precision` for the cache key, added `usos_disponibles`).
- Ñuñoa empty-usos finding: HIGH — reproduced across a single point query and a 200-row bulk sample (424 total rows), contrasted against 200/200-filled for the other three comunas in the identical layer.

**Research date:** 2026-07-30
**Valid until:** ArcGIS registry entries (URLs/layers/fields): ~90 days recommended re-check cadence (matches the cache TTL logic in ARCHITECTURE.md/PITFALLS.md — these are undocumented, host-controlled services with no stability contract, per PITFALLS.md Pitfall 2). Nominatim behavior and migration conventions: stable, no re-check needed unless the codebase's own migration patterns change.
