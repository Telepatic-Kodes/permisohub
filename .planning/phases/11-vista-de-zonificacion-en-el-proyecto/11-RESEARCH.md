# Phase 11: Vista de Zonificación en el Proyecto - Research

**Researched:** 2026-07-30
**Domain:** Client-side map rendering (point-in-polygon confirmation), proyecto-scoped refresh/manual-fallback API design, AI-assisted free-text use-compatibility classification, citation/disclaimer UI for non-curated GIS data
**Confidence:** HIGH for architecture/integration points (verified against actual shipped Phase 10 code + pre-existing milestone research). MEDIUM for the map-library recommendation (no library exists in the codebase yet — first-time addition) and for COMPAT-01's exact classification approach (a genuine design decision, not something with one obviously-correct answer).

> No CONTEXT.md exists for this phase (`/gsd:discuss-phase` was not run) — no locked user decisions. This document has no `<user_constraints>` section as a result; all findings below are recommendations for the planner to lock in.

## Summary

Phase 10 shipped exactly what its own scope promised: attribute-only zoning lookup (`returnGeometry=false`), a shared geo-cache, and fire-and-forget auto-persistence onto `proyectos.zona_*` on project create/update. Phase 11's job is almost entirely **new UI + two small, deliberate modifications to already-shipped Phase 10 code** (not a rebuild) — the milestone-level `ARCHITECTURE.md` (written before Phase 10 existed) already anticipated most of this phase's shape correctly: a `ZonificacionCard` in the `proyectos/[id]` Resumen tab, a proyecto-scoped `GET/POST /api/proyectos/[id]/zonificacion` route, and a map library as "the one new frontend dependency." Three things that research got right and this phase should follow. Two things Phase 10 didn't anticipate, discovered this session, must be fixed here: (1) `returnGeometry=false` means **no polygon exists anywhere to satisfy ZONE-02** — the ArcGIS lookup route needs a small, additive change (`returnGeometry=true&outSR=4326` + a new nullable `geometria` column), not a rewrite; (2) the `Proyecto` TypeScript type in `types/index.ts` was **never updated** with the `zona_*` fields Phase 10 added to the DB — the raw JSON already round-trips them (the route does `select('*')`), so this is a one-line-per-field type fix, not a new fetch.

**Primary recommendation:** Use Leaflet (not MapLibre GL) + OpenStreetMap raster tiles for ZONE-02, add `returnGeometry=true`/`outSR=4326`/a new `geometria jsonb` column to the existing (shipped) lookup route and cache table, build one new proyecto-scoped route (`GET/POST /api/proyectos/[id]/zonificacion`) that both serves the polygon-bearing detail view and handles the explicit "Actualizar" refresh (force-bypassing the cache read, upserting the same cache row), and use an AI (GPT-4o via the existing `lib/ai.ts`) call for COMPAT-01's three-state classification against the verbatim `uperm`/`uproh` text, short-circuiting to "No especificado" without an AI call whenever `usosDisponibles` is false (Ñuñoa) or both fields are empty.

## Standard Stack

### Core (already in this codebase — reused, not new)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `zod` | ^4.4.3 | Validate the new route's request/response shapes | Already the boundary-validation convention (`ArcGISQueryResponseSchema` in `lib/zonificacion.ts`) |
| `openai` | ^6.44.0 | GPT-4o call for COMPAT-01 classification | `lib/ai.ts`'s `aiComplete()` with `json: true` is the exact reusable pattern (used by due-diligence, predictor, oguc-chat) |
| shadcn/ui (`Card`, `Badge`, `Select`, `Dialog`, `Button`, `Input`) | current in repo | Card layout, comuna/zona fallback selects, disclaimer banner | Existing convention throughout `components/proyecto/` |
| `components/arch/estado.tsx` (`EstadoNormativo`) | in-repo | Render COMPAT-01's 3-state pill | Already the ONE saturated-color status pattern in this codebase (`cumple`/`observa`/`rechaza`/`neutro`) — reuse, don't invent a second status-pill component |

