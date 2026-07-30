# Architecture Research — v1.4 Zonificación Automática

**Milestone:** Zonificación automática por dirección (MINVU/OCUC ArcGIS)
**Researched:** 2026-07-30
**Based on:** Direct codebase inspection (`lib/`, `app/`, `components/proyecto/`, `supabase/migrations/`)
**Confidence:** HIGH for integration points and file paths (verified against actual source). MEDIUM for the geocoding prerequisite and per-comuna ArcGIS field consistency (flagged explicitly below — these need hands-on verification during build, not just research).

## Executive Summary

PermisoHub already has three precedents that this feature must follow, not reinvent:

1. **Live external lookup + flat denormalization onto `proyectos`** (`lib/sii-lookup.ts` + `app/api/sii/lookup/route.ts` + `20260705_proyectos_sii.sql`). No cache table — SII is scraped fresh every time.
2. **Shared, service-role-written, publicly-readable reference table** (`plan_reguladores`, `20260630_plan_reguladores.sql`). RLS: `SELECT` open to `authenticated`, writes only via `createServiceClient()`.
3. **Fire-and-forget enrichment via `after()`** in `app/api/proyectos/route.ts` POST, using `createServiceClient()` to bypass RLS from a background task with no user session.

Zonificación should combine #2 and #3, **not** #1: unlike SII (cheap, always fresh, one HTML page per rol), ArcGIS point-in-polygon queries are worth caching because (a) the same parcel/building gets queried repeatedly across re-visits and re-edits, (b) PRC zone boundaries change rarely (only on PRC amendment), and (c) it protects the free public MINVU/OCUC endpoints from being hammered.

The single biggest gap this research surfaces: **the app has no geocoder today.** `proyectos.lat`/`lng` and `SIIData.lat`/`lng` exist as columns/types, but nothing in the codebase currently populates them — `app/api/sii/lookup/route.ts` scrapes only tabular fields (dirección, superficies, avalúo, destino), never coordinates. ArcGIS point-in-polygon queries require `lat/lng` as input. This means **`lib/zonificacion.ts` has a hard prerequisite that doesn't exist yet**: an address → lat/lng step. This must be built and sequenced first, or the whole feature has no coordinates to query with.

The second key finding: the validated ArcGIS response shape (`REGION, COMUNA, SECTOR, ZONA, NOMBRE, UPERM, UPROH, url?`) is a **use-compatibility signal** (permitted/prohibited uses), not a numeric envelope (no explicit FOS/altura/constructibilidad fields were validated). That means the natural integration is feeding `lib/via-tramitacion.ts`'s destino-change question and `lib/due-diligence.ts`'s cross-referencing — not prefilling `cuadro-calculo.tsx`'s numeric max fields. Treat numeric-limit prefill as an unvalidated stretch goal, not a v1.4 assumption.

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Proyecto creation (existing)                      │
│  app/api/proyectos/route.ts  POST                                        │
│    → insert proyectos row                                                │
│    → after() fire-and-forget: SII fallback scrape (existing)             │
│    → after() fire-and-forget: ZONIFICACIÓN lookup (NEW, this milestone)  │
└───────────────────────────────┬────────────────────────────────────────-┘
                                 │ direccion + municipio
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    lib/zonificacion.ts  (NEW — client helper)            │
│                    app/api/zonificacion/lookup/route.ts  (NEW — server)  │
│                                                                            │
│  1. Resolve comuna → registry entry (lib/zonificacion-comunas.ts, NEW)   │
│     tier: 'dedicada' | 'agregada' | 'sin_cobertura'                      │
│  2. If sin_cobertura → return ok:false, no ArcGIS call                   │
│  3. Geocode direccion+comuna → lat/lng (lib/geocoding.ts, NEW)           │
│     — hard prerequisite, does not exist in codebase today                │
│  4. Read-through cache: zonificacion_cache (NEW table) by                │
│     (comuna, lat_r, lng_r)                                               │
│  5. Cache miss → query ArcGIS FeatureServer (point-in-polygon)           │
│     → normalize {sector, zona, nombre, uperm, uproh, url}                │
│     → upsert zonificacion_cache via createServiceClient()                │
│  6. Denormalize onto proyectos.zona_* columns (service client)           │
└───────────────────────────────┬────────────────────────────────────────-┘
                                 │
                 ┌───────────────┴────────────────┐
                 ▼                                 ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│ components/proyecto/           │   │ Consumers (citable input)          │
