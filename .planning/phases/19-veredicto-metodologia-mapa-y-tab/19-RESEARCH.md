# Phase 19: Veredicto, Metodología, Mapa y Tab - Research

**Researched:** 2026-08-03
**Domain:** Pure synthesis logic (3-state verdict + confidence composition) over an already-designed `AnalisisCabidaComercial` shape, plus a Leaflet map component and a methodology/sources UI section — closing Fases 17/18's data work into something a user can actually read and trust.
**Confidence:** HIGH on architecture/integration (every seam verified against real, currently-committed code — Phase 16/17/18's actual files, not their plans). MEDIUM on the exact verdict-scoring formula (no prior art in this codebase for a 3-input confidence-weighted classifier; the *discipline* is well precedented, the *thresholds* are this phase's own judgment call, flagged in Open Questions).

<user_constraints>
## User Constraints

No CONTEXT.md exists for this phase — `/gsd:discuss-phase 19` was skipped. Everything is Claude's Discretion within `REQUIREMENTS.md`'s boundaries (VERE-01 to VERE-04, MAPA-01, CABI-02) and `ROADMAP.md`'s phase description. No locked decisions to honor verbatim beyond the requirements text itself, quoted here:

- VERE-01: 3-state verdict per format — never binary.
- VERE-02: verdict always shown with its confidence level — never one without the other.
- VERE-03: methodology/sources section citing census date, competitor scrape date, radius/isochrone used, and what could not be verified.
- VERE-04: gap score presented explicitly as a density-of-supply-vs-estimated-demand proxy — never as a real leakage/surplus index.
- MAPA-01: Leaflet map with the area-of-influence polygon (isochrone or radius) and competitor pins.
- CABI-02: "Cabida Comercial" tab as the 5th tab on the opportunity detail page, on-demand loading following `ResumenTab`'s pattern.

### Claude's Discretion
Everything: exact verdict function signature, exact scoring/threshold logic, exact methodology section content and placement, exact map component structure, exact gating strategy for the two upstream dependencies (Phase 17's `demografia`, Phase 18's `competencia`) plus Phase 16's tab file itself.

### Deferred Ideas (OUT OF SCOPE)
Per `REQUIREMENTS.md`'s "Out of Scope" table (all v1.7-wide, not phase-specific): calibrated Huff model, real leakage/surplus index, real foot traffic (Placer.ai-style), precise GSE via paid vendor, single 0-100 viability score, sales/revenue projection, real-time-traffic isochrone. None of these are Phase 19's job even implicitly — the verdict function must NOT approximate any of them under a different name.
</user_constraints>

## Summary

Phase 19 is a **synthesis phase with an unusually deep and unusually well-documented dependency chain**: it consumes `AnalisisCabidaComercial.demografia` (Phase 17, `DemografiaYConsumo` — designed in `17-03-PLAN.md`, not yet built) and `AnalisisCabidaComercial.competencia` (Phase 18, `ResultadoCompetenciaFormato` — **already built and real**, `lib/competencia-formato.ts`) plus `AnalisisCabidaComercial.isocrona` (Phase 16, `IsocronaResultado` — designed, not yet built) and the tab file itself (`cabida-comercial-tab.tsx`, Plan 16-05 — not yet built). As of this research (2026-08-03), **none of `lib/cabida-comercial-server.ts`, `lib/isocrona-server.ts`, or the tab component exist on disk** — verified directly (`ls` returned "No such file or directory" for all three). Phase 16 is paused on an external HeiGIT/ORS 403 issue, per founder decision, and Phase 17/18's own final wiring plans (17-03, 17-04, 18-07, 18-08) are themselves gated on Phase 16 and have already run their Task-1 gate-checks and stopped cleanly (see `17-03-SUMMARY.md`, `.planning/STATE.md`).

This means Phase 19 cannot be planned as "read the real files and extend them" the way 17-04/18-08 partially could (their target tab file, at time of their own planning, also didn't exist — they're gated the same way this phase must be). The correct posture, confirmed by the two most recent successful precedents in this exact codebase (Phase 17's 17-03/17-04, Phase 18's 18-07/18-08), is: **plan against the documented type contracts** (`lib/cabida-comercial.ts`'s real, already-committed `AnalisisCabidaComercial`/`ResultadoCompetenciaFormato`/`CompetidorDetectado` types, plus `17-03-PLAN.md`'s documented-but-unbuilt `DemografiaYConsumo` shape, which itself borrows the exact field names of the two REAL, already-built files `lib/censo-manzana-server.ts`'s `PoblacionCensoResultado` and `lib/consumo-macro-zona.ts`'s `ConsumoEstimadoResultado`), split the work into an isolated, ungated pure-logic plan and one or more gated tab-integration plans, and use the identical "grep the prerequisite, halt/document if missing" pattern already proven twice.

**One critical scoping correction to the phase's own framing:** CABI-02 ("tab appears as 5th tab, on-demand") is **not a task this phase needs to perform from scratch**. Reading `16-05-PLAN.md`, `17-04-PLAN.md`, and `18-08-PLAN.md` in full confirms Plan 16-05 (Phase 16) already creates `cabida-comercial-tab.tsx` as the 5th `<TabsTrigger>`/`<TabsContent>` pair on `oportunidades/[id]/page.tsx`, on-demand via its own `useEffect`+`fetch()`, cloning `ResumenTab`'s exact shape — and 17-04/18-08 (already-queued, gated plans in earlier phases) extend that same file, they don't recreate it. By the time Phase 19's plans execute (whenever Phase 16 unblocks), CABI-02 will already be satisfied by prior work. **Phase 19's job re: CABI-02 is verification-only — confirm the tab still exists, is still on-demand, and hasn't regressed — never a creation task.** This mirrors exactly what `16-RESEARCH.md`'s own Open Question 1 predicted for Phase 19's relationship to the tab.