### New (this phase's only genuinely new dependency)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `leaflet` | `1.9.4` (current npm) | Render point marker + zone polygon on a basemap for ZONE-02 | Verified via `npm view`. Small (~40KB gzip core), works with plain `<img>` raster tiles → the CSP fallout is a single `img-src` addition (see Pitfalls), no worker-src/connect-src changes needed. Matches this codebase's demonstrated bias toward the lowest-dependency option that fully satisfies the requirement (see `.planning/research/STACK.md`'s repeated rejections of heavier SDKs). |
| `react-leaflet` | `5.0.0` (current npm) | Optional React wrapper around Leaflet | Verified via `npm view react-leaflet peerDependencies` → `{ leaflet: '^1.9.0', react: '^19.0.0', react-dom: '^19.0.0' }` — **confirmed compatible with this project's React 19.2.4**. Using it is optional; a plain `useEffect` + `useRef` Leaflet mount (no wrapper) is equally viable and avoids a second package for what is a single, static, non-interactive map panel. Recommend vanilla Leaflet in a `"use client"` component unless the planner wants React-idiomatic map state for a future iteration. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Leaflet + raster tiles | MapLibre GL JS (`6.1.0` current) + vector tiles | More modern rendering, GPU-based, better for many/animated layers — none of which this feature needs (one point + one static polygon). Meaningfully larger bundle (~200KB gzip vs ~40KB), and **requires CSP changes Leaflet doesn't**: MapLibre spins up a Web Worker (via `blob:`) for tile/style parsing, which this app's current CSP (`worker-src` not set → falls back to `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`, no `blob:`) would block outright unless `worker-src 'self' blob:` is explicitly added. Also needs `connect-src` opened to a vector-tile host (MapLibre fetches tiles via XHR/fetch, not `<img>` tags). Reasonable choice if a *future* phase wants a richer, pannable multi-layer GIS explorer — explicitly out of scope per `.planning/research/FEATURES.md`'s anti-feature list ("Full GIS map explorer... deliberately not planned"). Not recommended for this phase. |
| OpenStreetMap standard raster tiles (`tile.openstreetmap.org`) | CARTO free basemap tiles, MapTiler/Stadia (require signup + API key) | OSM standard tiles are free, no key, and match the project's existing "no paid geocoder" precedent (Nominatim, same OSM ecosystem, already in `lib/geocoding.ts`). Usage-policy risk (OSM discourages heavy production load) is the same category of risk already accepted for Nominatim — budget for a paid/self-hosted swap if usage grows, not a blocker for this phase. |
| `@terraformer/arcgis` (`arcgisToGeoJSON`) for Esri-JSON→GeoJSON polygon conversion | Hand-roll a ~15-line converter | Conflicting freshness signals found this session: the milestone `STACK.md` called it "latest 2.2.2, actively maintained"; a fresh websearch this session found npm's `@terraformer/arcgis` at `2.1.2`, last published ~3 years ago, with the original un-scoped `terraformer` package explicitly deprecated. **Confidence: LOW on "actively maintained," MEDIUM on "still works fine as-is"** — the Esri JSON polygon format (`{rings: [[[x,y],...]]}`) is stable/legacy and unlikely to change. Given the actual conversion needed here is one simple polygon (no multi-ring donut/hole geometry expected for a PRC zone), recommend a small hand-written converter (`{rings} → GeoJSON Polygon coordinates`) instead of adding a possibly-stale dependency for a ~15-line transform. Verify against a real response during implementation before deciding; either choice is low-risk. |