│ zonificacion-card.tsx  (NEW)   │   │                                     │
│  — on-demand refresh button    │   │ via-decision.tsx (MODIFY)          │
│  — GET /api/proyectos/[id]/    │   │  → 3rd prefill effect: zone use    │
│    zonificacion (NEW)          │   │    compatibility → cambiaDestino   │
│  — cobertura badge (sin_cob.,  │   │                                     │
│    agregada, dedicada)         │   │ lib/due-diligence.ts (MODIFY)      │
│  Placed in proyectos/[id]      │   │  → ProyectoContexto.zona field     │
│  page.tsx, Resumen tab, right  │   │  → injected into synthesis prompt  │
│  column, below PredioMap       │   │    as verified ground truth        │
└───────────────────────────────┘   └─────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | New or Modify |
|-----------|-----------------|----------------|
| `supabase/migrations/2026XXXX_zonificacion.sql` | `zonificacion_cache` table + `proyectos.zona_*` columns | NEW |
| `lib/zonificacion-comunas.ts` | Per-comuna ArcGIS endpoint registry (tier, FeatureServer URL, field mapping) | NEW |
| `lib/geocoding.ts` | Address (+ comuna) → lat/lng via free geocoder (Nominatim) | NEW |
| `lib/zonificacion.ts` | Client-safe types + `lookupZonificacion()` fetch helper (mirrors `lib/sii-lookup.ts`) | NEW |
| `app/api/zonificacion/lookup/route.ts` | Server orchestration: registry → geocode → cache read-through → ArcGIS query → cache write → denormalize | NEW |
| `app/api/proyectos/[id]/zonificacion/route.ts` | GET current cached zona for a proyecto; POST triggers/re-triggers lookup for that proyecto | NEW |
| `app/api/proyectos/route.ts` (POST) | Add zonificación to the existing `after()` fire-and-forget block | MODIFY |
| `components/proyecto/zonificacion-card.tsx` | UI card: zone name/sector, use-compatibility check vs `destino_sii`, coverage-tier badge, manual refresh button, source link | NEW |
| `app/(dashboard)/proyectos/[id]/page.tsx` | Render `ZonificacionCard` in Resumen tab, right column, below `PredioMap` | MODIFY |
| `components/proyecto/via-decision.tsx` | Add 3rd `useEffect` prefill: fetch zona, if destino incompatible with UPERM/UPROH → prefill `cambiaDestino: true` | MODIFY |
| `lib/via-tramitacion.ts` | **No change.** `recomendarVia()` stays pure/deterministic; it only ever sees `RespuestasVia` booleans | UNCHANGED |
| `lib/due-diligence.ts` | Add optional `zona` field to `ProyectoContexto`; include in synthesis prompt's "## Proyecto" block | MODIFY |
| `app/api/ai/due-diligence/route.ts` | Fetch `proyecto.zona_*` and pass into `ProyectoContexto` | MODIFY |
| `lib/normativa-retrieval.ts` | **No change — do not extend `FuenteNormativa`.** Zonificación is live per-parcel GIS data, not curated static legal text; it doesn't fit the `verificado`/`getArticuloById` model | UNCHANGED |

## Recommended Project Structure

