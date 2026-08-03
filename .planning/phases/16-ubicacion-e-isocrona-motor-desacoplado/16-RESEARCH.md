# Phase 16: Ubicación e Isócrona (Motor Desacoplado) - Research

**Researched:** 2026-08-02
**Domain:** Server-side geocoding + isochrone (travel-time polygon) computation, decoupled from any entity, feeding a pure `(lat, lng, formato) → resultado` analysis function
**Confidence:** MEDIUM-HIGH — integration surface with existing code is HIGH (verified by direct inspection); the isochrone provider's exact request/response schema is MEDIUM (cross-verified via the official Python client's source and community examples, but the JS-rendered ORS docs site itself couldn't be scraped live — flagged below with a concrete pre-build verification step)

## User Constraints

No CONTEXT.md exists for this phase — `/gsd:discuss-phase 16` was skipped. There are no locked user decisions beyond `PROJECT.md`/`REQUIREMENTS.md`/`ROADMAP.md`. Everything in this document is Claude's Discretion within those boundaries. The milestone-level research (`.planning/research/{SUMMARY,ARCHITECTURE,STACK,PITFALLS}.md`) already made several load-bearing calls that this document treats as settled, not re-litigated: openrouteservice for isochrones, a new parallel `cabida_comercial_cache` table (not reusing `zonificacion_cache`), the resolver-split service interface, and the explicit `metodo: 'red_vial' | 'circulo_equivalente'` degradation flag.

## Summary

Phase 16 builds the **first slice** of a larger engine: given a `mercado_locales_listings` row (an "Oportunidad"), resolve a `(lat, lng)` point with an honest precision label, compute a walking/driving isochrone via openrouteservice with an honest degradation label when it fails, and expose all of that behind a pure function that never requires `oportunidadId`. Phases 17-19 (demografía, competencia, veredicto+mapa+tab) build on top of this — **this phase does not need census/competitor data**, only location + area-of-influence geometry.

Three of the four building blocks this phase needs already exist in the codebase and should be reused/cloned, not rebuilt:
1. **`lib/geocoding.ts`** (`geocodeDireccion`) — Nominatim geocoding, reusable as-is for the sector-level "aproximada" tier.
2. **`app/api/zonificacion/lookup/route.ts`** — the exact orchestration shape (geocode → round coords → cache read-through → external call → upsert → explicit `force`) is the template for the new isochrone route.
3. **`components/proyecto/zonificacion-card.tsx`** — the exact "Actualizar" button UX pattern (loading state, `POST` to re-trigger, toast, re-fetch) to replicate for Cabida Comercial's own update button.

The one genuinely new integration is the isochrone provider call itself, and two concrete gaps were found that aren't mentioned at the milestone-research level of detail:

- **`obtenerOportunidadPorId()`'s `SELECT` does not include `atributos_raw`** — the column holding `locationText` is never read anywhere in `lib/mercado-locales-server.ts` today. `resolverUbicacionDesdeOportunidad()` cannot piggyback on the existing detail-page fetch; it needs its own minimal, dedicated query.
- **There is no comuna-centroid data anywhere in the codebase** (`lib/comunas-chile.ts`'s `ComunaChile` has no `lat`/`lng`). The "fallback a centroide de comuna" in UBIC-01 has no ready-made source — the practical option is a second, differently-shaped Nominatim call (comuna-only, ideally using Nominatim's structured `city=`/`country=` params rather than the free-text `q=` used for street-level lookups), not a static lookup table.

**Primary recommendation:** Build `lib/cabida-comercial-server.ts` + `lib/cabida-comercial.ts` mirroring `zonificacion-server.ts`/`zonificacion.ts`'s file split exactly; a new `lib/isocrona-server.ts` (or a section of the same file) as the only place that knows ORS's HTTP shape, exactly as `zonificacion/lookup/route.ts` is the only place that knows ArcGIS's shape; a new `app/api/cabida-comercial/analisis/route.ts` accepting `{ oportunidadId }` OR `{ lat, lng, comuna }` and always resolving to the same canonical `UbicacionCabida` before calling the pure analysis function. Register an openrouteservice account now (free, but requires signup — unlike the currently-used keyless Nominatim/Overpass) and run one real isochrone request against a Santiago address before finalizing the response-parsing code, since the exact schema below is MEDIUM confidence, not HIGH.

## Standard Stack

### Core