**Installation (if going with the recommended path):**
```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

## Architecture Patterns

### Where this UI lives (question 6 — resolved, HIGH confidence)

The milestone-level `ARCHITECTURE.md` (written before Phase 10 existed, but never invalidated) already specifies this exactly, and it still fits the current page structure read directly from `app/(dashboard)/proyectos/[id]/page.tsx`:

- **Add a `ZonificacionCard` in the existing `Tabs` → `TabsContent value="resumen"` → right column**, alongside the existing `PredioMap` card (which already renders below "Herramientas IA" using `proyecto.lat`/`proyecto.lng` via a Google Maps iframe embed — a different map, a different purpose (address confirmation, not zone-polygon confirmation), do not conflate the two).
- Do **not** create a new route/sub-page. The current page structure gates the entire `Tabs` block behind DD verification (`ExpedienteWizard` shows until `ddResult.revisionEstado === 'verificado'`) — **this is a real open question for the planner**, not resolved by existing research: should the zonificación view be visible even *before* DD verification (it has no DD dependency), or is it acceptable that it only appears once the expediente wizard flow completes? Recommend surfacing it in the Resumen tab as currently structured (matches existing precedent — SII/PredioMap cards are also gated behind DD verification today) unless the planner has reason to expose it earlier.
- New route folder names are safe here regardless (`api/proyectos/[id]/zonificacion` has no dash), but there is **no new page route needed at all** — reinforces avoiding the Turbopack accented-path/dash pitfall entirely by not creating one.

### Pattern 1: Fast snapshot read is already free — no new fetch needed for ZONE-01/03/06

**What:** `GET /api/proyectos/[id]` (existing, unmodified) does `supabase.from('proyectos').select('*, cliente:clientes(*)').eq('id', id).single()` — a `select('*')`. Phase 10's migration already added `zona_status`, `zona_sector`, `zona_nombre`, `zona_uperm`, `zona_uproh`, `zona_usos_disponibles`, `zona_fuente_url`, `zona_consultada_el`, `zona_cache_id` as real columns on `proyectos`. **These fields are already present in the JSON this route returns today** — verified by reading the route directly. What's missing is purely a **TypeScript typing gap**: `types/index.ts`'s `Proyecto` interface (read directly, lines 78-124) has `lat?`/`lng?` from the SII migration but **no `zona_*` fields at all** — Phase 10 shipped the DB/API side but never touched this type.

**When to use:** ZONE-01 ("ve automáticamente la zona PRC... sin ejecutar ninguna acción manual") and ZONE-03/ZONE-06 (usos + disclaimer, always visible) need zero new network calls — they read straight off the `proyecto` object the page already fetches on mount. This satisfies "automatic, no manual action" trivially, because the Phase 10 `after()` background trigger already populated it before the architect ever opens the page (for existing/updated projects) or shortly after (a few seconds delay noted in STATE.md for brand-new projects — the UI should handle `zona_status === 'pendiente'` gracefully, e.g. "Consultando zonificación..." rather than a blank/error state).

**Action for the plan:** Add the 9 `zona_*` fields to `Proyecto` in `types/index.ts`. This is a small, low-risk, necessary fix — do it first, it unblocks everything else.

### Pattern 2: New proyecto-scoped route serves BOTH the polygon detail AND the "Actualizar" refresh (question 3 — resolved)

**What:** Build exactly the route the milestone `ARCHITECTURE.md` sketched (`app/api/proyectos/[id]/zonificacion/route.ts`, listed as NEW there, never built in Phase 10) — but give it two distinct jobs, matching the actual data-shape split needed:

- **`GET`** — returns the polygon geometry (from `zonificacion_cache.geometria` via the existing `proyectos.zona_cache_id` FK join) **plus** the full cached row, for the map component specifically. Deliberately NOT folded into the lightweight `proyectos/[id]` payload — a GeoJSON polygon can be several KB and the existing `ARCHITECTURE.md` reasoning for why `zona_*` stays "flat, join-free, fast" on `proyectos` (no join, no heavy payload) should be preserved; keep geometry a lazy, separate fetch the map component triggers on mount, not baked into the page-load `Proyecto` object.
- **`POST`** — the ZONE-04 "Actualizar" action. Auth-gated with the exact `ownedProject()` pattern already used in `app/api/proyectos/[id]/via-tramitacion/route.ts` (read directly — `createClient()` + `getUser()` + `proyectos.user_id === user.id` ownership check), unlike the existing public `app/api/zonificacion/lookup/route.ts` (deliberately no auth, called from the unauthenticated `after()` background trigger). This POST should call the **same underlying orchestration** `persistZonificacionParaProyecto()` already exports (`lib/zonificacion-server.ts`, shipped in 10-05) — no new orchestration logic needed, just a new authenticated, synchronous, user-triggered caller of it (as opposed to the existing fire-and-forget `after()` caller), so the UI can await a definite result, show a spinner, and toast success/failure explicitly (matching the "Verificar estado en portal" / "Verificar due diligence" manual-trigger UI convention already used elsewhere on this exact page).

**Why NOT just call `lookupZonificacion()` (the client helper) directly from the browser for "Actualizar":** that would call the generic, comuna-agnostic `/api/zonificacion/lookup` route directly, which does **not** persist onto `proyectos.zona_*` — only `persistZonificacionParaProyecto()` does that write. A direct client call would refresh the cache but silently fail to update what the project's own summary shows, reproducing exactly the kind of silent-inconsistency bug `PITFALLS.md` warns about elsewhere in this codebase. Route through the server-side persist function, not the raw lookup.

### Pattern 3: ZONE-04's "explicit Actualizar, no silent refresh" is a UI-level distinction, but it DOES require one code change to the shipped Phase 10 lookup route (question 2 — resolved)

**What ZONE-04 does NOT require:** removing or gating the existing `after()` auto-trigger on project create/update (10-05) — that stays exactly as shipped. A project having its zone auto-populated once, silently, on creation is explicitly fine per Phase 10's own design and this phase's success criterion #1 ("ve automáticamente... sin ejecutar ninguna acción manual" — this is literally what the auto-trigger already provides).

**What ZONE-04 DOES require, that isn't built yet:** after that initial auto-populate, **no further silent re-fetching should ever happen** — there is currently no polling/re-trigger mechanism in the shipped code, so this constraint is *already_ satisfied by omission* (nothing re-fetches today outside of `after()` on create/update). The only genuinely new behavior needed is the "Actualizar" button itself (Pattern 2 above) — a user-initiated, visible, awaited action.

**The one necessary change to shipped Phase 10 code:** `app/api/zonificacion/lookup/route.ts`'s cache-miss write currently does a plain `.insert()` (line ~173-193, read directly). For the "Actualizar" flow to actually refresh a coordinate that's already cached (the common case — the same address, re-queried), a forced refresh must **bypass the cache read** and **upsert** (not insert) into the same `(comuna_id, lat_r, lng_r)`-keyed row, or it will violate the table's `UNIQUE INDEX` and throw. Recommend adding an optional `force=true` query param to the existing lookup route (or a small internal variant) that skips step 3 (cache read-through) and uses `.upsert(..., { onConflict: 'comuna_id,lat_r,lng_r' })` instead of `.insert()` for the write. This is a small, additive, backward-compatible change — the existing unforced behavior (used by `after()` and the public route) is untouched.

**This same forced-upsert path is also how the polygon-geometry gap gets backfilled over time (see Pitfall below):** legacy cache rows written before this phase's `returnGeometry=true` change will have `geometria = NULL`; hitting "Actualizar" on a project pointing at one of those rows is what naturally repopulates it, with no separate migration/backfill script required for MVP.

### Pattern 4: ZONE-02's polygon needs a genuinely new field, but it's additive, not a rewrite (question 1 — resolved)

**Current state (verified by reading `app/api/zonificacion/lookup/route.ts` directly):** the ArcGIS query sets `returnGeometry=false` explicitly (line 119) — no polygon geometry is fetched or stored anywhere. `zonificacion_cache.raw` (jsonb) stores only `attrs` (the `attributes` object), never `feature.geometry`.

**What ZONE-02 actually requires:** "el arquitecto ve un mapa que confirma visualmente que el punto geocodificado cae dentro del polígono de la zona retornada" is explicit about a *polygon boundary*, not just a pin — a marker-only map does not satisfy this literally. This means:

1. Change `returnGeometry=false` → `returnGeometry=true`, and add `outSR=4326` (not currently set for the *output* — `inSR=4326` is already correctly set for the *input* point per Pitfall 1's existing handling, but output geometry defaults to the layer's native spatial reference, typically Web Mercator/3857 for these OCUC layers per the Phase 10 research — omitting `outSR` here would return polygon coordinates in the wrong projection for a WGS84-based Leaflet map, a fresh instance of the exact same class of bug Pitfall 1 already documents for the input point).
2. Add a new nullable column, `zonificacion_cache.geometria jsonb` (new migration — `ALTER TABLE zonificacion_cache ADD COLUMN IF NOT EXISTS geometria jsonb`), storing the converted GeoJSON polygon (or the raw Esri-JSON rings, converted client-side or server-side — recommend converting server-side, once, at write time, so the client never needs the converter).
3. Do **not** add geometry to `proyectos.zona_*` — keep it in the cache table only, joined lazily via `zona_cache_id` (Pattern 2's `GET` route).
4. **Legacy cache rows (including anything seeded via `scripts/seed-petshop.mjs` or created during Phase 10 testing) will have `geometria = NULL`.** The map component must handle this gracefully — fall back to "marker only, polygon pending — click Actualizar to fetch the zone boundary" rather than erroring. This is expected, not a bug, and self-heals via the Pattern 3 forced-refresh path.

**Simpler alternative considered and rejected:** showing only a marker/pin (no polygon) would be far simpler and require zero schema/route changes, but does not satisfy the literal wording of ZONE-02 / success criterion #2 ("confirma visualmente que el punto... cae dentro del polígono"). Flag this tradeoff explicitly to the planner in case product intent is softer than the literal requirement text — but research here defaults to building what the requirement says.

### Pattern 5: COMPAT-01 — AI-assisted classification against verbatim text, with a deterministic no-AI short-circuit (question 4 — resolved, MEDIUM confidence on the AI approach itself)

**The core problem:** `uperm`/`uproh` are ArcGIS free text (e.g. "Vivienda, Equipamiento Científico, Equipamiento de Culto..."), not a structured taxonomy. There is no existing curated mapping in this codebase from "uso pretendido" (whatever text an architect types, e.g. "clínica veterinaria", "bodega de e-commerce") to PRC use categories. Two realistic approaches:

1. **Simple substring/keyword match** — cheap, deterministic, zero AI cost/latency, but brittle: PRC use categories are broad macro-categories (OGUC Art. 2.1.24-style: Vivienda, Equipamiento, Actividad Productiva, Infraestructura, Espacio Público, Área Verde) while a user's "uso pretendido" is likely to be a specific business activity ("veterinaria", "café", "oficina de arquitectura") that won't literally appear as a substring of the PRC's macro-category text. A naive substring match would false-negative constantly, which is worse than useless for a tool whose entire value proposition is trustworthy, cited answers.
2. **AI-assisted classification (recommended)** — this codebase already has exactly this shape of problem solved elsewhere: `lib/due-diligence.ts`'s map-reduce engine and the OGUC/predictor tools already do free-text-against-regulatory-text reasoning via `lib/ai.ts`'s `aiComplete()` with `json: true` (forces `response_format: json_object`). The same pattern applies directly here: a single, short, deterministic-feeling prompt — "Dado que los usos permitidos son: [uperm verbatim] y los usos prohibidos son: [uproh verbatim], ¿el uso pretendido '[texto del usuario]' es Permitido, No permitido, o No especificado (no se puede determinar con la información disponible)? Responde en JSON: {estado, justificacion}" — with the model constrained to the exact three states (never asked to invent a fourth, never allowed a free-form answer that isn't one of the three enum values; validate the response with a Zod enum and fall back to `'no_especificado'` if the model returns anything else, which is the same defensive pattern `getContextoNormativo`/`flagUnverifiedCita` already apply to LLM/text-derived output elsewhere in this codebase).

**Deterministic short-circuit (do this BEFORE calling AI, always):**
- If `usosDisponibles === false` (Ñuñoa today, per Phase 10's Pitfall 8 finding) → return `'no_especificado'` immediately, no AI call. There is no text to reason over.
- If both `uperm` and `uproh` are null/empty (any comuna) → same short-circuit.
- This is not just a cost optimization — it prevents the AI from ever being asked to classify against nothing, which is exactly the kind of prompt that risks a hallucinated-sounding but ungrounded answer.

**UI trigger:** make this an explicit user action (a "Verificar compatibilidad" button after the architect types their intended use), not an on-keystroke/live call — matches this page's existing convention (every other AI/network-triggered action on this page — "Verificar due diligence", "Verificar estado en portal" — is an explicit button click, never automatic-on-type).

**Rendering the 3-state result:** reuse `components/arch/estado.tsx`'s existing `EstadoNormativo`/`Veredicto` pattern rather than building a new status-pill component — it already implements exactly a "one-saturated-color status" system. Recommended mapping: `Permitido → 'cumple'` (green), `No permitido → 'rechaza'` (red), `No especificado (requiere revisión) → 'observa'` (amber — "Con observaciones" semantics fit "requires human review" well; `'neutro'` is the fallback for "not yet checked," which is a *different* state — before the architect has entered a use at all — don't conflate "not yet asked" with "asked, inconclusive").

**Confidence:** MEDIUM. The AI-assisted approach is well-supported by codebase precedent and is the only approach that plausibly handles genuinely free-text `uperm`/`uproh` correctly, but no live testing of prompt accuracy against real PRC text was performed this session — flag for a build-time spike (test against a handful of real Las Condes/Providencia/Vitacura `uperm`/`uproh` values with varied "uso pretendido" inputs) before fully trusting it, and consider logging every classification (input text + model output) for the pilot period, mirroring how Phase 10's route logs comuna cross-check mismatches — cheap insurance for a feature whose entire point is trustworthiness.

### Pattern 6: PRC citation — new type, explicitly NOT `normativa-retrieval.ts`'s `verificado` (question 5 — resolved, HIGH confidence)

**What `normativa-retrieval.ts` actually does (read directly):** it's a **curated static legal-text database** (OGUC/LGUC articles, DDU circulares hand-transcribed into `oguc-knowledge.ts`/`lguc-knowledge.ts`/`circulares-ddu.ts`). Its `verificado: boolean` on `ArticuloCitable` means "this citation matches an entry that exists in our hand-curated database" — a **completeness/existence** check against a small fixed corpus, nothing to do with data freshness or source authority. `getArticuloById()` looks up by id in that curated set; `flagUnverifiedCita()` appends "(por verificar)" to any article/DDU citation the model invents that isn't in the curated set. There's also `components/arch/cita.tsx` (`TextoConCitas`), which linkifies inline mentions of curated citations found inside free prose (a different concern from a citation card).

**Why zonificación must NOT reuse this:** PRC/GIS data is **live, per-parcel, third-party government data** (ArcGIS FeatureServer), not a static curated corpus — there is no "does this exist in our database" question to ask, the axis of trust is completely different (source-URL-exists vs. per-zone-decree-link-exists vs. generic-fallback-link). `.planning/research/ARCHITECTURE.md` line 84 already explicitly calls this out: "No change — do not extend `FuenteNormativa`. Zonificación is live per-parcel GIS data... it doesn't fit the `verificado`/`getArticuloById` model." Confirmed correct by this session's direct reading of both modules.

**What's actually needed — smaller than `normativa-retrieval.ts`'s pattern, not a peer of it:**
- A simple, presentational "Fuente" block/component (not a new lib module with a curated database) that renders: `zona_fuente_url` present → a real external link ("Ver decreto de zona ↗", opens `fuente_url`, currently populated only for Las Condes per Phase 10's field-map); `zona_fuente_url` absent → a "Fuente: capa oficial [comuna] (link no disponible para esta zona — consulta el Observatorio Urbano o el CIP oficial)" plain-text treatment, explicitly labeled "no verificado" or "sin link directo" — visually distinct from (not styled the same as) any `verificado` OGUC/LGUC badge elsewhere on the page, so an architect never mistakes "this PRC citation has a source link" for "this citation was checked against a curated legal database" (they are different claims).
- The disclaimer text (ZONE-06, "Informativo, no reemplaza el Certificado de Informaciones Previas (CIP) oficial") is a **static string**, always rendered, not conditional on any lookup result — simplest possible implementation is a small shared component (e.g. `components/proyecto/zonificacion-disclaimer.tsx` or just inlined markup reused in both the card and, if it becomes its own screen later, any other zonificación surface) rather than baking the string into multiple places.
- No new `FuenteNormativa` enum value, no `getArticuloById`-style lookup — this is a presentational concern, not a retrieval-engine concern.

### Pattern 7: ZONE-05 manual fallback (question 7 — resolved, MEDIUM confidence on the exact mechanism)

**`getComunasConCobertura()` (read directly, `lib/zonificacion-comunas.ts`):** returns `ComunaZonificacionConfig[]` — currently exactly 4 entries (Las Condes, Providencia, Vitacura, Ñuñoa), each with `comunaId`, `tier`, `featureServerUrl`, `layerIndex`, `fieldMap`, `usosDisponibles`. This is sufficient, as-is, to populate a comuna `<Select>` for the fallback UI — no changes needed there.

**The gap: there is no per-comuna zone list anywhere in the codebase today.** `getComunasConCobertura()` tells you *which comunas* are covered, not *which zone codes exist within* a comuna. ZONE-05 needs both: "seleccionar manualmente comuna **y zona**." Two realistic approaches:

1. **Static curated reference table/list per comuna** (hand-transcribe zone codes + names for the 4 comunas, similar in spirit to `oguc-knowledge.ts`). Simple, zero new API surface, but stale-risk (PRC zones do change on amendment, same staleness concern the cache TTL already exists to manage) and non-trivial upfront curation work (each dedicated OCUC comuna likely has dozens of zone codes).
2. **Dynamic ArcGIS "distinct values" query (recommended)** — a new lightweight endpoint, e.g. `GET /api/zonificacion/zonas?comuna=las-condes`, that queries the *same* FeatureServer already registered in `lib/zonificacion-comunas.ts` but **without a point geometry filter**: `where=1=1&outFields=<zona>,<nombre>&returnDistinctValues=true&returnGeometry=false&f=json`. This reuses 100% of the existing registry/fieldMap infrastructure, requires no manual curation, and stays automatically correct if OCUC updates a PRC (no separate "keep the static list in sync" maintenance burden). This is genuinely new code (Phase 10 never built a non-point query), but it's a small, additive variant of the exact query pattern already proven working in `app/api/zonificacion/lookup/route.ts`.

**What happens after the user picks comuna + zona manually:** recommend a second, equally small query (`where=<zona field>='<picked zona>'&outFields=...&resultRecordCount=1`) to fetch that zone's `uperm`/`uproh`/`nombre` for a representative row, then persist via the same `persistZonificacionParaProyecto`-adjacent write path — but flagged as **manually selected**, not geocoded. **This surfaces a real schema gap**: there is currently no column distinguishing "auto-determined via geocoding" from "manually confirmed by the architect" — recommend adding `zona_origen text CHECK (zona_origen IN ('automatico','manual'))` (or similar) in the same migration that adds `geometria`, so the UI can show "Zona confirmada manualmente" instead of implying a geocoded point-in-polygon match that didn't actually happen (ZONE-02's map polygon-confirmation makes no sense for a manually-selected zone with no geocoded point — the UI must not silently pretend one exists).

**Scope boundary to flag clearly:** this manual fallback only ever offers the 4 *already-covered* comunas — it does not, and cannot, help an architect whose project is in a genuinely uncovered comuna (there's no zone list to offer for a comuna outside `ZONIFICACION_COMUNAS`). Re-read ZONE-05's two trigger conditions separately: "geocoding falla" (comuna might still be covered, just no lat/lng — manual comuna+zona selection is the correct full recovery) vs. "comuna no tiene cobertura" (the registry itself has no entry — manual selection can only ever offer the 4 comunas that ARE covered, which is a partial/no recovery if the architect's real comuna isn't one of them; the UI copy should be honest about this, e.g. "Selecciona manualmente si tu comuna es una de las cubiertas: Las Condes, Providencia, Vitacura, Ñuñoa — para otras comunas, consulta el CIP directamente").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Point-in-polygon math for "is this point inside this zone" | A custom geometric check in JS | Nothing — ArcGIS already did this server-side (Phase 10); the map only needs to *render* the already-determined point + polygon, not recompute containment | Duplicating server-side spatial math client-side risks disagreeing with the authoritative ArcGIS answer due to floating-point/projection differences |
| A second status-pill/badge component for COMPAT-01's 3 states | New component from scratch | `components/arch/estado.tsx`'s `EstadoNormativo` | Already the codebase's one "saturated color = normative status" convention; a second, visually-different status system for a conceptually identical need (three-state normative verdict) would confuse the visual language the whole app relies on |
| Esri-JSON → GeoJSON polygon conversion, if going the "hand-roll" route from the Alternatives table | A general-purpose GIS format converter | A ~15-line function scoped exactly to the single-ring `esriGeometryPolygon` shape this feature actually receives | The full Esri JSON spec (multi-ring donuts, curves, M/Z values) is much bigger than what a PRC zone polygon from these 4 layers will ever need — don't build a general converter for a narrow, known input shape |

**Key insight:** Every genuinely new piece of infrastructure this phase needs (map rendering, distinct-zone-list query, manual-origin flag) is a **small, additive extension** of a pattern Phase 10 or the milestone research already established — resist the temptation to design a bigger, more general "zonificación v2" system than the 5 requirements actually call for.

## Common Pitfalls

### Pitfall 1: CSP will silently block map tiles/workers if not updated
**What goes wrong:** The map renders as a blank gray box (no error visible to the user, tiles just never load) because `next.config.ts`'s `Content-Security-Policy` header (`img-src 'self' data: blob: https://*.supabase.co`) doesn't include the tile host.
**Why it happens:** CSP violations for `<img>`/fetch requests fail silently in the browser network tab as "blocked by CSP," easy to miss during a quick manual test if devtools console isn't open.
**How to avoid:** Add the chosen tile host (e.g. `https://*.tile.openstreetmap.org` for Leaflet raster tiles) to `img-src` in `next.config.ts`. If MapLibre is chosen instead, also add `worker-src 'self' blob:` and the vector-tile host to `connect-src`.
**Warning signs:** Map container renders but stays blank/gray; browser console shows "Refused to load the image... because it violates the following Content Security Policy directive."