```
lib/
├── zonificacion.ts              # NEW — client helper + types (ZonaData, ZonaLookupResponse)
├── zonificacion-comunas.ts      # NEW — ArcGIS endpoint registry, separate from comunas-chile.ts
├── geocoding.ts                 # NEW — address → lat/lng (Nominatim), reusable by SII flow too
├── via-tramitacion.ts           # unchanged
├── due-diligence.ts             # MODIFY — ProyectoContexto.zona
├── sii-lookup.ts                # unchanged (pattern reference only)
├── comunas-chile.ts             # unchanged (DOM tramitación tiers — different concern)
├── municipios-stats.ts          # unchanged (pattern reference: small curated registry alongside comunas-chile.ts)
└── normativa-retrieval.ts       # unchanged

app/api/
├── zonificacion/
│   └── lookup/route.ts          # NEW — core orchestration (auth + rate limit + geocode + cache + ArcGIS)
├── proyectos/
│   ├── route.ts                 # MODIFY — after() block gains zonificación trigger
│   └── [id]/
│       └── zonificacion/route.ts # NEW — GET cached / POST refresh, scoped to one proyecto
└── ai/due-diligence/route.ts    # MODIFY — passes zona into ProyectoContexto

components/proyecto/
├── zonificacion-card.tsx        # NEW
├── via-decision.tsx             # MODIFY — 3rd prefill effect
├── predio-map.tsx               # unchanged (dumb presentational — do not add fetching here)
└── due-diligence-report.tsx     # OPTIONAL MODIFY — display zona line if round-tripped into DueDiligenceResult.proyecto

supabase/migrations/
└── 2026XXXX_zonificacion.sql    # NEW — must exist before any code touches these tables/columns
```

### Structure Rationale

- **`lib/zonificacion-comunas.ts` as its own file, not an extension of `comunas-chile.ts`:** `comunas-chile.ts` is a 345-row national list with one shallow field (`domStatus`) per comuna — broad and thin. ArcGIS zoning coverage today is only 4 comunas with heterogeneous, deep metadata (FeatureServer URL, layer index, per-service field-name quirks). This is exactly the shape `lib/municipios-stats.ts` already solves for DOM speed/observation stats: a **small, deep, curated registry that sits alongside the big shallow list**, keyed by the same comuna slugs for cross-reference but living in its own file so the 345-row list doesn't grow a pile of `undefined` per-comuna ArcGIS metadata for comunas that will never have it.
- **`lib/geocoding.ts` as its own module, not folded into `zonificacion.ts`:** geocoding is a general capability (SII enrichment could eventually use it too to finally populate `SIIData.lat/lng`, which the type declares but the current scraper never fills). Keeping it separate avoids coupling the ArcGIS-specific module to a concern the rest of the app will likely want independently.
- **Cache table (`zonificacion_cache`) separate from `proyectos.zona_*` columns:** mirrors the existing split between `plan_reguladores` (shared reference data) and `proyectos.rol_sii`/`destino_sii`/etc. (per-project denormalized snapshot). The cache is geography-keyed and reusable across every project at the same parcel; the `proyectos` columns are a fast, join-free snapshot for UI reads and for `via-decision.tsx`/`due-diligence.ts` to consume without an extra table join.

## Architectural Patterns

### Pattern 1: Read-through shared geo-cache, service-role write / authenticated read

**What:** A table that any authenticated user can `SELECT`, but only `createServiceClient()` (bypassing RLS) can `INSERT`/`UPDATE`. Exactly the `plan_reguladores` policy shape.

**When to use:** Public reference data (not tenant-owned) fetched from a slow/rate-limited external source, worth caching because the underlying fact changes rarely.

**Trade-offs:** Simpler than per-user caching, but a single bad write (bad geocode, e.g.) can pollute the cache for every tenant. Mitigate with a `consultado_el` TTL (recommend 60-90 days — PRC amendments are infrequent but do happen) and a manual refresh path that always re-queries ArcGIS regardless of cache age.