**Primary recommendation:** Split Phase 19 into (a) one **ungated** plan building `calcularVeredictoCabida()` as a pure function in a new `lib/veredicto-cabida.ts`, fully unit-tested against hand-built fixtures — buildable and testable today, zero upstream dependency; (b) one **ungated** plan building `components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-mapa.tsx`, a Leaflet map component cloning `zonificacion-mapa.tsx`'s structure, testable in isolation with fixture GeoJSON + fixture pins (no live data needed — same "build the display component against a fixture" move already proven safe for pure logic in this phase); (c) one or more **gated** plans (cloning the exact 17-03/17-04/18-07/18-08 two-and-three-way gate pattern) that wire the verdict function + map + methodology section into the real tab, activating only once Phase 16 (tab file + isocrona) AND Phase 17 (`demografia` field) AND Phase 18 (`competencia` field, already real) all exist in the actual codebase.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet (existing, via `leaflet` npm package already installed for Phase 11) | already in project | Render isochrone/radius polygon + competitor pins | Only Leaflet integration in the codebase (`components/proyecto/zonificacion-mapa.tsx`) — clone its pattern verbatim (dynamic `import("leaflet")`, `L.geoJSON()`, `L.divIcon()`), don't introduce a second mapping library. CSP `img-src` already permits `https://*.tile.openstreetmap.org` (`next.config.ts:15`) — no config change needed. |
| TypeScript pure functions (no new dependency) | n/a | `calcularVeredictoCabida()` | This codebase's established pattern for scoring/synthesis logic that must be testable without network (`calcularResultadoCompetencia()` in `lib/competencia-formato.ts`, `evaluarOportunidad()` in `lib/mercado-locales-server.ts`, the `veredictoDe()` family in `lib/cuadros-calculo.ts`) — always a pure function, always unit-testable against a hand-built input object, never mixed with I/O. |
| Vitest (existing test runner) | already in project | Unit tests for the verdict function against a hand-built `AnalisisCabidaComercial` fixture | Same tool already used for `calcularResultadoCompetencia()`'s TDD RED→GREEN→REFACTOR cycle (18-05-SUMMARY.md) — the precedent this phase's verdict logic should follow, not reinvent. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@turf/turf` (NOT currently an npm dependency — confirmed absent from `package.json` at time of Phase 16 research; Phase 16/17 may or may not have added it by the time Phase 19 executes) | latest if added | Only if the map component needs to compute/validate a bounding box or centroid client-side beyond what `L.geoJSON(...).getBounds()` already gives (see `zonificacion-mapa.tsx` line 50-51, which uses Leaflet's own `.getBounds()`/`.fitBounds()`, not turf, for this exact need) | Likely NOT needed for MAPA-01 — `zonificacion-mapa.tsx`'s existing pattern computes bounds without turf. Only pull in turf if a genuine geometry-math need appears during implementation that Leaflet's own API can't cover. |

### Alternatives Considered

Not re-litigated — Leaflet was already the milestone-level and Phase-16-level decision (`STACK.md`, `16-RESEARCH.md`), consistent with the one existing map integration in this codebase. No alternative mapping library was evaluated for this phase; introducing a second one (e.g. Mapbox GL) would be a new, unjustified dependency for a domain this codebase has already solved once.

**Installation:**
```bash
# No new npm installs required — leaflet is already a dependency (Phase 11),
# @turf/turf only if a genuine need appears (see above), Vitest already in project.
```

## Architecture Patterns

### Recommended File Structure

```
lib/
├── veredicto-cabida.ts                              # NEW — pure calcularVeredictoCabida(), zero I/O, zero upstream runtime dependency
├── cabida-comercial.ts                               # MODIFIED (gated plan only) — add VeredictoCabida type, once demografia/competencia both exist for real
components/mercado-inmobiliario/oportunidad-detalle/
├── cabida-comercial-tab.tsx                          # MODIFIED (gated plan only) — add veredicto section, methodology section, map — file is OWNED by Plan 16-05, never recreated here
├── cabida-comercial-mapa.tsx                          # NEW — Leaflet component, clone of components/proyecto/zonificacion-mapa.tsx's structure, buildable/testable standalone
tests/unit/
├── veredicto-cabida.test.ts                           # NEW — hand-built AnalisisCabidaComercial fixtures, no network, no upstream dependency
```

### Pattern 1: The verdict function signature and inputs — designed against the REAL committed types

**What:** A pure function `calcularVeredictoCabida(analisis: AnalisisCabidaComercial): VeredictoCabida` (per-call, one format at a time — `analisis.formato` is already a field on the real `AnalisisCabidaComercial`, no need to pass `formato` separately).

**Why this signature and not `(demografia, competencia, formato)`:** `AnalisisCabidaComercial` is the single object the tab already fetches (`consultarCabidaComercial()` → `{ubicacion, analisis}`) and the object every consumer (17-04's demografía section, 18-08's competencia section) already destructures from `data.analisis`. Taking the whole `AnalisisCabidaComercial` as input — not its two sub-fields separately — means the function signature is stable across whichever of `demografia`/`competencia` happens to be populated on a given day, and mirrors `calcularResultadoCompetencia(competidores, formato)`'s own precedent of taking the smallest sufficient slice of real, typed data, not a loosely-shaped bag of primitives.

**Real, already-committed input shape (verified by direct `Read` of `lib/cabida-comercial.ts`, `lib/competencia-formato.ts`, `lib/censo-manzana-server.ts`, `lib/consumo-macro-zona.ts` — none of this is inferred from a plan file):**

```typescript
// lib/cabida-comercial.ts — REAL, already committed (Phase 18)
export interface AnalisisCabidaComercial {
  formato: FormatoComercial
  isocrona: IsocronaResultado          // REAL type, not yet populated by a live obtenerAnalisisCabidaComercial() (Phase 16 not built) but the TYPE exists
  competencia?: ResultadoCompetenciaFormato   // REAL, Phase 18 — optional until 18-07 wires it
  // demografia?: DemografiaYConsumo   // NOT YET in this file — 17-03 (gated, not executed) is what adds it
  generadoEl: string
}