### Pitfall 2: Legacy `zonificacion_cache` rows have no geometry — map must degrade gracefully, not error
**What goes wrong:** Any project whose zone was resolved before this phase's `returnGeometry=true` change (including anything from Phase 10's own testing/seed data) will have `geometria = NULL` in its cache row. A map component that assumes geometry is always present will crash or show a broken polygon layer.
**Why it happens:** Adding a column to an existing table doesn't retroactively populate historical rows.
**How to avoid:** Treat `geometria: null` as a first-class, expected state — render the point marker alone with a small note ("Límite de zona no disponible aún — usa Actualizar"), never an error screen. The Pattern 3 forced-refresh path is the natural, no-extra-code way this self-heals over time.

### Pitfall 3: Forced "Actualizar" must upsert, not insert, or it will throw on the unique index
**What goes wrong:** If the "Actualizar" flow reuses the existing lookup route's cache-write logic unchanged (a plain `.insert()`), refreshing an address that's already cached will violate `idx_zonificacion_cache_geo`'s `UNIQUE (comuna_id, lat_r, lng_r)` constraint and fail.
**Why it happens:** The existing route was only ever exercised via cache-miss paths (new addresses) before this phase; a genuine same-address re-query is a new code path Phase 10 never needed.
**How to avoid:** Use `.upsert(..., { onConflict: 'comuna_id,lat_r,lng_r' })` specifically for the forced-refresh path (Pattern 3).