**Example (migration, mirroring `20260630_plan_reguladores.sql`):**
```sql
create table if not exists zonificacion_cache (
  id uuid primary key default gen_random_uuid(),
  comuna_id text not null,               -- matches ComunaChile.id slug
  lat_r double precision not null,       -- rounded to 5 decimals (~1.1m)
  lng_r double precision not null,
  region text,
  sector text,
  zona text,
  nombre_zona text,
  uperm jsonb,                            -- usos permitidos, raw from ArcGIS
  uproh jsonb,                            -- usos prohibidos, raw from ArcGIS
  capa text not null,                     -- 'dedicada' | 'agregada'
  fuente_url text,
  raw jsonb,                              -- full feature attributes, forward-compat
  consultado_el timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_zonificacion_cache_geo
  on zonificacion_cache (comuna_id, lat_r, lng_r);

alter table zonificacion_cache enable row level security;

create policy "zonificacion_cache_read" on zonificacion_cache
  for select to authenticated using (true);
-- No insert/update policy for authenticated — writes only via service role.
```

### Pattern 2: Fire-and-forget enrichment via `after()` + on-demand refresh button

**What:** Best-effort background enrichment at creation time (never blocks the response, silent failure), PLUS a manual retry/refresh surfaced in the UI for when the automatic pass had no address yet, geocoding failed, or the user wants a fresh consult.

**When to use:** Exactly what the existing SII fallback in `app/api/proyectos/route.ts` already does. Zonificación should extend the same `after()` block rather than add a second background mechanism.

**Trade-offs:** Fire-and-forget means the user's first page load may show no zone data even though a request was made — the on-demand button is not optional, it's the safety net.

**Example (extending the existing `after()` block in `app/api/proyectos/route.ts`):**
```typescript
if (proyecto?.id && body.direccion && body.municipio) {
  const proyectoId = proyecto.id
  after(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
      const res = await fetch(
        `${baseUrl}/api/zonificacion/lookup?direccion=${encodeURIComponent(body.direccion)}&comuna=${encodeURIComponent(body.municipio)}`,
      )
      if (!res.ok) return
      const json = await res.json() as { ok: boolean; data?: ZonaData }
      if (!json.ok || !json.data) return
      const supabase = createServiceClient()
      await supabase.from('proyectos').update({
        zona_sector: json.data.sector,
        zona_nombre: json.data.nombreZona,
        zona_uperm: json.data.uperm,
        zona_uproh: json.data.uproh,
        zona_fuente_url: json.data.fuenteUrl,
        zona_consultada_el: new Date().toISOString(),
      }).eq('id', proyectoId)
    } catch {
      // Fire-and-forget — silent failure intentional, same as SII fallback
    }
  })
}
```

### Pattern 3: Deterministic decision engine stays pure; UI owns AI/heuristic prefill

**What:** `lib/via-tramitacion.ts`'s `recomendarVia()` is explicitly documented as rule-based/auditable ("NO usa IA"). Zone-derived signals (use compatibility) are a *heuristic*, not a legal rule — they should never be baked into `recomendarVia()` itself.

**When to use:** Any time a new signal (zone compatibility, cuadro-calculo limits, persisted guided-flow answers) wants to influence a `RespuestasVia` toggle. Follow the existing `via-decision.tsx` pattern: a `useEffect` that fetches supporting data and calls `setR()`, never a change to the pure function.

**Trade-offs:** Slight duplication of "what sets `cambiaDestino`" logic across effects, but keeps `recomendarVia()` a single auditable, unit-testable function with zero I/O — worth preserving.

**Example (3rd prefill effect added to `via-decision.tsx`, alongside the existing two):**
```typescript
useEffect(() => {
  let cancelled = false
  void (async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/zonificacion`)
      if (!res.ok) return
      const json = await res.json() as { data: ZonaData | null }
      if (cancelled || !json.data) return
      const compatible = esUsoCompatible(destinoSii, json.data.uperm, json.data.uproh)
      if (compatible === false) {
        setR((prev) => ({ ...prev, cambiaDestino: true }))
      }
    } catch {
      // silencioso: el prellenado es opcional, mismo patrón que excedePRC
    }
  })()
  return () => { cancelled = true }
}, [proyectoId, destinoSii])
```

## Data Flow

### Creation-time flow (automatic)

```
POST /api/proyectos (direccion, municipio)
  → insert proyectos row
  → after(): app/api/zonificacion/lookup?direccion=...&comuna=...
      → lib/zonificacion-comunas.ts: resolve tier for comuna
          sin_cobertura → return ok:false (no ArcGIS call, no geocode call)
          dedicada/agregada → continue
      → lib/geocoding.ts: direccion + comuna → lat, lng
      → zonificacion_cache lookup by (comuna_id, round(lat,5), round(lng,5))
          hit  → return cached row
          miss → query ArcGIS FeatureServer (point-in-polygon)
               → normalize → upsert zonificacion_cache (service client)
      → update proyectos.zona_* (service client)