// lib/competencia-formato.ts — REAL, already committed (Phase 18)
export interface ResultadoCompetenciaFormato {
  formato: FormatoComercial
  competidores: CompetidorDetectado[]   // each has lat, lng, distanciaM, confianza, fuente, nombre — CONFIRMED has lat/lng (see Pattern 3 below, no gap here)
  coberturaConocida: boolean            // ALWAYS false in v1.7 — hard-capped by calcularResultadoCompetencia()
  confianzaGlobal: NivelConfianza       // 'alta' | 'media' | 'baja' — ALREADY hard-capped at 'media' (TOPE_CONFIANZA_GLOBAL constant), never 'alta' in v1.7
  disclosure: string                    // always non-empty, human-readable
  consultadoEl: string
}

// lib/censo-manzana-server.ts — REAL, already committed (Phase 17, Plan 17-01)
export interface PoblacionCensoResultado {
  ok: boolean
  totalPersonas: number
  totalViviendas: number
  manzanasIntersectadas: number
  comunasTocadas: string[]
  censoAno: 2017
  fuente: 'INE Censo 2017 — manzana censal'
  consultadoEl: string
  paginado: boolean
  error?: string
}

// lib/consumo-macro-zona.ts — REAL, already committed (Phase 17, Plan 17-02)
export interface ConsumoEstimadoResultado {
  categorias: EpfCategoria[]            // { nombre: string; participacionPct: number | null }
  categoriasPendientes: string[]
  tasaPobrezaComunal: number | null
  disclosure: string                    // "estimado agregado a nivel macro-zona..." — DEMO-02's literal text
  epfAno: 2022                          // typeof EPF_ANO
  casenAno: 2024                        // typeof CASEN_ANO
}

// DemografiaYConsumo — DOCUMENTED in 17-03-PLAN.md, NOT YET in lib/cabida-comercial.ts.
// This exact shape (composing the two REAL types above) is the documented contract
// Phase 19 must plan against:
export interface DemografiaYConsumo {
  poblacion: PoblacionCensoResultado
  consumo: ConsumoEstimadoResultado
}
```

**What the verdict function needs from each field, and what it does when a field is absent (the load-bearing design question for this phase):**

- `analisis.competencia` — REAL today. If present: `competidores.length`, `confianzaGlobal`, `coberturaConocida` (always `false` in v1.7) feed the "oferta" side. If `undefined` (a real possibility — 17-04/18-08's own Task 2 code explicitly handles `analisis.competencia === undefined` as a live case that "can occur if Phase 16/18-07 didn't populate the field in some intermediate deploy" — not just a Phase-19-planning-time hypothetical, an ongoing runtime possibility this exact codebase already designed for): the verdict MUST degrade to the "evidencia insuficiente para concluir" state, never silently proceed as if competencia were zero-and-confirmed.
- `analisis.demografia` — NOT YET a field on the real type (17-03 not executed). Design the verdict function's TypeScript signature to accept `analisis: AnalisisCabidaComercial & { demografia？: DemografiaYConsumo }` (or, if the gated wiring plan runs after 17-03 has landed, the real `AnalisisCabidaComercial` will already include `demografia?` and no intersection type is needed — confirm against the real file at implementation time, don't hardcode an assumption). Same discipline as competencia: `demografia === undefined` → degrade to "evidencia insuficiente", never fabricate a population-based confidence gate.
- `analisis.isocrona.metodo` — REAL type, always present (`'red_vial' | 'circulo_equivalente'`, non-optional per Phase 16's own Pitfall-1 discipline). `circulo_equivalente` must cap the verdict's overall confidence, exactly as `18-RESEARCH.md`'s Pitfall 2 already established for isochrone degradation generally — the verdict function is the natural place to enforce this cap centrally, rather than relying on every caller to remember it.

**The 3-state verdict enum — pick literal, citable state names now, don't leave them to be improvised in the gated plan:**

```typescript
export type VeredictoEstado =
  | 'evidencia_de_espacio'
  | 'mercado_parece_cubierto'
  | 'evidencia_insuficiente'
  // Names taken directly from ROADMAP.md's own phase description ("evidencia
  // de espacio" / "mercado parece cubierto" / "evidencia insuficiente para
  // concluir") — do not invent different wording; this text is the phase's
  // own literal success-criteria language.

export interface VeredictoCabida {
  estado: VeredictoEstado
  confianza: NivelConfianza          // REUSE the type from lib/cabida-comercial.ts — already 'alta'|'media'|'baja', already used by ResultadoCompetenciaFormato.confianzaGlobal — do not invent a second confidence enum
  gapScore: number | null            // null when insufficient evidence to compute one at all — see Pattern 2
  explicacion: string                // human-readable, cites which inputs drove the verdict (competencia count, demografia presence, isocrona metodo) — this is NOT the same string as metodologia (Pattern 4), this is verdict-specific reasoning
  generadoEl: string
}
```

### Pattern 2: Gap score as an explicit density proxy, never a leakage index (VERE-04)

**What:** `gapScore` is a **relative, unitless number** (e.g., competitor count per 1,000 estimated residents in the isochrone, or an equivalent ratio) — a proxy for "how saturated does this look," never a currency figure, never a "% of demand captured" figure (that would require the calibrated Huff model or real sales data this milestone's `REQUIREMENTS.md` Out-of-Scope table explicitly rules out).

**Why this specific framing:** `REQUIREMENTS.md`'s Out of Scope table already gives the load-bearing reason this can't be a real leakage/surplus index: "No existe en Chile un equivalente al Economic Census of Retail Trade (ventas reales por categoría y comuna)" — there is no real sales/demand-captured number to compare supply against, only population count (real, isochrone-precise, per Phase 17) and competitor count (real, isochrone-filtered, per Phase 18). A density ratio between those two counts is honest; presenting it with leakage/surplus vocabulary (or CLP units, or a "% market share available" framing) would fabricate a precision the underlying data doesn't support — exactly Pitfall 1 from `PITFALLS.md` ("precisión fabricada por interpolación silenciosa"), applied to the gap score specifically.

**Concrete formula recommendation (MEDIUM confidence — this is a genuine design judgment call, not a verified external standard):**
```typescript
// Only computable when BOTH demografia.poblacion.ok and competencia are present
// and non-degraded enough to trust — otherwise gapScore stays null (see below).
const competidoresPor1000Habitantes =
  (competencia.competidores.length / demografia.poblacion.totalPersonas) * 1000