### Pitfall 4: Don't let COMPAT-01 call the AI with nothing to reason over
**What goes wrong:** If `usosDisponibles === false` or `uperm`/`uproh` are both empty and the AI is still asked "is X permitted given: [empty]," it may produce a confident-sounding but ungrounded answer (LLMs are prone to filling gaps plausibly rather than admitting "no data").
**Why it happens:** Without an explicit guard, the classification call path treats "no data" the same as "some data" and just sends whatever string is available (even empty) to the model.
**How to avoid:** The deterministic short-circuit in Pattern 5 — check `usosDisponibles`/empty-text BEFORE constructing any AI prompt, return `'no_especificado'` directly.

### Pitfall 5: `outSR` for output geometry is a DIFFERENT parameter from `inSR` for the input point — don't assume setting one covers both
**What goes wrong:** The existing route already correctly sets `inSR=4326` for the *query point* (Pitfall 1 from Phase 10's own research, already handled). Adding `returnGeometry=true` without also adding `outSR=4326` will return the polygon's coordinates in the layer's native spatial reference (commonly Web Mercator/3857 for these OCUC layers per Phase 10's findings), which Leaflet (WGS84-based, like virtually all web map libraries) will render in the wrong place or fail to render at all.
**Why it happens:** `inSR` and `outSR` are separate ArcGIS REST parameters governing different legs of the request; it's easy to update one and assume geometry "just works" the same way the point query already does.
**How to avoid:** Explicitly add `outSR=4326` alongside `returnGeometry=true` in the same query-string construction this phase touches.