| Library/Service | Version | Purpose | Why Standard |
|---|---|---|---|
| openrouteservice (ORS) public API | v2 REST, `/v2/isochrones/{profile}` | Real walking/driving isochrone polygons | Free tier, no card required, GeoJSON-native, same OSM data family as the Nominatim geocoding already in use. Already the milestone-level decision (STACK.md) — not re-litigated here. |
| `lib/geocoding.ts` (existing) | n/a | Sector-level geocoding of `locationText` | Zero changes needed — reuse verbatim. |
| Zod (existing dependency) | already in project | Validate ORS's GeoJSON response shape before trusting it | Same discipline as `ArcGISQueryResponseSchema` in `lib/zonificacion.ts` — never trust an external JSON shape without a runtime check, this codebase already treats that as mandatory (Pitfall class already documented for ArcGIS). |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@turf/turf` | not yet installed | `turf.circle()` to build the `circulo_equivalente` fallback polygon when ORS fails | Only for the degraded-mode path — never as the primary method (see Pitfall 2 below). Small enough to inline with a hand-rolled circle-polygon function instead if the team wants to avoid a new dependency for one function; either is fine, `@turf/turf` is the "don't hand-roll" default per milestone STACK.md. |
| Leaflet (existing, via `components/proyecto/zonificacion-mapa.tsx`) | already in project | Render the isochrone/circle polygon on a map | Phase 16's success criteria don't require a map (that's `MAPA-01`, Phase 19) — but if a minimal tab is built now (see Open Question 1), cloning `zonificacion-mapa.tsx`'s dynamic-`import("leaflet")` pattern is the fastest path to a visual sanity-check during development, even if not shipped in the UI yet. |

### Alternatives Considered

Already resolved at the milestone level (STACK.md) — ORS over Mapbox/Google (paid), over self-hosted Valhalla (ops overhead not justified yet), over a circle-only approach (the whole point of UBIC-03). Not re-opened here.

**Installation:**
```bash
npm install @turf/turf   # only if the team wants library-based circle geometry over a ~10-line hand-rolled helper
# No SDK for ORS — plain fetch(), same choice already made for ArcGIS/Nominatim/Overpass in this codebase
```

**New environment variable needed:** `ORS_API_KEY` (or `OPENROUTESERVICE_API_KEY`, matching the existing `RESEND_API_KEY`/`OPENAI_API_KEY`/`TWILIO_AUTH_TOKEN` naming convention in `lib/email.ts`/`lib/ai.ts`/`lib/whatsapp.ts`). Unlike Nominatim and Overpass (both keyless, already used in this codebase), **ORS requires a free account signup to get an API key** — this is new operational surface, not just new code. Follow the existing `lib/ai.ts` pattern: a guard function (`isOrsConfigured()` / `if (!process.env.ORS_API_KEY) return null`) so a missing key degrades gracefully to `circulo_equivalente` rather than crashing — this is not optional, it's the direct mechanism by which UBIC-04's fallback triggers in an environment where the key isn't set yet (e.g., a fresh preview deploy).

## Architecture Patterns

### Recommended File Structure (mirrors zonificación's split exactly)

```
lib/
├── cabida-comercial.ts          # NEW — client-safe types + Zod schemas + fetch helper (mirrors lib/zonificacion.ts)
├── cabida-comercial-server.ts   # NEW — server-only orchestration: resolvers + obtenerAnalisisCabidaComercial()
├── isocrona-server.ts           # NEW — the ONLY module that knows ORS's HTTP shape (mirrors how zonificacion/lookup/route.ts is the only ArcGIS-aware code)
├── geocoding.ts                 # REUSED, unmodified
app/api/cabida-comercial/
└── analisis/route.ts            # NEW — generic-by-location endpoint, accepts oportunidadId OR lat/lng+comuna, same shape as zonificacion/lookup
supabase/migrations/
└── 2026XXXX_cabida_comercial_cache.sql   # NEW
```

### Pattern 1: Cache-through orchestration (clone the shape of `zonificacion/lookup/route.ts`, not its code)

**What:** geocode/resolve → round coords → read cache unless `force=true` → call external service → upsert (not insert) → return, with `cacheHit`/`consultadoEl` always in the response.
**When to use:** For the isochrone call specifically. This is directly verified against `app/api/zonificacion/lookup/route.ts` (read in full for this research) — every step below has a line-numbered precedent in that file:
- `round6()` for cache-key rounding (line 27) — reuse verbatim, do not reinvent.
- The `force` query param skipping the cache read but the upsert still running unconditionally after (line 137, line 238-240 comment: "upsert (not insert) unconditionally — safe for BOTH the normal cache-miss path and the forced-refresh path").
- `Promise.all` for the external call running alongside a best-effort metadata fetch, never sequentially, never blocking the critical path on the best-effort part (line 178).
- Returning a result even when the cache **write** fails, distinguishing "cacheHit: false, no real cache row" — never blocking the user-visible answer on a caching side-effect (line 264-276).

**Example (the pattern to clone, verbatim structure from the actual file):**
```typescript
// Source: app/api/zonificacion/lookup/route.ts (read in full, lines 1-295)
const latR = round6(lat)
const lngR = round6(lng)

if (!force) {
  const { data: cached } = await supabase
    .from('zonificacion_cache')
    .select('*')
    .eq('comuna_id', comunaConfig.comunaId)
    .eq('lat_r', latR)
    .eq('lng_r', lngR)
    .maybeSingle()
  if (cached) { /* return cached, cacheHit: true */ }
}

// cache miss — call external service, then:
await supabase.from('zonificacion_cache').upsert(
  { /* ...fields..., consultado_el: nowIso },
  { onConflict: 'comuna_id,lat_r,lng_r' },
).select('*').single()
```

The isochrone version differs only in: (a) no comuna-registry short-circuit (isochrones aren't gated by a curated comuna allow-list the way zonificación's ArcGIS layers are — any geocodable point works, subject only to ORS's own road-network coverage), and (b) the cache key needs `modo`/`minutos` in addition to `lat_r`/`lng_r` (see Cache schema below).

### Pattern 2: Resolver split — never let the analysis function see `oportunidadId`

**What:** One resolver function per input shape, each producing the same canonical `UbicacionCabida`; exactly one analysis function that only ever accepts that canonical shape.
**When to use:** Always, for CABI-01. This is not a hypothetical pattern — it's the literal shape `zonificacion-server.ts`'s `persistZonificacionParaProyecto()` already uses relative to the generic `zonificacion/lookup` route (a thin, entity-specific adapter calling a route that has zero knowledge of "proyecto" as a concept).

```typescript
// lib/cabida-comercial.ts — client-safe (mirrors lib/zonificacion.ts's ZonaData/ZonaLookupResponse split)
export type UbicacionPrecision = 'aproximada' | 'centroide_comuna'
// Deliberately NOT including 'exacta' in v1.7 — see "Precision tiers" below.
// Union kept open enough that a future standalone-by-address milestone can
// add 'exacta' without a breaking type change for existing consumers.

export interface UbicacionCabida {
  lat: number
  lng: number
  comuna: string
  precision: UbicacionPrecision
  direccionLabel: string   // display string only, not necessarily re-geocodable
  fuenteTexto: string      // the raw input string that WAS geocoded (locationText, titulo, or just comuna) — for UI disclosure, never hidden
}

export type IsocronaMetodo = 'red_vial' | 'circulo_equivalente'

export interface IsocronaResultado {
  metodo: IsocronaMetodo
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon   // real isochrone (red_vial) or turf.circle() output (circulo_equivalente) — SAME shape either way, consumers never branch on this
  modo: 'caminando' | 'auto'
  minutos: number
  proveedor: 'openrouteservice' | null   // null when metodo === 'circulo_equivalente'
  consultadoEl: string
}

// lib/cabida-comercial-server.ts — server-only

export async function resolverUbicacionDesdeOportunidad(oportunidadId: string): Promise<UbicacionCabida | null>
// Dedicated, MINIMAL query — do NOT call obtenerOportunidadPorId() (see Finding below).
// select('id, comuna, atributos_raw').eq('id', oportunidadId).maybeSingle()
// 1. Try geocodeDireccion(locationText ?? titulo, comuna) → precision: 'aproximada' on ok:true
// 2. On ok:false, fall back to a comuna-only resolution → precision: 'centroide_comuna'
// 3. Returns null (never throws) if BOTH fail — same "explicit non-success" contract as geocodeDireccion() itself

export async function resolverUbicacionDesdeDireccion(direccion: string, comuna: string): Promise<UbicacionCabida | null>
// Exists now, called by nothing in v1.7's UI except tests — the real seam for
// the future standalone milestone (CABI-03, deferred). Ends in the same
// geocodeDireccion() call as the resolver above; the duplication IS the point.

export async function obtenerIsocrona(
  ubicacion: Pick<UbicacionCabida, 'lat' | 'lng'>,
  opts: { modo: 'caminando' | 'auto'; minutos: number; force?: boolean },
): Promise<IsocronaResultado>
// NEVER throws, NEVER returns a bare polygon — metodo is mandatory on every path.
```

### Pattern 3: "Actualizar" button — clone `zonificacion-card.tsx`, not a silent refresh

**What:** Read-only `useEffect` fetch on mount + a separate `POST`-triggered manual refresh with its own loading state and a toast on success/failure, no polling, no background refresh.
**When to use:** UBIC-05 explicitly says "mismo patrón que zonificación" — `components/proyecto/zonificacion-card.tsx` (read in full) is that exact pattern:
```typescript
// Source: components/proyecto/zonificacion-card.tsx, lines 84-100
async function handleActualizar() {
  setActualizando(true)
  try {
    const res = await fetch(`/api/proyectos/${proyecto.id}/zonificacion`, { method: "POST" })
    const data = await res.json()
    if (!res.ok || data.error) { toast.error(data.error ?? "..."); return }
    await refetchProyecto()
    toast.success("Zonificación actualizada")
  } catch { toast.error("...") }
  finally { setActualizando(false) }
}
```
If Phase 16 ships a UI surface at all (see Open Question 1), this is the literal component shape to clone for the isochrone/location card, including the `RefreshCw`/`Loader2` icon swap and disabled-while-loading button.

### Anti-Patterns to Avoid

- **Reusing `obtenerOportunidadPorId()` for location resolution.** It does far more than needed (bandas, historial, bandas comparison) and — critically — its `SELECT` doesn't even include `atributos_raw`, so it can't answer the question as-is without modification. Write a dedicated 3-column query instead.
- **Treating `mercado_locales_listings.comuna` + `locationText` geocoding "failure" vs "coarse success" as something Nominatim's response can reliably distinguish.** `locationText` is already sector-level text (e.g. "Providencia, Metropolitana"), never a street address — there is no `house_number`/`road` to check for "fine" vs "coarse" in the vast majority of cases. Trigger the comuna-centroid fallback on `geo.ok === false` (an explicit failure), not on an inferred fuzziness heuristic. This matches the codebase's existing discipline of explicit states over inferred ones (see `zona_status`'s 4-state enum, never a nullable proxy).
- **Building a comuna-centroid lookup table from scratch or scraping one.** No such data exists in this codebase (`ComunaChile` has no coordinates) and building/maintaining one is out of proportion to what's needed. A second Nominatim call scoped to the comuna alone (ideally via structured `city=`/`country=` params) reuses the exact same infrastructure/throttle/User-Agent discipline already in `lib/geocoding.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Real walking/driving area of influence | A custom "buffer + street-density heuristic" | openrouteservice `/v2/isochrones/{profile}` | Already the milestone decision; up to 80% documented area error for circle-only approximations (PITFALLS.md, Pitfall 2) — not worth re-deriving in-house. |
| GeoJSON polygon rendering on a map | A hand-rolled canvas/SVG polygon renderer | Leaflet `L.geoJSON()`, exact pattern already in `zonificacion-mapa.tsx` | Already proven in this codebase for ArcGIS-derived polygons; ORS returns native GeoJSON so the same `L.geoJSON()` call works unmodified. |
| Rounding coordinates for a stable cache key | Ad-hoc `toFixed()` calls scattered across new files | `round6()` from `zonificacion/lookup/route.ts` (or a shared extraction of it) | Already correct (rounds to ~11cm), already proven, avoids a second slightly-different rounding function producing cache-key drift between the two subsystems. |

**Key insight:** Every piece of infrastructure this phase needs except the ORS HTTP call itself already exists in this codebase in a directly analogous form. The engineering risk here is in the NEW 20% (isochrone schema, comuna-centroid fallback, the missing `atributos_raw` select), not in re-deriving the other 80%.

## Common Pitfalls

### Pitfall 1: Silent isochrone→circle fallback without a visible degradation flag (inherited from PITFALLS.md Pitfall 2, restated for this phase specifically)
**What goes wrong:** A generic `catch` around the ORS call returns *some* polygon (e.g. `turf.circle()`) with no accompanying signal, and every downstream consumer (this phase's own UI, and later demografía/competencia/veredicto in Phases 17-19) treats it with the same visual confidence as a real network-aware isochrone. Documented literature cites up to 80% area error for circle buffers vs. real road-network isochrones.
**Why it happens:** The precedent for doing this correctly already exists in this exact codebase (`OverpassUnavailableError` in `lib/terrenos-ubicacion.ts` distinguishes "service down" from "real empty result") but it's easy for new isochrone code to not inherit that discipline if written independently.
**How to avoid:** `IsocronaResultado.metodo` is non-optional in the type from the very first commit that defines it — there is no code path that can construct an `IsocronaResultado` without deciding this field. The UI must render an amber "radio aproximado — no se pudo calcular la ruta real" notice using the same visual treatment as zonificación's own staleness warning (`zonificacion-card.tsx` lines 230-250, `mostrarAdvertenciaFuenteDesactualizada`).
**Warning signs:** Any `catch` block around the ORS call that returns a geometry without setting `metodo`; any use of `turf.circle()` without the caller being forced to also set `metodo: 'circulo_equivalente'`.
**Phase to address:** This phase — the type must exist before Phase 17/18 build consumers on top of it; retrofitting it later means touching every downstream file.

### Pitfall 2: Axis-order bugs (lng,lat vs lat,lng) — this codebase has been bitten by this exact bug class before
**What goes wrong:** ORS's `locations` field (like GeoJSON, and like Overpass is NOT — Overpass in this codebase uses `lat,lng` in its Around filter) expects `[lng, lat]` order. `app/api/zonificacion/lookup/route.ts` line 167 has an explicit comment flagging this as "the single highest-risk line in this file" for the ArcGIS integration (`geometry=lng,lat` + explicit `inSR`/`outSR`), because ArcGIS silently reinterprets swapped axes as different-projection coordinates rather than erroring.
**Why it happens:** Every geo API in this codebase's stack uses a DIFFERENT axis order/parameter shape: Nominatim returns `lat`/`lon` as separate string fields; Overpass's `around:radius,lat,lng` filter is lat-first; ArcGIS `geometry` param is `lng,lat` (x,y); ORS's `locations` array is also `[lng, lat]`. There is no single convention to rely on muscle memory for.
**How to avoid:** Write the ORS request-body construction in exactly one place (`lib/isocrona-server.ts`), with an inline comment stating the expected order and why, exactly as line 167-173 of `zonificacion/lookup/route.ts` already does for ArcGIS. Add a unit test asserting `locations: [[lng, lat]]` (not `[[lat, lng]]`) for a known Santiago coordinate.
**Warning signs:** An isochrone polygon that renders somewhere in the ocean or a different hemisphere on first live test — the classic symptom of a swapped-axis bug.
**Phase to address:** This phase, first ORS integration commit.

### Pitfall 3: Assuming the ORS free-tier quota is the same 2,500/day figure quoted for the general API
**What goes wrong:** STACK.md (milestone-level research) cites "2,500 req/day" from ORS's general terms-of-service page. ARCHITECTURE.md (same research pass) separately cites "500 isochrones/day, 20/min" specifically for the isochrones service. These are not necessarily the same number — ORS has historically applied **per-service** quotas (isochrones being more compute-expensive than geocoding/directions typically get a lower daily cap than the headline "2,500" figure most blog posts quote). Building rate-limiting/caching logic against the wrong number risks either being needlessly conservative or, worse, hitting 429s in production without a plan.
**How to avoid:** Register the free ORS account early in this phase's build (needed anyway for the API key) and read the actual quota from the ORS dashboard for the specific isochrones service, not from a blog post. Until then, design the caching layer to be conservative (cache-through by default, `force` opt-in only) so the actual number matters less.
**Phase to address:** This phase, before writing any burst-testing or load-related code.

## Code Examples

### Existing geocoding call (reuse verbatim)
```typescript
// Source: lib/geocoding.ts, lines 65-119 (read in full)
export async function geocodeDireccion(direccion: string, comuna: string): Promise<GeocodeResult>
// Builds query = `${direccion}, ${comuna}, Santiago, Chile` — the hardcoded
// ", Santiago, Chile" suffix is SAFE for this phase: mercado_locales_listings
// is confirmed RM-only in scope (lib/scrapers/mercado-locales-common.ts:
// "MERCADO_LOCALES_COMUNA_SLUGS ... comunas donde PROPRA·BI verificó
// cobertura ... Portalinmobiliario" — all `-metropolitana` URL slugs).
// Do not generalize this call to non-RM comunas without revisiting that
// hardcoded suffix first.
```

### ORS isochrones request (MEDIUM confidence — verify live before finalizing types; see Open Questions)
```typescript
// Cross-verified from: openrouteservice-py's isochrones.py (official GitHub
// source, HIGH confidence on param names) + community curl examples
// (MEDIUM confidence on header format) — the JS-rendered ORS docs site
// (openrouteservice.org/dev/#/api-docs) could not be scraped live by this
// research pass (returns only "Dashboard | ORS" to a non-JS fetch).

const res = await fetch(`https://api.openrouteservice.org/v2/isochrones/${profile}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/geo+json',
    'Authorization': process.env.ORS_API_KEY!,  // raw key, NOT "Bearer <key>"
  },
  body: JSON.stringify({
    locations: [[lng, lat]],           // [lng, lat] order — see Pitfall 2
    range: [minutos * 60],             // SECONDS for range_type: 'time'
    range_type: 'time',
  }),
})
// profile ∈ 'foot-walking' | 'driving-car' (also available: 'driving-hgv',
// 'foot-hiking', 'cycling-*' — not needed for this phase's 'caminando'/'auto' toggle)
// Response: GeoJSON FeatureCollection, features are Polygon/MultiPolygon with
// properties including group_index, value (the range value used), center —
// exact property set NOT independently re-verified this pass, validate with
// a live Zod-parsed request before trusting field names in production code.
```

### Cache table (clone `zonificacion_cache`'s shape, adapted for the extra dimensions)
```sql
-- Source pattern: supabase/migrations/20260730_zonificacion.sql (read in full)
CREATE TABLE IF NOT EXISTS cabida_comercial_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_r numeric(9,6) NOT NULL,
  lng_r numeric(9,6) NOT NULL,
  modo text NOT NULL,               -- 'caminando' | 'auto'
  minutos integer NOT NULL,

  isocrona_status text NOT NULL DEFAULT 'pendiente',  -- explicit enum, same discipline as proyectos.zona_status
  isocrona_metodo text,             -- 'red_vial' | 'circulo_equivalente' — NULL only while status='pendiente'
  isocrona_geometria jsonb,
  isocrona_proveedor text,          -- 'openrouteservice' | NULL

  consultado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cabida_comercial_cache_geo
  ON cabida_comercial_cache (lat_r, lng_r, modo, minutos);

ALTER TABLE cabida_comercial_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabida_comercial_cache_read" ON cabida_comercial_cache
  FOR SELECT TO authenticated USING (true);
-- writes only via service role (createServiceClient()), matching zonificacion_cache exactly
```
Note: this is a **narrower** table than the one sketched in the milestone-level `ARCHITECTURE.md` (which bundled `demografia_*`/`competencia_*` columns into the same row for the whole milestone). Since Phase 16 only owns location+isochrone, either (a) create this narrower table now and add `demografia_*`/`competencia_*` columns via an additive migration in Phase 17/18, or (b) create the full wide table now if the planner prefers doing the schema once. Both are consistent with this codebase's additive-migration convention (`20260730_zonificacion.sql` → `20260730_zonificacion_v2.sql` added a `geometria` column later without touching existing rows) — **this is a genuine open call for the planner, not a settled research finding**, see Open Questions.

### Precision tiers — what UBIC-02 actually has to display
```typescript
// Only two tiers are honestly achievable in v1.7, not three:
// - 'aproximada'      → geocoded from locationText/titulo (sector-level text,
//                        e.g. "Providencia, Metropolitana" — itself already
//                        coarser than a street address; see ARCHITECTURE.md's
//                        finding that mercado_locales_listings has no
//                        direccion column at all)
// - 'centroide_comuna' → locationText geocoding failed outright; fell back
//                        to a comuna-only Nominatim resolution
// Never label either as 'exacta' — UBIC-02's literal wording. The type
// should stay open (not a closed 2-value union hardcoded everywhere) so a
// future standalone-by-address milestone (CABI-03) can add 'exacta' for a
// user-typed street address without a breaking change to every consumer.
```

## Open Questions

1. **Does Phase 16 need to ship a visible UI (the actual 5th tab), or is it backend-only?**
   - What we know: Phase 16's own Success Criteria 1-3 say things like "el sistema **muestra** su ubicación resuelta... **en la UI**" and "el área de influencia **se muestra**..." — language that implies a visible surface. But `CABI-02` ("El tab 'Cabida Comercial' aparece como una 5ª pestaña...") is explicitly scoped to **Phase 19**, not Phase 16, per `ROADMAP.md`'s requirement-to-phase mapping.
   - What's unclear: Whether Phase 16 should add the actual `<TabsTrigger>`/`<TabsContent>` pair to `oportunidades/[id]/page.tsx` now (showing only location+isochrone, with demografía/competencia/veredicto sections arriving in later phases), or whether Phase 16's "shows in the UI" success criteria are satisfiable via a narrower harness (e.g., a dev-only page, or a card component built but not yet wired into the tab list).
   - Recommendation: Ship the actual 5th tab now, populated with only what Phase 16 has (location card + isochrone card, cloned from `zonificacion-card.tsx`'s shape), and let Phase 19's `CABI-02` be a **verification** that the tab still exists and follows the on-demand pattern once demografía/competencia/veredicto sections are added — not a first-time creation. This avoids a scenario where Phase 16 is "done" per its own success criteria but literally invisible to a user testing the app, which would fail the spirit of `gsd-verifier`'s goal-backward check even if it satisfies to-the-letter task completion. The planner should confirm this reading explicitly rather than let it default silently either way.

2. **Narrow cache table (location+isochrone only) now, or the full wide table (+ demografía/competencia columns) from milestone ARCHITECTURE.md upfront?**
   - What we know: Both are consistent with the codebase's additive-migration convention. The narrower table is more honestly scoped to what Phase 16 actually delivers; the wide table avoids a second migration touching the same table in Phase 17/18.
   - Recommendation: Narrow table now (shown above) — Phase 17/18 can add columns additively, exactly as `20260730_zonificacion_v2.sql` did to `zonificacion_cache`. Don't pre-build columns for data this phase doesn't populate.

3. **Exact ORS response field names (`group_index`, `value`, `center`, `area`, `reachfactor`?) — not independently verified live this pass.**
   - What we know: The endpoint URL, HTTP method, header format (`Authorization: <raw key>`, not `Bearer`), and request-body param names (`locations`, `range`, `range_type`, `profile` in the URL path) are cross-verified from the official `openrouteservice-py` client source (HIGH confidence for param names) plus community curl examples (MEDIUM confidence for headers). The response FeatureCollection's exact property set was not independently confirmed against a live request in this research pass — the JS-rendered `openrouteservice.org/dev/#/api-docs` page could not be scraped by WebFetch (returns only `"Dashboard | ORS"`).
   - What's unclear: Whether property names like `group_index`/`value`/`center` (standard ORS isochrone response fields per general knowledge/training data) are current for the exact API version this phase will call.
   - Recommendation: First implementation task in this phase should be a throwaway script making one real POST request against a known Santiago coordinate, logging the raw response, and writing the Zod schema from that real payload — exactly the discipline `ArcGISQueryResponseSchema` already applies to ArcGIS in this codebase. Do not hand-write the Zod schema from memory/docs alone.

4. **Comuna-centroid fallback — new dedicated Nominatim helper, or reuse `geocodeDireccion` with an empty address?**
   - What we know: No comuna-coordinate data exists anywhere in this codebase. `geocodeDireccion(direccion, comuna)` always builds `"${direccion}, ${comuna}, Santiago, Chile"` — passing an empty string for `direccion` produces a query starting with a stray comma, which may or may not resolve correctly in Nominatim's free-text search (untested).
   - Recommendation: Write a small, separate function (e.g. `geocodeComunaCentroide(comuna: string)`) using Nominatim's **structured** query parameters (`city=`, `country=Chile`) instead of the free-text `q=` parameter `geocodeDireccion` uses — structured admin-area queries are more reliable for resolving to a boundary's representative point than a free-text search built for street-address-shaped input. This is a small, targeted addition to `lib/geocoding.ts`, not a new subsystem — but it is new code, not pure reuse, contrary to what a shallow read of "reuse `lib/geocoding.ts` unmodified" might suggest.

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `lib/geocoding.ts` (read in full) — Nominatim geocoding contract, throttle discipline, hardcoded RM-scoped query suffix
- `app/api/zonificacion/lookup/route.ts` (read in full, 295 lines) — cache-through orchestration pattern, axis-order discipline, upsert-not-insert pattern
- `lib/zonificacion-server.ts`, `lib/zonificacion.ts`, `lib/zonificacion-geo.ts` (read in full) — resolver-split precedent, client/server type-file split, Esri→GeoJSON conversion pattern
- `supabase/migrations/20260730_zonificacion.sql`, `20260730_zonificacion_v2.sql` (read in full) — cache table schema, additive-migration convention, explicit-status-enum discipline
- `supabase/migrations/20260802_mercado_locales_listings.sql` (read in full) — confirms no `direccion`/`lat`/`lng` columns, `atributos_raw jsonb` shape
- `lib/mercado-locales-server.ts` (`obtenerOportunidadPorId`, `OportunidadDetalle`, `evaluarOportunidad` — read relevant sections) — confirmed `atributos_raw` is never selected/read anywhere in this file today
- `lib/scrapers/portalinmobiliario.ts` (grepped) — confirms `atributos_raw.locationText` is populated from the scraper's `poly-component__location` match
- `lib/scrapers/mercado-locales-common.ts` (read relevant section) — confirms `mercado_locales_listings` scope is RM-only (`-metropolitana` URL slugs), which is what makes `geocodeDireccion`'s hardcoded "Santiago, Chile" suffix safe to reuse unmodified
- `lib/comunas-chile.ts` (`ComunaChile` interface, read) — confirms no lat/lng/centroid data exists anywhere for comunas
- `lib/terrenos-ubicacion.ts` (read in full) — `OverpassUnavailableError` pattern, throttle-via-module-level-queue pattern, User-Agent gotcha (default UA gets 406'd by Overpass's WAF)
- `components/proyecto/zonificacion-card.tsx`, `components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx` (read in full) — "Actualizar" button UX pattern and on-demand-fetch tab pattern
- `components/proyecto/zonificacion-mapa.tsx` (read in full) — Leaflet dynamic-import + `L.geoJSON()` rendering pattern
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` (read in full) — current 4-tab structure, `Promise.all` eager-fetch boundary
- `lib/email.ts`, `lib/ai.ts`, `lib/whatsapp.ts`, `lib/rate-limit.ts` (grepped) — `process.env.*_API_KEY` naming convention and graceful-degradation-on-missing-key pattern
- `mcp__supabase__list_extensions` (live query against the actual Supabase project) — confirmed `postgis` (3.3.7) and `pgrouting` (3.4.1) are both available but **not currently installed** (`installed_version: null`) — not required for Phase 16 itself (no spatial intersection needed until Phase 17), documented here so the planner doesn't assume it's already enabled if a future phase needs it.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (grepped relevant sections) — confirmed exact requirement-to-phase mapping, in particular that `CABI-02` (tab appearance) belongs to Phase 19, not Phase 16, despite Phase 16's own success-criteria wording implying a visible UI (Open Question 1)

### Secondary (MEDIUM confidence)
- `.planning/research/{SUMMARY,ARCHITECTURE,STACK,PITFALLS}.md` — milestone-level research, read in full, treated as the starting point per task instructions; ORS quota figures cross-checked internally and found to conflict between two of these files (2,500/day general vs. 500/day isochrones-specific) — flagged as Pitfall 3 above, not resolved by this pass
- `openrouteservice-py`'s `isochrones.py` source on GitHub (fetched live) — HIGH confidence for parameter names (`locations`, `range`, `range_type`, `profile`, `interval`, `units`, `intersections`, `location_type`, `smoothing`, `attributes`), since it's the official client's actual request-building code
- Community curl example surfaced via web search (`api.openrouteservice.org/v2/isochrones/driving-car`, `Authorization` header with raw key, `Content-Type`/`Accept` headers) — MEDIUM confidence, aggregated from search rather than fetched from the primary docs page directly
- ORS free-tier quota figures — MEDIUM confidence, conflicting numbers found across two secondary sources (see Pitfall 3); recommend live verification via the ORS dashboard once an account is registered

### Attempted but not verifiable this pass
- `openrouteservice.org/dev/#/api-docs` — the official interactive API docs page — is a JS-rendered SPA; WebFetch retrieved only `"Dashboard | ORS"` on three separate attempts against different anchors on the same page. The exact isochrone response property names (`group_index`, `value`, `center`, etc.) are standard/well-known ORS conventions from general knowledge but were **not** re-confirmed against this specific live page in this research pass — see Open Question 3 for the concrete mitigation (throwaway live-request script as the first implementation task).

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH — ORS choice is a settled milestone decision; the exact request/response schema needs one live verification request before the Zod schema is written (Open Question 3)
- Architecture: HIGH — every integration point is verified against real, currently-in-production code in this exact repository, not inferred from documentation or analogy
- Pitfalls: HIGH — Pitfall 1 (silent degradation) and Pitfall 2 (axis order) are both grounded in bugs/disciplines this exact codebase has already documented and fixed once for a structurally identical integration (ArcGIS)

**Research date:** 2026-08-02
**Valid until:** ~30 days for the architecture/pattern findings (stable, code-verified); re-verify the ORS API schema and quota figures specifically if implementation starts more than ~2 weeks after this research, since those two items are the ones marked MEDIUM confidence pending a live request.