// Lower ratio → more room (evidencia_de_espacio candidate)
// Higher ratio → market looks saturated (mercado_parece_cubierto candidate)
// Exact thresholds: NOT independently verified against any Chilean retail-
// density benchmark in this research pass (STACK.md/PITFALLS.md already flag
// that no single official Chilean supermarket-format-size standard exists —
// same absence-of-standard applies to density thresholds). Recommend the
// planner treat specific cutoff numbers as a placeholder needing explicit
// founder sign-off before shipping, OR frame the verdict text around the
// ratio's magnitude qualitatively ("X competidores por cada 1.000 habitantes
// en el área — [alto/moderado/bajo] respecto a la densidad típica de
// [formato]") rather than a hardcoded numeric cutoff presented as precise.
```

**When `gapScore` must be `null` (never a fabricated 0 or a fabricated "average"):**
- `demografia` is `undefined`, OR `demografia.poblacion.ok === false`, OR `demografia.poblacion.manzanasIntersectadas === 0` (real "no coverage" case already modeled by Phase 17's type, per `17-04-PLAN.md`'s own UI handling of this exact case).
- `competencia` is `undefined`.
- In any of these cases, `estado` should be `'evidencia_insuficiente'` and `gapScore: null` — never a gap score computed from a partial input with the missing piece silently treated as zero.

### Pattern 3: Map component — clone `zonificacion-mapa.tsx`'s structure exactly, adapt geometry + add pins

**What:** New `cabida-comercial-mapa.tsx`, NOT an extension of `zonificacion-mapa.tsx` (different domain — isochrone/radius polygon + competitor pins vs. a single PRC zoning polygon; `16-RESEARCH.md`'s own Architecture research already recommended "a new `cabida-comercial-mapa.tsx` following the same structure, not extending this one" for exactly this reason).

**Confirmed prop-shape mapping against real, already-committed types:**
```typescript
// zonificacion-mapa.tsx's real props (read in full):
interface ZonificacionMapaProps {
  lat: number | null
  lng: number | null
  geometria: ZonaPolygon | null   // { type: "Polygon"; coordinates: number[][][] }
  className?: string
}