```

### On-demand flow (manual refresh)

```
ZonificacionCard "Actualizar" button
  → POST /api/proyectos/{id}/zonificacion
      → reads proyecto.direccion/municipio (or accepts corrected address)
      → calls the SAME app/api/zonificacion/lookup orchestration
      → always bypasses cache TTL check (force-refresh) OR respects a shorter TTL — decide at build time
      → updates proyectos.zona_*
  → ZonificacionCard refetches GET /api/proyectos/{id}/zonificacion
```

### Consumption flow (citable input)

```
via-decision.tsx mount
  → GET /api/proyectos/{id}/zonificacion
  → esUsoCompatible(destino_sii, uperm, uproh)
  → prefill cambiaDestino if incompatible (UI-level only, lib/via-tramitacion.ts untouched)

app/api/ai/due-diligence/route.ts
  → reads proyecto.zona_sector / zona_nombre / zona_uperm / zona_uproh
  → builds ProyectoContexto { ..., zona: { sector, nombreZona, upermResumen, uprohResumen } }
  → synthesizeDueDiligence() includes zona in the "## Proyecto" prompt block
  → AI cross-references zone-permitted uses against document facts when producing hallazgos
    (same non-invention discipline as REGLAS_CITACION: zona facts are injected as given,
     never invented by the model)