### Pitfall 6: Mojibake in `uperm`/`uproh`/`nombreZona` — fix at render time, don't touch shipped Phase 10 write path unnecessarily (question 8 — resolved)
**What goes wrong:** ArcGIS text fields for some comunas contain classic double-encoding artifacts (`Â°` instead of `°`, `Ã³` instead of `ó`) — confirmed as a known, described issue in the accumulated phase context, consistent with the textbook "UTF-8 bytes decoded as Latin-1, then re-encoded as UTF-8" mojibake pattern (verified: `Buffer.from('Â°', 'latin1').toString('utf8')` correctly reverses to `'°'`, and the same transform correctly reverses `'Ã³'` → `'ó'` — this is the standard, well-understood fix for this exact corruption pattern).
**Why it happens:** The corruption is very likely baked into the *source* data on OCUC's/MINVU's side (how the original CSV/shapefile attribute text was authored/imported into ArcGIS), not introduced by this codebase's `fetch()`/`JSON.parse()` — JSON is UTF-8 by spec, so Node's own parsing isn't the corruption point; the mojibake bytes are already wrong on the wire.
**How to avoid:** Fix at **render time** in Phase 11 (a small `fixMojibakeArcGIS(s: string): string` helper applied wherever `nombreZona`/`uperm`/`uproh`/`sector` are displayed), not by editing the already-shipped Phase 10 write path. Rationale: (a) it avoids touching tested, working Phase 10 code for a purely cosmetic concern; (b) the already-persisted rows in `proyectos.zona_*`/`zonificacion_cache` from Phase 10's testing/seed data are already corrupted at rest — a read-time fix repairs them retroactively for free, a write-time-only fix would not (it would require a separate backfill migration/script regardless). Guard the transform defensively (only apply if the input actually contains a mojibake marker like `Ã` or `Â` followed by a continuation byte-range character, and skip/no-op on transform errors) so it never corrupts text that's already correct.
**Warning signs:** Any visible `Â`, `Ã`, or similar doubled-diacritic-looking sequences in rendered zone names/usos text.

