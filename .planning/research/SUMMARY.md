# Project Research Summary

**Project:** PermisoHub — v1.4 Zonificación Automática por Dirección
**Domain:** Address → PRC zoning lookup (geocode + point-in-polygon against MINVU/OCUC ArcGIS FeatureServer), cached and cited inside an existing B2B DOM-permitting SaaS for Chilean architects
**Researched:** 2026-07-30
**Confidence:** MEDIUM-HIGH (stack and architecture verified directly against live endpoints and the existing codebase; feature UX and the specific undocumented ArcGIS service's schema/rate limits are lower confidence and need empirical verification during build)

## Executive Summary

This is a "geo-enrichment feature bolted onto an existing deterministic decision engine" — not a new product surface. The pattern is well-understood: geocode an address, run a point-in-polygon query against a public ArcGIS FeatureServer, cache the attribute result, and feed it as a citable signal into two engines that already exist (`via-tramitacion.ts`, `due-diligence.ts`). The recommended technical approach is deliberately minimal — native `fetch()`, no PostGIS, no ArcGIS SDK, no new runtime dependencies for the data layer — because the query is attribute-only (`returnGeometry=false`) and Esri already does the spatial math server-side. The one genuinely new capability the codebase lacks today is a general-purpose geocoder (nothing populates `lat`/`lng` currently) and, per FEATURES.md, a map-rendering library for visual point-in-zone confirmation — both are real, budgeted additions, not incidental.

The biggest risk is not technical complexity, it's *false confidence*. PITFALLS.md identifies seven concrete failure modes, and five of them share one root cause: collapsing distinct kinds of "we don't know" into a single reassuring answer. Lat/lng axis-order bugs produce a plausible-but-wrong zone. Empty ArcGIS results (comuna not covered) look identical to "confirmed no restrictions." Fire-and-forget background enrichment (the exact pattern already used for SII data) makes "not yet checked" indistinguishable from "checked and failed." Reusing the existing `verificado: true` citation badge would misrepresent an unofficial, university-hosted GIS layer as authoritative. And a single query point cannot represent a lot straddling two zones. Every one of these is cheap to prevent at schema/design time (explicit status enums, three-state results, a distinct non-`verificado` citation type, coordinate unit tests) and expensive to fix after due-diligence reports or vía-de-tramitación decisions have already been generated on bad data.

The recommended approach: build a small `lib/zonificacion-comunas.ts` coverage registry (tier: dedicada/agregada/sin_cobertura) and `lib/geocoding.ts` (Nominatim) as parallel, independent first steps; then a single adapter module (`lib/zonificacion.ts` + `/api/zonificacion/lookup`) that isolates all ArcGIS-specific knowledge behind a typed, validated contract; then a shared geo-keyed cache table (not per-project); then wire into existing consumers as pure additive enhancements — never modifying `recomendarVia()`'s deterministic core, never auto-setting `excedePRC` without a human checkpoint. Numeric coefficients (FOS, altura, rasante) and risk-layer overlays are explicitly out of scope this milestone — the confirmed data is text-based usos permitidos/prohibidos, not a numeric envelope.

## Key Findings

### Recommended Stack

The stack decision is to add *nothing* to the dependency tree for the core lookup: native `fetch()` (Next.js 16 / Node ≥20.9 already provides it), hand-written TypeScript interfaces validated against a live-verified ArcGIS response shape, and Zod for boundary validation — matching the existing defensive pattern used for `sii-lookup`. Caching uses plain Supabase columns (`double precision` lat/lng, `jsonb` for raw attributes), explicitly rejecting PostGIS since the spatial computation is already performed server-side by Esri; the app has never needed geometry types and shouldn't start now for an attribute-only query.

**Core technologies:**
- Native `fetch()` (Next.js 16 API routes) — query ArcGIS FeatureServer `/query` REST endpoint — verified live against two production endpoints (unauthenticated, plain JSON, no CORS concern server-side)
- Supabase Postgres, plain columns, no PostGIS — cache ArcGIS result attributes keyed by rounded lat/lng + comuna — matches existing `proyectos_sii` convention, no new extension/migration complexity
- Zod (already installed) — runtime-validate the ArcGIS response at the boundary — ArcGIS field names/order aren't contractually guaranteed stable
- Explicitly rejected: `@esri/arcgis-rest-*` SDK (adds 4 transitive deps incl. `node-fetch` even in 2026), ArcGIS JS API/`esri-leaflet` (full map SDK, not needed for one attribute query), `@terraformer/arcgis` (only needed if geometry is later rendered)

### Expected Features

**Must have (table stakes):**
- Address → geocode → point-in-polygon zone lookup against the PRC layer
- Zone code + zone name shown as citable text (not just a map pin)
- Map view confirming the point sits inside the matched zone polygon — the single highest-complexity table-stakes item since no mapping library exists in the codebase today
- `usos permitidos`/`usos prohibidos` shown verbatim with source attribution (verificado/no-verificado pattern)
- Persisted lookup result on the proyecto record with an explicit "actualizar" action (no silent polling)
- Manual comuna/zone fallback when geocoding fails
- Three-state activity/use compatibility check (Permitido / No permitido / No especificado—revisar) — never a bare binary
- "Informativo, no reemplaza el CIP oficial" disclaimer

**Should have (differentiators, v1.x):**
- Zoning as a citable input to `via-tramitacion.ts`'s `cambiaDestino` question (grounds a currently self-reported flag)
- Zoning as an AI copiloto grounding context and a `due-diligence.ts` finding source
- Portfolio-wide zoning dashboard across active proyectos
- Zero marginal cost per query vs. competitor zonificación.cl's ~CLP 10.000/consulta — bundle unmetered, do not add per-query paywalling internally

**Defer (v2+):**
- Numeric urbanistic coefficients (FOS, altura máxima, rasante, distanciamiento) — not reliably available at citable fidelity in the free MINVU/OCUC data; do not ship placeholder UI
- Risk-layer overlays (flood/tsunami/mass-movement) — data source not yet confirmed; do not stub the UI
- Full GIS map explorer / standalone browsing mode — deliberate anti-feature, dilutes the "speed up DOM permitting" value prop
- National legal-document repository — redundant with existing curated `normativa-retrieval.ts`

### Architecture Approach

The codebase already has three precedents this feature should combine, not reinvent: live external lookup (`sii-lookup.ts`), a shared service-role-written / authenticated-readable reference table (`plan_reguladores`), and fire-and-forget enrichment via `after()` in the proyecto-creation POST route. Zonificación should follow the shared-cache-table pattern (#2), not the live-scrape-every-time pattern (#1), because ArcGIS point-in-polygon queries are worth caching (repeat queries on the same parcel, rare PRC boundary changes, protecting a fragile public endpoint). The critical structural gap: **no geocoder exists in the codebase today** — `lat`/`lng` columns/types exist but nothing populates them — so `lib/geocoding.ts` is a hard, first-class prerequisite, not an incidental detail.

**Major components:**
1. `lib/zonificacion-comunas.ts` (NEW) — small, deep, per-comuna ArcGIS registry (tier + FeatureServer URL + field mapping), parallel to the existing `municipios-stats.ts` pattern, kept separate from the large-but-shallow `comunas-chile.ts`
2. `lib/geocoding.ts` (NEW) — address → lat/lng via Nominatim, a reusable general capability, not folded into the zoning module
3. `zonificacion_cache` table (NEW) — geo-keyed (`comuna_id`, rounded `lat_r`/`lng_r`), shared across projects, service-role write / authenticated read RLS, distinct from thin per-project `proyectos.zona_*` snapshot columns
4. `app/api/zonificacion/lookup/route.ts` (NEW) — the single adapter isolating all ArcGIS-specific knowledge; orchestrates registry → geocode → cache read-through → query → normalize → cache write → denormalize
5. UI/consumer layer — `ZonificacionCard` (new), `via-decision.tsx` prefill effect (UI-level only, never touches `recomendarVia()`'s pure logic), `due-diligence.ts` `ProyectoContexto.zona` (additive optional field)

Explicit build order: migration → registry + geocoder (parallelizable) → adapter/lookup route (test standalone against known comunas before building on top) → wire into `after()` → UI card → `via-decision.tsx` prefill (after UI is visually verified) → due-diligence integration (lowest priority, purely additive).

### Critical Pitfalls

1. **Lat/lng axis-order / missing `inSR=4326`** — produces a plausible-looking WRONG zone, not a crash. Always send `geometry=lng,lat` with explicit `inSR=4326`; unit-test against a known address/zone pair; cross-check returned comuna against `proyectos.municipio` at cache-write time.
2. **Treating the undocumented ArcGIS FeatureServer as a stable contracted API** — university/pilot-hosted infra can change URL, layer index, or field names without notice. Isolate all ArcGIS knowledge behind one adapter module with a validated typed contract; add a weekly health-check cron (reuse the `daily-check` cron pattern); never call it from the browser.
3. **Conflating "no result" with "sin restricciones"** — empty results from an uncovered comuna look identical to a genuine "no zone here." Maintain an explicit coverage registry; use a three-state result (`zona_encontrada` / `comuna_sin_cobertura` / `error_consulta`), enforced by TypeScript, never collapsed to a boolean.
4. **Reusing `flagUnverifiedCita`'s `verificado: true` pattern for PRC data** — that flag means "matches our curated legal corpus," a different trust axis than "not LLM-hallucinated." Add a distinct `FuenteNormativa` value (e.g. `PRC_GIS`) with its own non-`verificado` semantics and a persistent, differently-worded disclaimer.
5. **Fire-and-forget silent failure indistinguishable from "not yet checked"** — copying the exact SII `after()` + bare `catch{}` pattern is tempting but wrong here because zoning is decision-relevant (feeds `excedePRC`/due-diligence), not convenience-only. Store an explicit status enum (`pendiente`/`ok`/`error`/`sin_cobertura`); prefer synchronous-with-spinner UX (like `SIIEnricher`) over pure background silence.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundational lookup infrastructure (registry, geocoding, cache schema)
**Rationale:** Everything downstream depends on having lat/lng and a coverage registry. This is also where Pitfall 1 (axis order), Pitfall 2 (adapter isolation), and Pitfall 3 (coverage registry as schema, not afterthought) must be designed in from the start — retrofitting them later is expensive per PITFALLS.md's recovery-cost table.
**Delivers:** `supabase/migrations/2026XXXX_zonificacion.sql` (cache table + `proyectos.zona_*` + status enum), `lib/zonificacion-comunas.ts` (coverage registry), `lib/geocoding.ts` (Nominatim)
**Addresses:** the "Address → zone lookup" table-stakes premise from FEATURES.md
**Avoids:** Pitfalls 1, 2, 3, 6 (status enum designed at schema time, not bolted on)

### Phase 2: Core lookup + persistence, no UI polish yet
**Rationale:** Get the end-to-end data path proven (geocode → cache read-through → ArcGIS query → normalize → persist) against the known-covered comunas before building UI or consumer integrations on top of unverified data.
**Delivers:** `lib/zonificacion.ts` + `app/api/zonificacion/lookup/route.ts` + wiring into the existing `after()` block in `app/api/proyectos/route.ts`
**Uses:** native `fetch()`, Zod validation, Supabase cache table from STACK.md
**Implements:** the read-through shared geo-cache pattern (Pattern 1) and fire-and-forget-with-explicit-status pattern (Pattern 2, corrected per Pitfall 6) from ARCHITECTURE.md

### Phase 3: Project-facing UI — zone display, map, compatibility check
**Rationale:** This is the single highest-complexity table-stakes item (new mapping library, no precedent in the codebase) and the primary UX-facing trust surface (staleness disclosure, coverage-tier badge, non-`verificado` citation treatment per Pitfall 4).
**Delivers:** `ZonificacionCard`, manual comuna/zone fallback UI, three-state activity-compatibility check, CIP disclaimer, map view (MapLibre/Leaflet — new dependency)
**Addresses:** all remaining v1 table-stakes features from FEATURES.md
**Avoids:** Pitfalls 3 (three-state UI, not boolean), 4 (distinct citation trust treatment), 5 (staleness disclosure), 7 (boundary-proximity flag)

### Phase 4: Integration into existing decision engines
**Rationale:** These are additive enhancements to engines that already work without zoning data — sequence last so `via-tramitacion.ts`'s deterministic core and `due-diligence.ts`'s synthesis are never blocked on or corrupted by an immature zoning feature. Requires the compatibility check (Phase 3) to already be visually verified correct before trusting it to silently flip a decision toggle.
**Delivers:** `via-decision.tsx` prefill effect (UI-level only, never modifies `recomendarVia()`), `due-diligence.ts` `ProyectoContexto.zona` + prompt injection
**Addresses:** the differentiator features from FEATURES.md (grounded `cambiaDestino`, DD citation source)
**Avoids:** the anti-pattern of auto-setting `excedePRC` without a human confirmation checkpoint (Pitfall 4 / PITFALLS.md integration gotchas)

### Phase Ordering Rationale

- Geocoding and the coverage registry are hard prerequisites with zero existing precedent in the codebase — they must exist before any spatial query is possible, and building them in parallel (per ARCHITECTURE.md's build order) is safe since neither depends on the other.
- The map view is deliberately isolated into its own phase because it is the one genuinely new frontend dependency in the whole feature (FEATURES.md flags it as the highest-complexity table-stakes item) — bundling it with the data-layer work risks under-scoping either.
- Decision-engine integrations are sequenced last and treated as strictly additive because both `via-tramitacion.ts` (explicitly "NO usa IA", pure/auditable) and `due-diligence.ts` must continue working correctly when zoning lookup fails, is uncovered, or hasn't run yet — this ordering makes that non-negotiable rather than an assumption.
- This ordering also naturally sequences pitfall-prevention correctly: schema-time pitfalls (1, 2, 3, 6) are addressed in Phase 1 before any data exists to corrupt; UI-time pitfalls (4, 5, 7 disclosure) are addressed in Phase 3 before any consumer trusts the data; the human-checkpoint pitfall (4's `excedePRC` auto-set risk) is addressed by sequencing Phase 4 last.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (registry/geocoding):** Nominatim accuracy for Chilean addresses is unverified for this specific address corpus; per-comuna ArcGIS field-name/casing consistency across the 4+ target comunas needs empirical confirmation, not just the two endpoints already verified in STACK.md.
- **Phase 3 (UI/map):** No mapping library exists in the codebase — MapLibre vs. Leaflet selection, tile/basemap source, and bundle-size tradeoffs need a focused spike before implementation.
- **Phase 4 (activity-compatibility text matching):** FEATURES.md flags this explicitly as an open question — curated OGUC-macro-use taxonomy vs. AI-assisted classification is a design decision not resolved by this research pass.

Phases with standard patterns (skip research-phase):
- **Phase 2 (core lookup + persistence):** Directly mirrors three existing, well-understood codebase patterns (`sii-lookup.ts`, `plan_reguladores` shared cache, `after()` fire-and-forget) — architecture is already fully specified in ARCHITECTURE.md down to file paths and example code.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Live-verified against two real ArcGIS endpoints this session; version compatibility confirmed via npm registry and official Esri docs; matches existing codebase conventions exactly |
| Features | MEDIUM | Competitor UX (zonificación.cl) inferred from a marketing page, not a hands-on trial; US zoning-table conventions well-established but Chilean-specific ambiguity handling (boundary cases) is undocumented anywhere and explicitly flagged as an open design question |
| Architecture | HIGH for integration points/file paths (direct codebase inspection); MEDIUM for the geocoding prerequisite and per-comuna ArcGIS field consistency (flagged as needing hands-on verification during build) |
| Pitfalls | MEDIUM | ArcGIS REST mechanics and Chilean PRC legal-vigencia mechanics are HIGH confidence (official Esri/BCN sources); the specific MINVU/OCUC FeatureServer's exact schema, layer list, and rate limits are LOW confidence and must be empirically verified against the real endpoint during implementation |

**Overall confidence:** MEDIUM-HIGH — the technical shape of the solution (stack, architecture, pitfalls-to-design-around) is well-grounded in direct verification and existing codebase precedent; the softer areas (exact competitor UX, per-comuna data quirks, activity-text-matching design) are correctly flagged as open questions rather than assumed away.

### Gaps to Address

- **Boundary-proximity ambiguity UX**: no competitor publicly documents how to handle a geocoded point falling near a zone-polygon edge. Design explicitly during Phase 3 planning (e.g., distance-to-boundary threshold triggers a "cerca del límite — verifica en el CIP" warning) rather than assuming a pattern to copy.
- **Activity/use text-matching mechanism**: curated taxonomy vs. AI-assisted classification is unresolved — flag for a design spike before Phase 4 implementation.
- **MINVU/OCUC ArcGIS layer's date/vintage field**: whether a usable decree/publication date exists for the staleness-indicator differentiator was not verified — check at Phase 1/2 implementation time against the actual per-comuna layers in scope.
- **Per-comuna field-name/casing consistency**: only two endpoints were live-verified (`PrcCuencaMaipo`, `PRC_Las_Condes`); the remaining target comunas (Providencia, Vitacura, Ñuñoa per ARCHITECTURE.md) need the same live verification before the coverage registry is finalized.
- **Nominatim rate-limit/accuracy behavior for Chilean addresses**: flagged in both STACK.md and ARCHITECTURE.md as needing real verification time, not just ToS reading — budget for this explicitly in Phase 1.

## Sources

### Primary (HIGH confidence)
- Live `curl` verification against `https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer/0/query` (this session, 2026-07-30)
- ArcGIS REST APIs — Query (Feature Service/Layer): https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/
- npm registry metadata for `@esri/arcgis-rest-request`, `@esri/arcgis-rest-fetch`, `@terraformer/arcgis`
- Direct codebase inspection: `lib/sii-lookup.ts`, `lib/normativa-retrieval.ts`, `lib/via-tramitacion.ts`, `lib/due-diligence.ts`, `lib/comunas-chile.ts`, `lib/municipios-stats.ts`, `app/api/proyectos/route.ts`, `supabase/migrations/20260705_proyectos_sii.sql`, `supabase/migrations/20260630_plan_reguladores.sql`, `lib/rate-limit.ts`, `app/api/cron/daily-check/route.ts`

### Secondary (MEDIUM confidence)
- [zonificación.cl](https://www.zonificacion.cl/) — competitor marketing page, not a hands-on trial
- [Zoneomics product pages](https://www.zoneomics.com/product/api) — US zoning-API patterns
- OCUC/MINVU ArcGIS Hub PRC dataset listings (ideocuc-ocuc.hub.arcgis.com, ide.minvu.cl) — confirms per-comuna fragmentation and Web Mercator (EPSG:102100) reference system, but the specific integrated FeatureServer needs independent per-comuna confirmation
- BCN/Diario Oficial — PRC modification decree publication and 30-day vigencia rule

### Tertiary (LOW confidence)
- General ArcGIS zoning-lookup workflow synthesized from multiple GIS-practitioner sources, not one authoritative doc
- Undocumented MINVU/OCUC FeatureServer's exact rate limits and schema stability — no official contract exists; must be treated as unknown host-controlled behavior and verified empirically during build

---
*Research completed: 2026-07-30*
*Ready for roadmap: yes*