// cabida-comercial-mapa.tsx's props — direct adaptation:
interface CabidaComercialMapaProps {
  lat: number
  lng: number                                          // ubicacion.lat/lng — always present once analisis exists, no need for the null-guard zonificacion-mapa.tsx has (that guard exists because a proyecto may not be geocoded yet; a resolved UbicacionCabida always has lat/lng by construction)
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon    // analisis.isocrona.geometria — REAL field, already typed, MultiPolygon support already accounted for (zonificacion-mapa.tsx's ZonaPolygon type does NOT support MultiPolygon — cabida-comercial-mapa.tsx MUST, since IsocronaResultado.geometria is typed Polygon | MultiPolygon from day one)
  competidores: CompetidorDetectado[]                  // analisis.competencia?.competidores ?? [] — CONFIRMED has lat/lng (see below)
  className?: string
}
```

**Confirmed: `CompetidorDetectado` DOES have `lat`/`lng` on every entry, not just some — no gap to design around.** Direct read of `lib/cabida-comercial.ts`:
```typescript
export interface CompetidorDetectado {
  nombre: string
  formato: FormatoComercial
  fuente: FuenteCompetidor       // 'osm' | 'seed_list' | 'sii_geocodificado'
  lat: number                    // NOT optional, NOT nullable
  lng: number                    // NOT optional, NOT nullable
  distanciaM: number
  confianza: NivelConfianza
  direccionLabel?: string
}
```
This resolves the phase-context's flagged open question ("some may not have lat/lng per COMPE-04's seed list having some `lat: null` entries") — that concern describes an *intermediate data-source* possibility (a seed-list row before geocoding), not the final `CompetidorDetectado` type the map consumes: by the time a competitor reaches `ResultadoCompetenciaFormato.competidores`, it has already been through `obtenerCompetidoresSeedList()`/`obtenerCompetidoresOverpass()`/the SII geocoding cross-match (`lib/competencia-formato.ts`, read in full) and the type system guarantees `lat`/`lng` are non-null numbers on every entry that made it into the array. No defensive null-handling is needed in the map component for this field — trust the type.

**Rendering pattern (clone `zonificacion-mapa.tsx` lines 27-59 almost verbatim):**
```typescript
void import("leaflet").then((L) => {
  const map = L.map(containerRef.current).setView([lat, lng], 15)  // wider default zoom than zonificación's 17 — isochrones cover more area than a single parcel
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { /* same attribution */ }).addTo(map)

  // Origin marker — same blue dot pattern as zonificacion-mapa.tsx
  L.marker([lat, lng], { icon: markerIcon }).addTo(map)

  // Isochrone/radius polygon — same L.geoJSON() call, different fill color to distinguish from zoning use
  const areaLayer = L.geoJSON(geometria as GeoJSON.Geometry, {
    style: { color: "#16a34a", weight: 2, fillOpacity: 0.10 },  // distinct color from zonificación's blue, avoid visual confusion between the two map types if a user has both tabs open in memory
  }).addTo(map)

  // Competitor pins — NEW, not in zonificacion-mapa.tsx
  const pinIcon = L.divIcon({
    className: "",
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#dc2626;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></div>',
    iconSize: [12, 12], iconAnchor: [6, 6],
  })
  competidores.forEach((c) => {
    L.marker([c.lat, c.lng], { icon: pinIcon }).bindPopup(`${c.nombre} — ${formatearDistancia(c.distanciaM)}`).addTo(map)
  })

  // Fit bounds to the isochrone polygon (not the pins) — the area of
  // influence is the primary framing, pins are detail within it
  const bounds = areaLayer.getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [16, 16] })
})
```

**Buildable and testable TODAY, zero upstream dependency:** unlike the verdict function's real inputs (which need `demografia`/`competencia` to exist for a live end-to-end test, though the function itself can be unit-tested against fixtures), the map component takes plain GeoJSON + an array of `{lat, lng, nombre, distanciaM}` objects as props — these can be hand-constructed (a fixture polygon around any real Santiago coordinate, 3-4 fixture pins) and rendered in isolation (e.g., a throwaway dev page, or Storybook-style manual render) to verify the visual output, exactly as `zonificacion-mapa.tsx` itself was presumably verified during Phase 11. This is the second piece (alongside the verdict function) that Phase 19 can build and visually confirm without any of the three upstream phases being complete.

### Pattern 4: Methodology/sources section (VERE-03) — no existing component to reuse directly, but a clear pattern to clone

**Finding: `components/mercado-inmobiliario/informe/metodologia-informe.tsx` (`MetodologiaInforme`) exists but is NOT directly reusable — different domain, different props, different rendering context.** Read in full: it's a print-report component (Phase 15, v1.6) taking `fuentes: FuenteMetodologia[]` where each entry cites a `comuna`/`operacion`/`tipoPropiedad`/`bandas` (market-pricing data from `mercado_locales_stats_diarias`) — entirely about price-band provenance, nothing about census/competitor/isochrone provenance. Its props shape cannot accept Cabida Comercial's completely different source set (census date, scrape date, isochrone method/radius, unverifiable items).

**What DOES carry over — the pattern, not the code:**
- A dedicated `<section>` with a `border-t` divider and `text-xs font-semibold uppercase tracking-widest text-muted-foreground` heading ("Metodología y fuentes") — same visual treatment `MetodologiaInforme` already establishes for this exact heading text in this exact codebase, worth reusing verbatim for consistency even though the component itself isn't imported.
- Each cited fact rendered as its own line/bullet, not merged into a single paragraph — same discipline `MetodologiaInforme` uses (`fuentes.map(...)`, one `<li>` per source) and the same discipline Pitfall 7/DEMO-03 already established for this milestone (never combine vintages into one sentence).
- Amber-styled callouts (`text-amber-700`/`border-amber-200 bg-amber-50`) for "no data available" cases — same visual language already used across this exact tab by 17-04 (demografía disclosure) and 18-08 (competencia disclosure).

**What VERE-03 specifically requires the section to cite — mapped to REAL, already-typed fields (once the gated dependencies land):**

| VERE-03 requirement | Real field to cite | Already exists? |
|---|---|---|
| Fecha del censo | `analisis.demografia.poblacion.censoAno` (`2017`, literal) + `analisis.demografia.poblacion.consultadoEl` | Type designed (17-03-PLAN.md), not yet in `AnalisisCabidaComercial` |
| Fecha de scraping de competidores | `analisis.competencia.consultadoEl` | REAL, already on `ResultadoCompetenciaFormato` today |
| Radio/isócrona usado | `analisis.isocrona.modo` + `analisis.isocrona.minutos` + `analisis.isocrona.metodo` (`'red_vial'` vs `'circulo_equivalente'`) | REAL, already on `IsocronaResultado` today |
| Qué no se pudo verificar | Compose from: `analisis.competencia.disclosure` (Unimarc/Grupo Patio gaps, already a real string), `analisis.demografia.poblacion.paginado`/`manzanasIntersectadas === 0` (once 17-03 lands), `analisis.isocrona.metodo === 'circulo_equivalente'` (degradation), `analisis.demografia.consumo.categoriasPendientes` (EPF gaps, already a real string array once 17-03 lands) | Partially real today (competencia), rest designed |

**Recommendation:** this section should be a NEW small component (`components/mercado-inmobiliario/oportunidad-detalle/cabida-metodologia.tsx` or inlined directly in `cabida-comercial-tab.tsx` if short enough — decide by actual length once the gated plan writes it against the real file), not a repurposing of `MetodologiaInforme`. It composes strings and dates already present on `AnalisisCabidaComercial`'s sub-fields — it does not need new data fetches, only new rendering, once `demografia` is real.

### Pattern 5: Gating strategy — clone the exact 17-03/17-04/18-07/18-08 pattern, extended to three prerequisites

Phase 19's tab-integration plan(s) need to check for **three** independent things before touching `cabida-comercial-tab.tsx`, one more than any prior gated plan in this milestone (17-04/18-08 each only checked two):

```bash
ls components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-tab.tsx 2>/dev/null && echo "TAB EXISTE" || echo "TAB NO EXISTE"
ls app/api/cabida-comercial/analisis/route.ts 2>/dev/null && echo "RUTA EXISTE" || echo "RUTA NO EXISTE"
grep -n "demografia" lib/cabida-comercial-server.ts 2>/dev/null || echo "CAMPO demografia NO POBLADO (o archivo no existe)"
grep -n "competencia" lib/cabida-comercial-server.ts 2>/dev/null || echo "CAMPO competencia NO POBLADO (o archivo no existe)"
```

If ANY of the four checks fails: stop, document literally (not paraphrased) in the plan's SUMMARY, do not fabricate a stub or a parallel tab, note that re-running `/gsd:execute-phase 19` later picks this back up once Phase 16 AND 17-03 AND 18-07 are all complete. This is not a new pattern to invent — it is a direct, one-more-condition extension of the pattern `17-03-PLAN.md`/`17-04-PLAN.md`/`18-07-PLAN.md`/`18-08-PLAN.md` already used successfully twice in this exact milestone, including the exact literal wording precedent ("DETENER... NO crear... NO fabricar...").

**Important ordering nuance for the planner:** `competencia` is ALREADY real (Phase 18, `lib/competencia-formato.ts` exists and is tested) — but it is only wired INTO `obtenerAnalisisCabidaComercial()` by 18-07, which itself is gated on Phase 16's `lib/cabida-comercial-server.ts` existing. So even though the competencia LOGIC is done, the check must still be "does `competencia` appear in the real `lib/cabida-comercial-server.ts` file" (not "does `lib/competencia-formato.ts` exist") — same reasoning `18-07-PLAN.md`/`18-08-PLAN.md` already applied. Don't shortcut the check just because one of the two upstream pieces happens to be further along than the other.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 3-state confidence-capped classification logic | A new ad-hoc scoring pattern invented from scratch for this phase | Clone `calcularResultadoCompetencia()`'s exact discipline (`lib/competencia-formato.ts`): pure function, explicit `NIVEL_ORDEN` ranking, an explicit hard cap constant (`TOPE_CONFIANZA_GLOBAL`), never silently upgrading confidence | Already proven, already tested (18-05, TDD RED→GREEN→REFACTOR), directly analogous problem (competencia's own confidence degradation) |
| Verdict+confidence "always shown together" enforcement (VERE-02) | A convention documented only in a comment, trusted to be followed by every future call site | A single shared render path within `cabida-comercial-tab.tsx`'s verdict section — never a bare `estado` string interpolated into a headline without `confianza` alongside it in the same JSX block, same discipline `PITFALLS.md` Pitfall 6 already names for this exact codebase (`<VeredictoCabidaBadge veredicto confianza fuentes />`-style enforcement) | `PITFALLS.md` explicitly documents this class of bug as happening in copy/UI, not in calculation logic — a shared component/render block is the only enforcement mechanism that survives a future edit |
| Leaflet map from scratch | A new mapping abstraction, a different library, hand-rolled SVG polygon rendering | Clone `components/proyecto/zonificacion-mapa.tsx`'s dynamic-import + `L.geoJSON()` + `L.divIcon()` pattern | Only Leaflet integration in this codebase, already proven, CSP already configured for its exact tile host |
| Gap score as a real market-capture metric | Any Huff-model-style probability, any CLP-denominated leakage/surplus figure | A simple density ratio (competitor count / population), explicitly labeled as a proxy | `REQUIREMENTS.md`'s Out of Scope table already rules out the real version — a "smarter" implementation would be reintroducing exactly what was explicitly descoped |

**Key insight:** Every synthesis pattern this phase needs (confidence capping, always-paired verdict+confidence rendering, degraded-isochrone confidence propagation, gated-plan halting) already has a working precedent inside this exact milestone (Phase 18 for confidence capping, Phase 16/17/18's gate pattern for halting). The only genuinely new engineering surface is the verdict function's specific formula/thresholds (Open Question 1) and the map component (which is itself a close clone, not a new pattern).

## Common Pitfalls

### Pitfall 1: Treating `undefined` demografia/competencia the same as a real zero
**What goes wrong:** If the verdict function branches on `competencia?.competidores.length ?? 0` without first checking `competencia === undefined` as its own case, "field never fetched" and "field fetched, genuinely zero competitors" collapse into the same code path — reproducing the exact bug class `calcularResultadoCompetencia()` was built to prevent for competidores.length itself, but one layer up, for the field's very presence.
**Why it happens:** JS/TS's `??` operator makes this collapse trivially easy to write without noticing.
**How to avoid:** The verdict function's FIRST branch must be an explicit `if (!analisis.demografia || !analisis.competencia) return { estado: 'evidencia_insuficiente', confianza: 'baja', gapScore: null, ... }` — before any arithmetic touches either field.
**Warning signs:** Any line computing `gapScore` or `estado` that doesn't have a preceding explicit-undefined-check for both `demografia` and `competencia`.
**Phase to address:** This phase, first task of the verdict-function plan — write the undefined-guard test FIRST (TDD RED), matching Plan 18-05's own process.

### Pitfall 2: Gap score threshold numbers presented as if externally validated
**What goes wrong:** Because no official Chilean retail-density-per-capita standard was found in this research pass (same absence STACK.md/PITFALLS.md already documented for format-size classification), any specific numeric cutoff the verdict function uses (e.g., "< 2 per 1000 = evidencia_de_espacio") is this phase's own judgment call, not a cited external fact — presenting it in UI copy or code comments as if benchmarked risks the same "fabricated precision" pattern Pitfall 1 (PITFALLS.md) already flags for demographic figures, just applied to the scoring logic instead of the raw data.
**How to avoid:** Either (a) keep the ratio itself as the primary UI artifact ("X competidores por 1.000 habitantes") and use the classifier only internally/conservatively, framing any qualitative label ("bajo"/"alto") as this analysis's own judgment, explicitly not an industry benchmark — or (b) if the planner wants a numeric cutoff, document in the plan/commit message that it's a placeholder pending founder validation, not a researched constant.
**Phase to address:** Verdict-function plan, Task 1 (design), flagged again at the gated tab-integration plan (UI copy review).

### Pitfall 3: Rebuilding or duplicating `cabida-comercial-tab.tsx` because it "doesn't exist yet" at planning time
**What goes wrong:** Exactly the anti-pattern `17-04-PLAN.md`/`18-08-PLAN.md` already called out explicitly for their own gated plans: creating a parallel/stub tab file when the gate check fails produces an orphaned component that the REAL Plan 16-05 (whenever it runs) will either overwrite or conflict with.
**Why it happens:** Temptation to "make progress anyway" when a plan is blocked mid-execution.
**How to avoid:** Same explicit prohibition already proven twice in this milestone — the gate-check task's failure path must say, in as many words, "do not create this file," and the plan must end there.
**Phase to address:** This phase's gated plan(s), Task 1, same wording precedent as 17-03/17-04/18-07/18-08.

### Pitfall 4: Forgetting that `MultiPolygon` is a real, typed possibility for the isochrone geometry
**What goes wrong:** `zonificacion-mapa.tsx`'s own `ZonaPolygon` prop type only accepts `Polygon`, not `MultiPolygon` — if the new map component's prop type is copy-pasted without adjustment, a `MultiPolygon` isochrone (a real, already-typed possibility on `IsocronaResultado.geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon`) would fail to typecheck or, worse, silently render incorrectly if the type is loosely cast.
**How to avoid:** `CabidaComercialMapaProps.geometria` must be typed `GeoJSON.Polygon | GeoJSON.MultiPolygon` from the start (Leaflet's `L.geoJSON()` already handles both natively — no code change needed beyond the TypeScript prop type itself).
**Phase to address:** Map-component plan, Task 1.

## Code Examples

### Verdict function skeleton (composing REAL types, structured for TDD per Plan 18-05's precedent)
```typescript
// Source pattern: lib/competencia-formato.ts's calcularResultadoCompetencia() (read in full)
// lib/veredicto-cabida.ts (NEW)
import type { AnalisisCabidaComercial, NivelConfianza } from '@/lib/cabida-comercial'