```

## Anti-Patterns

### Anti-Pattern 1: Caching `zonificacion_cache` keyed only by `proyecto_id`

**What people do:** Model the cache 1:1 with the project, like `via_tramitacion` (`unique(proyecto_id)`).
**Why it's wrong:** Zone data is a property of a *location*, not a project. Two projects at the same address (a renovation revisited a year later, two architects in the same firm) would each pay a fresh ArcGIS round-trip and geocode call for identical, unchanging data. It also makes it impossible to pre-warm/backfill the cache independent of project creation.
**Do this instead:** Key the cache by `(comuna_id, lat_r, lng_r)` as a shared table (Pattern 1 above); keep a thin per-project snapshot on `proyectos.zona_*` for fast reads, exactly like the SII columns already do for cadastral data.

### Anti-Pattern 2: Extending `FuenteNormativa` to include zoning as a citable "source"

**What people do:** Add `'ARCGIS'` or `'ZONIFICACION'` to the `FuenteNormativa` union in `lib/normativa-retrieval.ts` so zone data can flow through `getArticuloById`/`urlDeCitable`/`REGLAS_CITACION` like OGUC/LGUC/DDU.
**Why it's wrong:** `normativa-retrieval.ts`'s entire model — `verificado`, keyword scoring against a curated static array, `flagUnverifiedCita` — is built for *legal text that either is or isn't in the curated base*. Zonificación is live, per-parcel, external GIS data with no "curated base" to verify against; forcing it through that model would either be meaningless (verificado is always trivially true/false in a different sense) or require weakening the abstraction that due-diligence and via-tramitacion currently rely on for their citation discipline.
**Do this instead:** Treat zone data as its own first-class fact with its own display (source URL + "consultado el" timestamp + coverage-tier badge), passed as plain structured context (e.g., `Hallazgo.refFuente` free text, or `ProyectoContexto.zona`) rather than shoehorned into the normativa citation pipeline.

### Anti-Pattern 3: Silently trusting the 'agregada' (basin-wide) ArcGIS layer as equal-confidence to 'dedicada'

**What people do:** Treat any successful ArcGIS response the same regardless of which layer answered it.
**Why it's wrong:** The project context is explicit that some comunas only have an older basin-wide aggregate layer. Presenting that with the same confidence as a comuna's dedicated, fresher layer violates the app's established "no inventar, no ocultar incertidumbre" discipline (seen in `cuadro-calculo.tsx`'s disclaimer and `flagUnverifiedCita`).
**Do this instead:** Always propagate `capa: 'dedicada' | 'agregada'` from `lib/zonificacion-comunas.ts` through the cache row and into `ZonificacionCard`'s badge, with a visible disclaimer on `agregada` results ("capa agregada, puede no reflejar la versión más reciente del PRC").

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| MINVU/OCUC ArcGIS FeatureServer (per comuna) | Unauthenticated REST `query` endpoint, point-in-polygon (`geometry=lng,lat&geometryType=esriGeometryPoint&f=json`) | Validated externally for Las Condes, Providencia, Vitacura, Ñuñoa this session. Field names/casing may differ slightly per service instance — verify per-comuna during `lib/zonificacion-comunas.ts` build, don't assume a single shared parser handles all four without a field-mapping layer. |
| Geocoder (Nominatim/OpenStreetMap recommended — free, no key) | `lib/geocoding.ts`, one request per uncached address, respects 1 req/sec ToS + required `User-Agent` | **Does not exist in the codebase today.** This is a new external dependency, not a reuse of an existing one — confirm this is acceptable before building (no paid geocoder per project constraints, so Nominatim is the pragmatic default; verify accuracy for Chilean addresses during build, it's known to be weaker outside dense urban cores). |
| datos.gob.cl CKAN (`lib/scrapers/plan-reguladores.ts`) | Existing, unrelated to this feature except as a UI fallback link when `sin_cobertura` | When a comuna has no ArcGIS coverage, `ZonificacionCard` can link out to that comuna's `plan_reguladores` rows (PRC document metadata) as a "consult manually" fallback — a low-cost cross-feature win. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/api/zonificacion/lookup/route.ts` ↔ `zonificacion_cache` | Direct Supabase client, service role for writes | Same boundary shape as `lib/scrapers/plan-reguladores.ts` ↔ `plan_reguladores`. |
| `app/api/proyectos/route.ts` (`after()`) ↔ `app/api/zonificacion/lookup` | HTTP self-call via `NEXT_PUBLIC_APP_URL`, fire-and-forget | Matches the existing SII fallback exactly — reuses the same base-URL env var and try/catch-swallow pattern. |
| `components/proyecto/via-decision.tsx` ↔ zone data | `GET /api/proyectos/{id}/zonificacion`, UI-level `useEffect` prefill only | `lib/via-tramitacion.ts` never imports or knows about zonificación — one-way data flow into the UI's `RespuestasVia` state, not into the decision function. |
| `app/api/ai/due-diligence/route.ts` ↔ `lib/due-diligence.ts` | Typed `ProyectoContexto` parameter, additive optional field | Route composes context (fetches `proyecto.zona_*`); `lib/due-diligence.ts` stays a pure/testable function that just renders whatever context it's given, same as it does today for `nombre`/`direccion`/`rol_sii`. |
| `lib/zonificacion-comunas.ts` ↔ `lib/comunas-chile.ts` | Shared `comuna.id` slug as join key, no code dependency | Two independent registries kept in sync only by convention (slug naming), same relationship `municipios-stats.ts` already has with `comunas-chile.ts` — verify slug reuse (`las-condes`, `providencia`, `vitacura`, `nunoa`) matches exactly. |

## Build Order

Dependencies are strict where noted; parallelizable steps are marked.