## Code Examples

### ArcGIS query change for ZONE-02 (illustrative diff to `app/api/zonificacion/lookup/route.ts`)
```typescript
// Source: existing route (lines ~111-119), verified by direct read this session
arcgisUrl.searchParams.set('outFields', outFields)
arcgisUrl.searchParams.set('returnGeometry', 'true')   // was 'false'
arcgisUrl.searchParams.set('outSR', '4326')             // NEW — output geometry must match input SR
```

### AI classification call pattern (Pattern 5), reusing the existing `lib/ai.ts` shape
```typescript
// Source: mirrors lib/ai.ts's aiComplete() signature, verified by direct read
import { aiComplete } from '@/lib/ai'
import { z } from 'zod'

const CompatEstadoSchema = z.enum(['permitido', 'no_permitido', 'no_especificado'])

async function verificarCompatibilidad(
  usoPretendido: string,
  uperm: string | null,
  uproh: string | null,
): Promise<{ estado: z.infer<typeof CompatEstadoSchema>; justificacion: string }> {
  const raw = await aiComplete(
    [
      { role: 'system', content: 'Eres un asistente que clasifica compatibilidad de uso PRC. Responde SOLO JSON.' },
      {
        role: 'user',
        content: `Usos permitidos: ${uperm ?? '(sin dato)'}\nUsos prohibidos: ${uproh ?? '(sin dato)'}\nUso pretendido: "${usoPretendido}"\n\nResponde JSON: {"estado": "permitido"|"no_permitido"|"no_especificado", "justificacion": "..."}`,
      },
    ],
    { json: true, max_tokens: 300 },
  )
  try {
    const parsed = JSON.parse(raw)
    const estado = CompatEstadoSchema.safeParse(parsed.estado)
    return { estado: estado.success ? estado.data : 'no_especificado', justificacion: parsed.justificacion ?? '' }
  } catch {
    return { estado: 'no_especificado', justificacion: 'No se pudo determinar automáticamente.' }
  }
}
```

### Reusing `EstadoNormativo` for COMPAT-01's 3-state pill
```typescript
// Source: components/arch/estado.tsx, verified by direct read
import { EstadoNormativo, type Veredicto } from '@/components/arch/estado'

const COMPAT_TO_VEREDICTO: Record<'permitido' | 'no_permitido' | 'no_especificado', Veredicto> = {
  permitido: 'cumple',
  no_permitido: 'rechaza',
  no_especificado: 'observa',
}
// <EstadoNormativo estado={COMPAT_TO_VEREDICTO[estado]} label="Permitido" /> etc — override label per state
```

### `ownedProject()` auth pattern to reuse for the new proyecto-scoped route
```typescript
// Source: app/api/proyectos/[id]/via-tramitacion/route.ts, verified by direct read
async function ownedProject(id: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: Response.json({ error: 'No autenticado' }, { status: 401 }) }
  const { data: proyecto } = await supabase.from('proyectos').select('id, user_id').eq('id', id).maybeSingle()
  if (!proyecto || proyecto.user_id !== user.id) return { error: Response.json({ error: 'Proyecto no encontrado' }, { status: 404 }) }
  return { proyecto }
}
```

## State of the Art