export type VeredictoEstado = 'evidencia_de_espacio' | 'mercado_parece_cubierto' | 'evidencia_insuficiente'

export interface VeredictoCabida {
  estado: VeredictoEstado
  confianza: NivelConfianza
  gapScore: number | null
  explicacion: string
  generadoEl: string
}

export function calcularVeredictoCabida(analisis: AnalisisCabidaComercial): VeredictoCabida {
  const ahora = new Date().toISOString()

  // Guard FIRST — Pitfall 1
  if (!analisis.demografia || !analisis.competencia) {
    return {
      estado: 'evidencia_insuficiente',
      confianza: 'baja',
      gapScore: null,
      explicacion: 'No hay datos suficientes de demografía y/o competencia para este análisis.',
      generadoEl: ahora,
    }
  }

  if (!analisis.demografia.poblacion.ok || analisis.demografia.poblacion.manzanasIntersectadas === 0) {
    return {
      estado: 'evidencia_insuficiente',
      confianza: 'baja',
      gapScore: null,
      explicacion: 'El polígono del área de influencia no intersectó datos censales utilizables.',
      generadoEl: ahora,
    }
  }

  const gapScore = (analisis.competencia.competidores.length / analisis.demografia.poblacion.totalPersonas) * 1000

  // Confidence: never exceeds competencia.confianzaGlobal (already capped at 'media' in v1.7),
  // never exceeds 'media' when isocrona is degraded — compose, don't re-derive independently
  const isocronaDegradada = analisis.isocrona.metodo === 'circulo_equivalente'
  // ... threshold logic (Open Question 1) determines `estado` from gapScore + degradation + coverage flags
}
```
This is a **starting skeleton for the planner, not finished logic** — the exact threshold values that turn `gapScore` into `estado` are Open Question 1, not resolved by this research pass.

### Map component prop contract (adaptation, not copy, of the real `zonificacion-mapa.tsx`)
See Pattern 3 above — full code already given there.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| n/a — this is greenfield synthesis logic, no prior "old approach" in this codebase for retail gap-scoring specifically | Pure-function verdict composition over two already-independently-designed sub-analyses (demografia, competencia), each carrying its own confidence/vintage | Established by this milestone's own `ARCHITECTURE.md`/`STACK.md` (2026-08-02) and reinforced by Phase 18's real implementation of the per-sub-analysis confidence pattern | Phase 19 is the first phase to actually EXERCISE the "compose sub-analyses into one verdict" design the milestone-level research anticipated — treat Phase 18's `calcularResultadoCompetencia()` as the closest available "current approach" precedent, not an older one being replaced |

No deprecated/outdated findings apply — this is new domain logic, not a migration.

## Open Questions

1. **Exact gap-score-to-verdict-state threshold values.**
   - What we know: the density-ratio formula direction (lower ratio → more room, higher → more saturated) is sound and matches how ESRI/retail gap-analysis literature frames the concept generally (per milestone `SUMMARY.md`'s own framing of Cabida Comercial as "a public-data version of what ESRI Business Analyst sells"). No official Chilean retail-density-per-capita benchmark was found in this research pass, nor in the milestone-level research passes before it (same gap `STACK.md`/`PITFALLS.md` already flag for format-size standards).
   - What's unclear: the specific numeric cutoffs that separate `evidencia_de_espacio` from `mercado_parece_cubierto`.
   - Recommendation: the planner should treat this as a founder-facing decision, not a purely technical one — either ship with clearly-labeled provisional thresholds (documented as such in code comments and, ideally, in the UI copy itself — "umbral preliminar, sujeto a validación" is consistent with this project's "never overclaim precision" discipline) or surface the raw ratio to the user without a hard classification boundary, letting `estado` derive primarily from data-completeness/degradation (Pitfall 1/Pitfall 2 above) rather than from a precise numeric gap-score cutoff. Either resolves VERE-01/VERE-04 without fabricating a false precision.

2. **Does the verdict function belong in `lib/veredicto-cabida.ts` (new file) or as an addition to `lib/cabida-comercial.ts`?**
   - What we know: `lib/cabida-comercial.ts` is explicitly documented (its own file header) as "client-safe types + fetch helper" — a pure function with no I/O is technically client-safe and could live there. `lib/competencia-formato.ts` (Phase 18's structurally closest precedent) is its OWN separate file, not folded into `lib/cabida-comercial.ts`, despite also being pure/client-safe.
   - What's unclear: whether the codebase's convention is "one file per sub-analysis's pure logic" (favoring a new `lib/veredicto-cabida.ts`, mirroring `lib/competencia-formato.ts`) or "types+trivial-helpers in the shared file, larger logic modules separate" — both are consistent readings of the one precedent available.
   - Recommendation: new `lib/veredicto-cabida.ts`, mirroring `lib/competencia-formato.ts`'s precedent exactly (same milestone, same phase-relationship — competencia's logic lives apart from `cabida-comercial.ts`'s types, demografia's logic likewise lives in `lib/censo-manzana-server.ts`/`lib/consumo-macro-zona.ts` apart from the shared types file) — consistent, not a new call.

3. **Whether `VeredictoCabida` needs its own persistence/caching, or is always recomputed on read.**
   - What we know: `calcularResultadoCompetencia()` and (once built) any demografía composition are pure functions computed fresh from already-cached upstream data (`cabida_comercial_cache`'s `demografia`/`competencia` JSONB columns, per `16-RESEARCH.md`'s cache schema) — the verdict itself was never a cached field in any of the milestone-level or phase-level research documents reviewed.
   - What's unclear: whether `obtenerAnalisisCabidaComercial()` (once it exists) should call `calcularVeredictoCabida()` server-side and include `veredicto` in the JSON response, or whether the tab computes it client-side from the already-fetched `analisis` object.
   - Recommendation: compute server-side, inside `obtenerAnalisisCabidaComercial()`'s composition step (same place `demografia`/`competencia` themselves get composed, per 17-03/18-07's own Task 2 pattern) — cheap, deterministic, no reason to duplicate the logic client-side, and keeps `AnalisisCabidaComercial.veredicto` as a single first-class field the tab simply renders, exactly as it already does for `isocrona`/`competencia`. This does mean the gated tab-integration plan's Task list should include one more small step (adding `veredicto: calcularVeredictoCabida(analisis)` to the composition in `lib/cabida-comercial-server.ts`) alongside rendering it — flag this for the planner so it isn't missed as "just a UI task."

## Sources

### Primary (HIGH confidence — direct codebase inspection, 2026-08-03)
- `lib/cabida-comercial.ts` (read in full) — REAL, current `AnalisisCabidaComercial`/`ResultadoCompetenciaFormato`/`CompetidorDetectado`/`FormatoComercial`/`NivelConfianza` types, confirms `competencia?` is the only sub-analysis field present today, confirms `CompetidorDetectado.lat`/`.lng` are non-optional
- `lib/competencia-formato.ts` (read in full) — REAL `calcularResultadoCompetencia()`, the confidence-capping/disclosure precedent this phase's verdict logic should mirror
- `components/proyecto/zonificacion-mapa.tsx` (read in full) — the only Leaflet integration in this codebase, direct clone target for MAPA-01
- `components/mercado-inmobiliario/informe/metodologia-informe.tsx` (read in full) — confirmed NOT directly reusable (different props/domain), but confirms the visual pattern (heading style, per-source bullet, amber callout for missing data) to replicate
- `components/arch/estado.tsx` (read in full) — confirms this codebase's existing "verdict+label rendered together, forced by a single shared component" precedent (`EstadoNormativo`), the exact enforcement mechanism `PITFALLS.md` Pitfall 6 recommends for VERE-02, though for a different domain (DOM compliance, not retail siting) — pattern to emulate, type NOT to reuse (different value set)
- `lib/censo-manzana-server.ts`, `lib/consumo-macro-zona.ts` (read in full) — REAL, already-committed `PoblacionCensoResultado`/`ConsumoEstimadoResultado` types that `DemografiaYConsumo` (17-03-PLAN.md's documented, not-yet-built contract) composes
- `.planning/phases/17-demografia-y-consumo/17-03-PLAN.md`, `17-04-PLAN.md` (read in full) — documented `DemografiaYConsumo` contract and the exact two-prerequisite gate pattern
- `.planning/phases/18-competencia-por-formato/18-07-PLAN.md`, `18-08-PLAN.md` (read in full) — documented gate pattern (repeated a second time in this milestone) and confirmed `competencia`'s real shape/UI-rendering precedent
- `.planning/phases/16-ubicacion-e-isocrona-motor-desacoplado/16-RESEARCH.md`, `16-05-PLAN.md` (read in full) — confirms `cabida-comercial-tab.tsx`'s planned/documented structure (not yet built), confirms CABI-02 is Plan 16-05's job not Phase 19's, confirms the `ResumenTab` on-demand pattern
- `.planning/REQUIREMENTS.md` (read in full, v1.7 section) — verbatim VERE-01→04/MAPA-01/CABI-02 text and the Out of Scope table backing VERE-04's "never a leakage index" constraint
- `.planning/STATE.md` (Current Position + Phases Status sections, read) — confirms live blocked status of Phase 16/17-03/17-04/18-07/18-08 as of 2026-08-03, confirms `competencia` (Phase 18 logic) is done but not yet wired
- `next.config.ts` (grepped) — confirms CSP `img-src` already includes `https://*.tile.openstreetmap.org`, no config change needed for MAPA-01
- Live filesystem check (`ls`, 2026-08-03): confirmed `lib/cabida-comercial-server.ts`, `lib/isocrona-server.ts`, `components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-tab.tsx` all do NOT exist yet; confirmed `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` currently has exactly 4 tabs (posicionamiento/resumen/historial/comparables), no 5th
- `.planning/data-sources.yaml` (grepped for relevant entry IDs) — confirms `ine-censo-2017-manzana`, `epf-casen-consumo-estimado`, `sii-nomina-sucursales`, `strip-power-centers-chile-seed` entries exist as citable source IDs for the methodology section

