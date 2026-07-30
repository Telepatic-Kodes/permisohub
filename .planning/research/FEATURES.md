# Feature Research

**Domain:** Zoning/land-use lookup for a B2B DOM-permitting SaaS (Chilean architects) — "zonificación automática por dirección"
**Researched:** 2026-07-30
**Confidence:** MEDIUM (zonificación.cl UX inferred from public marketing page, not a hands-on trial; ZoneOmics/US patterns verified via official product pages; general zoning-table semantics — Permitted/Conditional/Prohibited — is well-established US planning practice, MEDIUM-HIGH confidence; Chilean-specific PRC ambiguity handling is LOW confidence since no competitor documents it publicly)

## Feature Landscape

### Table Stakes (Users Expect These)

Features an architect will assume exist the moment "zonificación" appears inside a project. Missing these makes the feature feel like a toy, not a professional tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Address → zone lookup (geocode + point-in-polygon against PRC layer) | This is the entire premise of the feature — zonificación.cl's core loop is "busca una comuna o dirección" → zone resolves automatically. ZoneOmics: "enter an address and zoning data populates automatically." | MEDIUM | Depends on geocoding. `lib/sii-lookup.ts` already resolves `direccion + comuna → lat/lng`, but only when the address matches a SII rol — not a general-purpose geocoder. This feature needs its own geocode step (independent of SII match) feeding into a spatial (point-in-polygon) query against the MINVU/OCUC ArcGIS PRC feature layer. Reuse the `direccion`/`comuna` param shape from `sii-lookup.ts` for consistency, but do not assume SII lookup ran first. |
| Zone code + zone name shown as text (not just a map pin) | Both zonificación.cl and ZoneOmics present a combined map+text view; architects need the zone identifier (e.g. "ZM-3") as a copyable/citable string for expedientes, memorias, and DOM correspondence — a map alone isn't citable. | LOW | Straightforward render once the lookup returns data. |
| Map view confirming the point/parcel sits inside the returned zone polygon | Standard GIS lookup pattern: geocode → query parcel/zoning layer → render point over zoning polygon so the user can visually sanity-check the match (source: ArcGIS zoning-lookup workflow docs; zonificación.cl's "Mapa de análisis por dirección"). For an architect, a bare zone code with no visual boundary confirmation is not trustworthy — geocoding errors are common enough that visual confirmation is expected, not optional. | MEDIUM-HIGH | **New dependency**: no mapping library exists in the codebase today (`package.json` has no Leaflet/MapLibre/Mapbox/Google Maps). This is the single highest-complexity item in the table-stakes set — budget for adding a lightweight map lib (MapLibre GL or Leaflet) + a basemap tile source, not just an API call. |
| `usos permitidos` / `usos prohibidos` shown verbatim, with source attribution | zonificación.cl's core value line: "identificar la zona normativa y sus restricciones... usos permitidos." Architects need the exact regulatory text, not a paraphrase — paraphrasing zoning text is a liability in a tool that feeds permit decisions. | LOW | Confirmed available in MINVU/OCUC data per milestone context. Follow the `normativa-retrieval.ts` citation convention: display raw text + a `verificado` flag + link to the official decree when the ArcGIS record includes one, fallback link (e.g. to the comuna's PRC page) when it doesn't — mirrors `FUENTE_FALLBACK_URL` pattern already used for OGUC/LGUC/DDU. |
| Persisted/cached lookup result on the proyecto record | Architects reopen a project's zoning tab repeatedly (during design iteration, before DOM submission, during due diligence) — re-querying the ArcGIS service every page load is wasteful and fragile if MINVU's service has latency/downtime. | LOW | New Supabase column/table on `proyectos` (e.g. `zonificacion` jsonb + `zonificacion_fecha`), with an explicit "actualizar" action rather than silent background refresh — matches the app's existing pattern of explicit AI/lookup actions (due diligence, SII enrichment) rather than invisible polling. |
| Manual fallback when address isn't found / geocode fails | Chilean addresses (rural sectors, new subdivisions, non-standard numbering) frequently fail geocoders. A tool that just errors out with no path forward is unusable for the ~10-20% of addresses geocoding will miss. | LOW-MEDIUM | Simplest version: let the architect manually select comuna + zone from a dropdown seeded from the same ArcGIS PRC layer (comuna's zone list), skipping the spatial query. Do not silently guess. |
| "Informativo, no reemplaza el Certificado de Informaciones Previas" disclaimer | The zone shown is derived from public geospatial data, not the DOM's own record. Chilean architects know the CIP (Certificado de Informaciones Previas) is the only legally binding zoning document; a tool that implies otherwise misleads a professional user and creates liability exposure. | LOW | Copy-only. Mirrors the "ORIENTATIVO" framing already used verbatim in `via-tramitacion.ts` header comments and UI. |