| Old Approach (Phase 10, shipped) | New Approach (this phase) | When Changed | Impact |
|---|---|---|---|
| `returnGeometry=false` — attribute-only ArcGIS query | `returnGeometry=true&outSR=4326` — attributes + polygon | This phase | New `geometria` column on `zonificacion_cache`; existing attribute-only consumers (the public lookup route's other callers) unaffected — purely additive |
| Cache write = `.insert()` only (cache-miss path only) | Cache write = `.insert()` (miss) OR `.upsert()` (forced refresh) | This phase | Enables the "Actualizar" button and the geometry-backfill-over-time mechanism |
| `Proyecto` type has no `zona_*` fields (DB/API already has them, type doesn't) | `Proyecto` type includes all 9 `zona_*` fields | This phase | Unblocks type-safe reads of the already-returned snapshot data with no new fetch |
| No proyecto-scoped zonificación route exists | `GET/POST /api/proyectos/[id]/zonificacion` | This phase | Serves polygon geometry (GET) + explicit refresh (POST), both previously missing |

**Deprecated/outdated:** Nothing from Phase 10 is deprecated — every change this phase makes to shipped code is additive (new params, new nullable column, new optional force-mode), not a replacement of existing behavior.

## Open Questions

1. **Should the zonificación view be visible before DD verification?**
   - What we know: the current `proyectos/[id]` page gates its entire `Tabs`/Resumen content behind `ddResult.revisionEstado === 'verificado'`, showing `ExpedienteWizard` until then. Zonificación has no DD dependency.
   - What's unclear: whether product intent wants ZONE-01's "automatic, on open" to mean literally the moment the project page opens (even mid-wizard) or just "no manual lookup action required once you reach the Resumen tab."
   - Recommendation: default to the existing gating pattern (matches how PredioMap/SII data already behave on this page) unless told otherwise — flag explicitly for the planner to decide, don't silently assume.

2. **Static per-comuna zone list vs. dynamic ArcGIS distinct-values query for ZONE-05.**
   - What we know: `getComunasConCobertura()` gives the comuna list; nothing gives the zone list per comuna today.
   - What's unclear: which approach the planner prefers — static curation (simpler, staler) vs. a new dynamic-query endpoint (more code, always fresh).
   - Recommendation: dynamic query (Pattern 7) — reuses 100% of existing registry infrastructure and avoids a second stale-data-maintenance burden alongside the cache TTL that already exists for this exact reason.

3. **Exact accuracy of the AI-assisted COMPAT-01 classification against real PRC text — untested this session.**
   - What we know: the mechanism (Pattern 5) follows an established codebase precedent (`lib/ai.ts` + `json: true`).
   - What's unclear: real-world classification quality/consistency for actual `uperm`/`uproh` text from the 3 comunas that have it.
   - Recommendation: budget a small build-time spike testing several real uperm/uproh values against varied uso-pretendido inputs before considering this production-ready; log classifications during the pilot period.

4. **`@terraformer/arcgis` maintenance status is genuinely ambiguous (conflicting sources found this session)** — verify directly against the package's actual GitHub repo/npm page at build time rather than trusting either this session's or the milestone research's characterization, given they disagree.

## Sources

### Primary (HIGH confidence — direct source read, this session)
- `app/api/zonificacion/lookup/route.ts` — full read, confirms `returnGeometry=false`, `.insert()`-only cache write, `inSR=4326` already correctly handled for input
- `lib/zonificacion.ts`, `lib/zonificacion-comunas.ts`, `lib/zonificacion-server.ts` — full reads, confirm exact types, registry shape (4 comunas), `persistZonificacionParaProyecto()` behavior
- `supabase/migrations/20260730_zonificacion.sql` — full read, confirms exact `zonificacion_cache`/`proyectos.zona_*` schema shipped
- `app/(dashboard)/proyectos/[id]/page.tsx` — full read, confirms Tabs structure, DD-gating, existing `PredioMap` placement
- `components/proyecto/predio-map.tsx` — full read, confirms no map library exists today (Google Maps iframe embed only)
- `lib/geocoding.ts` — full read, confirms Nominatim usage/precedent
- `lib/normativa-retrieval.ts`, `components/arch/cita.tsx` — full reads, confirm `verificado`/curated-corpus model is genuinely distinct from what PRC citation needs
- `components/arch/estado.tsx` — full read, confirms reusable 3(+1)-state status-pill pattern
- `lib/ai.ts` — full read, confirms `aiComplete()`/`json: true` reusable pattern
- `app/api/proyectos/[id]/route.ts` and `types/index.ts` — full reads, confirm the `select('*')`-already-returns-`zona_*` + missing-TypeScript-field gap
- `app/api/proyectos/[id]/via-tramitacion/route.ts` — full read, confirms `ownedProject()` auth pattern
- `.planning/research/ARCHITECTURE.md`, `STACK.md`, `FEATURES.md`, `PITFALLS.md` (milestone-level, pre-Phase-10) — full reads of relevant sections, confirm most of this phase's shape was already correctly anticipated
- `.planning/phases/10-motor-de-zonificacion/10-RESEARCH.md` — full read, confirms Ñuñoa's `usosDisponibles: false` finding and its Phase-11 relevance
- `npm view leaflet version`, `npm view maplibre-gl version`, `npm view react-leaflet version`, `npm view react-leaflet peerDependencies` — live registry checks, confirm current versions and React 19 compatibility
- `next.config.ts` — full read, confirms exact CSP header content requiring updates for a map library

### Secondary (MEDIUM confidence)
- WebSearch: react-leaflet React 19 compatibility — corroborates the `npm view` peerDependencies finding
- WebSearch: MapLibre GL JS + Next.js App Router — general confirmation of client-component/worker requirements, not project-specific

### Tertiary (LOW confidence — flagged for validation)
- WebSearch: `@terraformer/arcgis` maintenance status — directly contradicts the milestone `STACK.md`'s characterization; treat as unresolved, re-check at build time

## Metadata

**Confidence breakdown:**
- Architecture/integration points (where things live, what routes/types need to change): HIGH — every claim verified against actual source files read this session, not assumed from prior research alone
- Map library recommendation: MEDIUM-HIGH — version/compatibility facts are HIGH (live `npm view`), but "Leaflet over MapLibre" is a judgment call based on CSP/bundle tradeoffs, not a verified-correct-by-testing choice
- COMPAT-01 classification approach: MEDIUM — mechanism is well-grounded in codebase precedent, but real-world accuracy is untested
- Pitfalls (CSP, upsert-vs-insert, outSR, mojibake): HIGH — each is a direct, verifiable consequence of reading the actual shipped code/config, not speculation

**Research date:** 2026-07-30
**Valid until:** Architecture/schema findings: stable until Phase 10 code changes again (no external time-based decay). Library version findings (Leaflet/MapLibre/react-leaflet): ~90 days recommended re-check. `@terraformer/arcgis` maintenance status: re-verify at build time given the conflicting signals found this session.