### Secondary (MEDIUM confidence)
- `.planning/research/{SUMMARY,ARCHITECTURE,STACK,PITFALLS}.md` (read in full) — milestone-level research, treated as settled per task instructions, cited for VERE-04's design rationale and Pitfall 6's verdict+confidence-together precedent; not re-litigated

### Tertiary (LOW confidence)
- None — this research pass relied entirely on direct codebase inspection and already-committed milestone/phase research, no external web sources were needed for a phase that is primarily internal synthesis logic

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Leaflet/Vitest/pure-TS-function choices are direct continuations of already-proven, already-committed patterns in this exact codebase, no new library decisions
- Architecture: HIGH — every integration point (file paths, type shapes, gate pattern) verified against real, currently-committed code or against plan files whose own precedent has already executed successfully twice this milestone (17-03/18-07 gate halts, matching SUMMARY.md/STATE.md evidence)
- Pitfalls: MEDIUM-HIGH — the "undefined vs zero" and "gate-halt discipline" pitfalls are HIGH confidence (directly precedented, twice, in this exact codebase); the gap-score-threshold pitfall is MEDIUM (a genuine, not-yet-resolved design judgment call, correctly flagged as such rather than answered with false confidence)

**Research date:** 2026-08-03
**Valid until:** ~30 days for the architecture/integration findings (stable, code-verified against real files). Re-verify the "what exists on disk" checks (Pattern 5) immediately before planning executes, regardless of how much time has passed — Phase 16/17/18 are actively in-progress and their gate status can change at any time; this document's specific "does not exist yet" claims are a snapshot as of 2026-08-03, not a permanent fact.