### Differentiators (Competitive Advantage)

Where PermisoHub can beat zonificación.cl and a raw MINVU/ArcGIS portal — not by having more zoning data, but by making zoning data operate as a first-class citable input across an existing DOM-permitting workflow instead of a standalone lookup silo.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Zoning becomes a citable input to `via-tramitacion.ts` (specifically the `excedePRC` / `cambiaDestino` questions) | Today `excedePRC` and `cambiaDestino` are self-reported by the architect with no grounding. Cross-referencing the architect's stated intended use against the zone's `usos permitidos/prohibidos` lets the vía-de-tramitación decision cite a real source instead of trusting an unverified checkbox — directly strengthens the deterministic decision engine that is PermisoHub's core differentiator. | MEDIUM | Requires the activity-compatibility check (below) to exist first. Do not auto-answer `excedePRC` (that needs numeric coefficients, out of scope) — only pre-fill/flag `cambiaDestino`-adjacent signal ("el uso declarado no aparece en los usos permitidos de esta zona") as a warning `via-tramitacion.ts` can surface in its `alertas` array. |
| Zoning data as grounding context for the AI copiloto drawer (`diagnóstico OGUC`, `checklist` skills) | Turns a static "here's your zone" lookup into the same AI-reasoning experience the rest of the app already delivers (e.g. explaining that a "taller artesanal" likely falls under "actividades productivas inofensivas" even if the PRC text doesn't use that exact phrase) — something a rigid keyword-matcher (or zonificación.cl's opaque black-box "compatible/no compatible" verdict) can't do transparently. | MEDIUM | Feed the zone's raw `usos permitidos/prohibidos` text into the existing skill prompts as additional context, same pattern as `getContextoNormativo()` feeding OGUC/LGUC/DDU text into prompts. |
| Zoning becomes a citable `refNormativa`-style finding inside `due-diligence.ts` | When the DD engine detects a destino mismatch (e.g. SII `destino` says "Comercio" but the project's stated use in documents is residential), it can now cite the actual zone's permitted-uses text as evidence, not just flag an "incoherencia interna." Extends the DD product's core loop (fundamented findings, `verificado` boolean) into a new evidence source. | MEDIUM | Needs a `RefNormativa`-shaped citable object for zone data (new `fuente` type, e.g. `'PRC'`), parallel to `getArticuloById()` — same verified/unverified convention. |
| Zero marginal cost per query vs zonificación.cl's ~CLP 10.000/consulta | Architects juggling many active proyectos would otherwise pay per-address on a competitor tool; folding this into the existing subscription removes a real, recurring out-of-pocket cost and a reason to tab out to a separate paid product mid-workflow. | LOW (business model, not a build item) | Reinforce by NOT metering the internal feature (see anti-features). |
| Portfolio-wide zoning view across all active proyectos | A per-query-credit competitor structurally cannot offer a "show me zoning status/compatibility across all 40 of my active projects" dashboard economically — it's a natural extension once zoning is stored per-proyecto, and plays to PermisoHub's existing multi-project SaaS structure (vs. zonificación.cl's single-lookup tool). | MEDIUM | v1.x — depends on the table-stakes lookup+persistence existing first for every project. |
| Data-freshness transparency ("PRC vigente desde [fecha]", flag if MINVU's underlying decree looks stale) | Research found no evidence zonificación.cl surfaces PRC vintage/staleness to the user — an opening for a tool built for professionals who care whether the plan they're relying on is the currently governing instrument (PRCs get modified/appealed and old zoning data circulating is a known real pitfall in Chile). | LOW-MEDIUM | Depends on whether the MINVU/OCUC ArcGIS layer exposes a decree/publication date field — verify at build time; if absent, at minimum timestamp "consultado el [fecha]" so the architect knows how fresh the app's own cache is. |
| PDF/exhibit export of the zoning finding for the expediente | Architects assembling a DOM submission or a due-diligence packet need a citable artifact, not just an in-app screen — matches the existing pattern of exportable, citable outputs elsewhere in the product (DD reports, formal communications). | LOW-MEDIUM | v1.x, straightforward once the underlying data model is stable. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Numeric urbanistic coefficients (FOS, coef. de constructibilidad, altura máxima, rasante, distanciamiento) | Feels like "the natural next step" once zone lookup exists — an architect will immediately ask "ok but what's my max height." | Explicitly out of scope this milestone: not reliably available in the free MINVU/OCUC data at the fidelity needed to be citable (unlike text-based usos, which are directly quotable). Building placeholder UI or a half-verified numeric feed risks presenting unverified numbers as fact in a tool whose whole value prop is trustworthy, citable output. | Ship text-based zone/uso data only this milestone; link out to the official decree/ordinance PDF (already required as a citation source) for coefficients, and flag numeric coefficients as a clearly-labeled "próximamente" or defer entirely to a future milestone with a paid/verified data source. |
| Full GIS map explorer (browse the whole comuna without an address, draw custom polygons, toggle every layer as a standalone mapping product) | This is literally what zonificación.cl and ZoneOmics look like as products, so it's the "obvious" shape to copy. | PermisoHub's users are architects working a specific project at a specific address, not consumers or brokers browsing a city map. Building a general-purpose GIS explorer duplicates an entire competitor product surface, adds large ongoing maintenance cost (layer management, map performance, tile hosting), and dilutes the core value prop ("speed up DOM permit processing") rather than serving it. | Scope the map to a single fixed view: the project's address pinned inside its own zone polygon, nothing more. No free-roam exploration mode. |
| National legal-document repository (all comunas' ordinances/decrees as a browsable library) | zonificación.cl advertises this as a differentiator ("base de datos legal completa... MINVU, MINSAL, MINEDUC, MMA, INE, SUBDERE"), so it looks table-stakes by association. | PermisoHub already has a curated, verified normativa layer (`normativa-retrieval.ts` — OGUC/LGUC/DDU) with its own "verificado" discipline. Duplicating a national ordinance library for zoning specifically is redundant infrastructure not needed to answer "what's my zone and is my use compatible" — and a large, hard-to-maintain scope expansion disconnected from the milestone's actual question. | Store/link only the specific decree relevant to the project's own comuna/zone (one link, resolved at lookup time), not a browsable national library. |
| Automated, unconditional "SÍ, tu uso es compatible" verdict with no caveats | Feels like the most useful, decisive answer — and is literally what a "compatible/incompatible" binary check implies. | Dangerous in a B2B tool whose output feeds real permit-track decisions: PRC `usos permitidos/prohibidos` text is often written at a coarser grain than a specific real-world activity (e.g. PRC lists "Equipamiento — Salud" as a category; the architect's actual use is "clínica dental ambulatoria") — a rigid text match can produce false confidence in either direction. US zoning-table practice itself uses a three-state model (Permitted / Conditional-requires-review / not listed), not binary, precisely because binary answers overstate certainty. | Three-state result: **Permitido** / **No permitido** / **No especificado — requiere revisión** (when the stated use doesn't clearly match the zone's listed text), always paired with the CIP disclaimer already noted in table stakes. |
| Risk-layer overlays (flood/tsunami/landslide/mass-movement zones) as a shipped feature this milestone | zonificación.cl bundles this ("Zonas de riesgo... inundaciones, remociones en masa, tsunamis") and it feels like a natural companion to zoning. | Milestone context confirms this data source is not yet confirmed/sourced. Building UI for a data feed that doesn't exist yet produces a broken-looking placeholder and scope creep beyond the milestone's defined target. | Defer to a future milestone once a public risk-layer data source is identified and verified; do not stub the UI in this milestone. |
| Per-query internal credit/paywall metering for the zoning feature | Tempting because it "worked" for zonificación.cl and could look like a monetization lever. | Directly undermines the milestone's stated strategic rationale (build in-house on free public data specifically to avoid the CLP ~10.000/query cost architects currently pay a competitor) and adds friction to a feature meant to be a bundled differentiator inside the existing subscription. | Bundle unmetered inside existing plans; if usage-based limits are ever needed, gate at the plan tier (e.g. "N proyectos"), not per zoning query. |

## Feature Dependencies

```
Address geocoding (new, general-purpose)
    └──requires──> extends address-normalization conventions of lib/sii-lookup.ts
                       (reuse direccion+comuna param shape; do NOT require an SII match first)

Address → zone spatial lookup (MINVU/OCUC ArcGIS PRC layer)
    └──requires──> Address geocoding
    └──feeds──> Zone code/name + usos permitidos/prohibidos display

Map view (point-in-polygon confirmation)
    └──requires──> Address → zone spatial lookup
    └──requires──> NEW mapping library (none exists in package.json today)

usos permitidos/prohibidos citation (verificado/no verificado + source link)
    └──requires──> Address → zone spatial lookup
    └──parallels──> lib/normativa-retrieval.ts citation pattern (ArticuloCitable, FUENTE_FALLBACK_URL)

Activity/use compatibility check (Permitido / No permitido / No especificado)
    └──requires──> usos permitidos/prohibidos citation (needs the text to match against)

via-tramitacion.ts enhancement (flag cambiaDestino risk from zone mismatch)
    └──requires──> Activity/use compatibility check
    └──enhances──> lib/via-tramitacion.ts (adds a grounded alerta, does not change the deterministic rule tree)

due-diligence.ts enhancement (cite zone data as a finding source)
    └──requires──> usos permitidos/prohibidos citation
    └──enhances──> lib/due-diligence.ts (new refNormativa-shaped fuente: 'PRC')

AI copiloto skill grounding (diagnóstico OGUC / checklist skills use zone text as context)
    └──requires──> usos permitidos/prohibidos citation
    └──enhances──> existing copiloto drawer skills (no change to their trigger UX)

Portfolio-wide zoning dashboard
    └──requires──> Address → zone spatial lookup persisted per-proyecto (table stakes, all projects)

Numeric urbanistic coefficients (FOS, altura, rasante, etc.) ──conflicts with── this milestone's scope
    (explicitly deferred; do not partially build)

Risk-layer overlays ──conflicts with── this milestone's scope
    (data source unconfirmed; do not stub UI)
```

### Dependency Notes

- **Map view requires a new mapping library:** this is the one item in the table-stakes set that isn't a pure data/logic extension of existing code — it's a new frontend dependency (MapLibre GL or Leaflet + a basemap/tile source) with no precedent elsewhere in the codebase. Size this explicitly in planning; it's not "just another lib call" the way `sii-lookup.ts`-style features are.
- **Activity compatibility requires usos permitidos/prohibidos citation to exist first:** you cannot answer "is my use compatible" before you have the zone's text to match against — this is a hard sequencing dependency, not just a nice-to-have ordering.
- **`via-tramitacion.ts` and `due-diligence.ts` integrations are enhancements, not prerequisites:** both existing engines work today without zoning data (via self-reported flags / document-only evidence). Zoning-derived citations upgrade their grounding but should be additive — do not restructure either engine's core logic to depend on zoning data being present, since geocoding/lookup can fail (see anti-ambiguity fallback in table stakes) and both engines must keep working when it does.
- **Numeric coefficients and risk layers conflict with this milestone's scope** in the sense that any partial building (e.g., a coefficients section with "N/A" placeholders) creates a broken/unfinished look rather than a clean, complete v1 — treat as fully deferred, not partially started.

## MVP Definition

### Launch With (v1)

- [ ] Address → geocode → point-in-polygon zone lookup against MINVU/OCUC ArcGIS PRC layer — the entire premise of the feature
- [ ] Zone code + zone name displayed as text inside the project
- [ ] Map view confirming the point sits inside the matched zone polygon — architects won't trust a bare code with no visual check
- [ ] `usos permitidos` / `usos prohibidos` displayed verbatim, with source link when available (verificado/no verificado pattern from `normativa-retrieval.ts`)
- [ ] Persisted lookup result on the proyecto record with an explicit "actualizar" action (no silent background polling)
- [ ] Manual comuna/zone fallback when geocoding fails or address isn't matched
- [ ] Activity/use compatibility check: architect states intended use → three-state result (Permitido / No permitido / No especificado—revisar), never a bare binary "compatible"
- [ ] "Informativo, no reemplaza el CIP oficial" disclaimer on every zoning screen

### Add After Validation (v1.x)

- [ ] Zoning-derived alerta feeding `via-tramitacion.ts`'s `cambiaDestino` decision — once the compatibility check is proven reliable enough to trust as a decision input
- [ ] Zoning citation as a `due-diligence.ts` finding source — once the `RefNormativa`-shaped `'PRC'` fuente type is validated
- [ ] AI copiloto skill grounding with zone text (diagnóstico OGUC, checklist) — once the base lookup+display is stable and the text-matching for compatibility has been tuned
- [ ] PDF/exhibit export of the zoning finding — once the data model and citation format are stable
- [ ] Portfolio-wide zoning dashboard across all active proyectos — once persistence exists for a meaningful number of projects
- [ ] Data-freshness/staleness indicator ("PRC vigente desde...") — pending confirmation the ArcGIS layer exposes a usable date field

### Future Consideration (v2+)

- [ ] Numeric urbanistic coefficients (FOS, coef. constructibilidad, altura máxima, rasante, distanciamiento) — needs a different/paid/verified data source; explicitly out of scope until then
- [ ] Risk-layer overlays (flood, tsunami, mass movement) — needs a confirmed public data source not yet identified
- [ ] PRI (planificación intercomunal) layer
- [ ] Full GIS map explorer / standalone browsing mode — deliberately not planned (anti-feature, see above), only revisit if user research explicitly demands it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Address → zone lookup (geocode + spatial query) | HIGH | MEDIUM | P1 |
| Zone code/name text display | HIGH | LOW | P1 |
| Map view (point-in-polygon confirmation) | HIGH | MEDIUM-HIGH (new map lib) | P1 |
| usos permitidos/prohibidos text + citation | HIGH | LOW | P1 |
| Persisted lookup + manual refresh | MEDIUM | LOW | P1 |
| Manual fallback for unmatched addresses | MEDIUM | LOW-MEDIUM | P1 |
| Activity compatibility check (3-state) | HIGH | MEDIUM | P1 |
| CIP disclaimer | MEDIUM | LOW | P1 |
| via-tramitacion.ts integration | HIGH | MEDIUM | P2 |
| due-diligence.ts citation integration | MEDIUM-HIGH | MEDIUM | P2 |
| AI copiloto grounding | MEDIUM | MEDIUM | P2 |
| PDF export of zoning finding | MEDIUM | LOW-MEDIUM | P2 |
| Portfolio-wide zoning dashboard | MEDIUM | MEDIUM | P3 |
| Data-freshness indicator | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Numeric coefficients | HIGH (eventually) | HIGH | Deferred (v2+) |
| Risk-layer overlays | MEDIUM | MEDIUM-HIGH | Deferred (v2+) |

**Priority key:**
- P1: Must have for this milestone's launch
- P2: Should have, natural v1.x extension once P1 is validated
- P3: Nice to have, later
- Deferred: explicitly out of scope per milestone context

## Competitor Feature Analysis

| Feature | zonificación.cl | ZoneOmics (US) | Our Approach |
|---------|------------------|------------------|--------------|
| Address search | Search box, comuna or address | Address entry or pin-drop on map | Address search reusing existing `direccion`/`comuna` conventions; add manual comuna/zone fallback |
| Results presentation | Combined map + text ("Mapa de análisis por dirección" + key-info panel) | Map + auto-populated report | Combined map + text inside the project (not a separate app/tab) |
| Compatibility check | "Actividades permitidas según PRC" — cross-references activity against zone; exact UX for activity selection undocumented publicly | "Zone Picker" tool, guided filters; largely US permitted/conditional table semantics | Explicit 3-state result (Permitido/No permitido/No especificado) rather than an opaque binary, to avoid false confidence |
| Boundary/ambiguity handling | Not documented publicly (no visible confidence indicators, disambiguation, or staleness flags found) | Guided tours, zone picker for manual correction; no explicit boundary-proximity warning found | Manual fallback for unmatched addresses; treat as an open item to design (see Open Questions) |
| Pricing | Credit-based, ~CLP 10.000/query, one free comuna (Recoleta) for trial | Not surfaced in this research pass | Bundled inside existing subscription, unmetered — a deliberate anti-feature to avoid |
| Data layers | PRC zoning + PRI + risk zones + equipment/infra + SII property data + national legal doc repository | Zoning + parcel boundaries via geoJSON API | Zoning + usos permitidos/prohibidos only this milestone; explicitly no risk layers, no national doc repository (anti-features above) |
| Numeric coefficients | Not confirmed present/absent from this research pass | Zoning API implies broader zoning attribute access (not confirmed to include buildability coefficients for Chile, N/A market) | Out of scope this milestone (confirmed by milestone context) |
| Integration into a broader workflow | Standalone product; user must tab out from their permitting tool to use it | Standalone product/API for real estate use cases | Zoning is a first-class citable input inside `via-tramitacion.ts` and `due-diligence.ts` — this is the core differentiator, not the raw data itself |

## Sources

- [zonificación.cl](https://www.zonificacion.cl/) — MEDIUM confidence (marketing page fetched directly, not a hands-on account trial; UX details on activity-compatibility mechanism and pricing partially inferred/incomplete)
- [Zoneomics — Zoning API for Developers](https://www.zoneomics.com/product/api) — MEDIUM-HIGH confidence (official product page)
- [Zoneomics — Zoning Data Platform](https://www.zoneomics.com/product/platform) — MEDIUM-HIGH confidence (official product page)
- [Zoneomics — October 2025 release notes](https://www.zoneomics.com/blog/october-2025-release) — MEDIUM confidence (official blog, confirms guided-tour/zone-picker UX patterns)
- [LA City Zoning Code — "How do I find out if my use is permitted?"](https://zoning.lacity.gov/faq/use/how-do-i-find-out-if-my-use-permitted) — MEDIUM confidence, used to confirm US Permitted/Conditional/Prohibited table convention
- [PAS QuickNotes — Conditional Uses (American Planning Association)](https://planning-org-uploaded-media.s3.amazonaws.com/document/PASQuickNotes41.pdf) — MEDIUM confidence, general planning-practice reference for the permitted/conditional/prohibited trichotomy
- General ArcGIS zoning-lookup workflow (geocode → parcel query → zoning layer query → map render) — MEDIUM confidence, synthesized from multiple Esri/GIS practitioner sources found via search, not a single authoritative doc
- Internal codebase review: `lib/sii-lookup.ts`, `lib/normativa-retrieval.ts`, `lib/via-tramitacion.ts`, `lib/due-diligence.ts` (read directly, HIGH confidence — these are the actual dependency/integration points)

## Open Questions (not resolved by this research pass)

- **Boundary-proximity ambiguity UX**: neither zonificación.cl nor ZoneOmics publicly documents how they handle an address whose geocoded point falls very close to a zone-polygon edge (common with geocoding imprecision). Recommend designing this explicitly rather than assuming a competitor pattern exists to copy — e.g., compute distance-to-nearest-boundary from the ArcGIS response and surface a "cerca del límite de zona — verifica en el CIP oficial" warning below some threshold.
- **Text-matching mechanism for the activity compatibility check**: whether to implement as a curated OGUC-macro-use taxonomy (art. 2.1.24-style categories: Vivienda, Equipamiento, Actividades Productivas, Infraestructura, etc.) mapped against free-text PRC uses, vs. an AI-assisted classification (consistent with the `due-diligence.ts` map-reduce AI pattern already in the codebase) is a build-time design decision, not something this research resolved — flag for phase-specific research or a design spike before implementation.
- **MINVU/OCUC ArcGIS layer's date/vintage field**: whether the confirmed-available data includes a decree/publication date usable for the staleness-indicator differentiator was not verified in this pass (out of scope per milestone context, which says only zone code/name/usos/decree-link are confirmed available) — check at implementation time.