1. **`supabase/migrations/2026XXXX_zonificacion.sql`** — `zonificacion_cache` table + `proyectos.zona_*` columns. Blocking: nothing downstream can persist without this.
2. **`lib/zonificacion-comunas.ts`** — registry (tier + FeatureServer URL + field mapping per comuna). Pure data, no dependency on (1); can be built in parallel with it.
3. **`lib/geocoding.ts`** — address → lat/lng. No dependency on (1) or (2); can be built in parallel. **Flag this early** — it's a new capability, budget real verification time (Nominatim accuracy for Chilean addresses, rate-limit handling, User-Agent ToS compliance).
4. **`lib/zonificacion.ts` + `app/api/zonificacion/lookup/route.ts`** — depends on (1), (2), (3) all existing. This is the first point where the feature actually produces zone data end-to-end. Test this route directly (curl/Postman) against the 4 known-covered comunas before building anything on top of it.
5. **Wire into `app/api/proyectos/route.ts`'s `after()` block** — depends on (4). Low-risk additive change, mirrors existing SII fallback almost line-for-line.
6. **`app/api/proyectos/[id]/zonificacion/route.ts` + `components/proyecto/zonificacion-card.tsx`** — depends on (4); (5) not strictly required but makes manual testing more realistic (real projects will already have zone data to display). Placed in `proyectos/[id]/page.tsx` Resumen tab.
7. **`components/proyecto/via-decision.tsx` prefill effect** — depends on (6) being visually verified correct (you want to *see* the zone/compatibility data render correctly before trusting it to silently flip a decision toggle). Could technically be built in parallel with (6) since it only needs the API from (4), but sequence after for practical QA.
8. **`lib/due-diligence.ts` (`ProyectoContexto.zona`) + `app/api/ai/due-diligence/route.ts`** — depends on (4)/(5) (needs `proyecto.zona_*` populated to have something to pass). Lowest-risk, purely additive to an existing typed interface; do last since it's the least urgent consumer (informational context for the AI, not a decision-critical prefill).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Current (4 comunas covered, low project volume) | Exactly as designed above — no changes needed. |
| More comunas gain ArcGIS coverage over time | Pure data addition to `lib/zonificacion-comunas.ts`; no code changes to the lookup route. This is the primary reason the registry is separated from the parsing logic. |
| High project-creation volume in covered comunas | Cache hit rate should climb quickly since parcels repeat; if Nominatim's 1 req/sec becomes a bottleneck, consider caching geocode results independently (a `geocode_cache` table, or fold lat/lng into `zonificacion_cache` directly keyed by normalized address string as a secondary lookup path). |

## Sources

- Direct inspection: `lib/sii-lookup.ts`, `app/api/sii/lookup/route.ts`, `app/api/proyectos/route.ts`, `lib/via-tramitacion.ts`, `lib/due-diligence.ts`, `lib/normativa-retrieval.ts`, `lib/comunas-chile.ts`, `lib/municipios-stats.ts`, `lib/scrapers/plan-reguladores.ts`, `lib/cuadros-calculo.ts`, `lib/supabase/service.ts`, `components/proyecto/via-decision.tsx`, `components/proyecto/via-guiada.tsx`, `components/proyecto/sii-enricher.tsx`, `components/proyecto/predio-map.tsx`, `components/cadenas/dom-digital-badge.tsx`, `app/(dashboard)/proyectos/[id]/page.tsx`, `supabase/migrations/20260705_proyectos_sii.sql`, `supabase/migrations/20260705_via_tramitacion.sql`, `supabase/migrations/20260630_plan_reguladores.sql`.
- ArcGIS REST FeatureServer response shape (`REGION, COMUNA, SECTOR, ZONA, NOMBRE, UPERM, UPROH, url?`) — validated externally per milestone context, treated as ground truth, not re-verified in this research pass.
- Geocoding gap (no geocoder in codebase) — verified by absence: `grep`-searched `lib/`, `app/` for `geocod|nominatim|maps.googleapis|GOOGLE_MAPS|arcgis`, no matches; `.env.local.example` has no geocoding-related keys.

---
*Architecture research for: PermisoHub v1.4 — Zonificación automática*
*Researched: 2026-07-30*
