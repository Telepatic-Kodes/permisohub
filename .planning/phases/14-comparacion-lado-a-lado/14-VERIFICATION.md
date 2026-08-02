---
phase: 14-comparacion-lado-a-lado
verified: 2026-08-02T22:00:00Z
status: passed
score: 12/12 must-haves verified
---

# Phase 14: Comparación Lado a Lado Verification Report

**Phase Goal:** El arquitecto/inversionista puede poner 2 a 5 oportunidades comparables una al lado de la otra y ver de inmediato cuál conviene más por atributo, sin poder mezclar por error tipos de propiedad u operaciones distintas.
**Verified:** 2026-08-02
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (aggregated from 14-01/14-02/14-03 PLAN.md frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `obtenerOportunidadPorId(id)` behavior unchanged after extraction | ✓ VERIFIED | `lib/mercado-locales-server.ts:708-731` — signature/null-handling untouched, delegates to `construirOportunidadDetalle()` |
| 2 | Comparing up to 5 opportunities does 1 listings query + 1 price-history query + at most 1 bandas query per distinct comuna×tipoPropiedad×operacion | ✓ VERIFIED | `lib/mercado-locales-server.ts:747-789` — single `.in('id', ids)` (line 755), single `.in('listing_id', ids)` (line 763), `bandasCache` Map keyed by `comuna\|tipoPropiedad\|operacion` (lines 773-778) |
| 3 | User sees a checkbox per opportunity in `/oportunidades` list | ✓ VERIFIED | `components/mercado-inmobiliario/selector-comparacion.tsx:50-55` — `<Checkbox>` per card |
| 4 | User cannot check a 6th opportunity once 5 are selected | ✓ VERIFIED | `selector-comparacion.tsx:45,53` — `disabled = !checked && selectedIds.length >= MAX_SELECCION(5)`, plus defensive guard in `toggle()` (line 34) |
| 5 | "Comparar (N)" button appears with 2+ selected, absent with 0-1 | ✓ VERIFIED | `selector-comparacion.tsx:104` — `{selectedIds.length >= 2 && (...)}` |
| 6 | Click on "Comparar" navigates to `/comparar?ids=id1,id2,...` | ✓ VERIFIED | `selector-comparacion.tsx:108` — `router.push(...comparar?ids=${selectedIds.join(",")})` |
| 7 | `/comparar?ids=` (2-5 valid uuids) renders a table columns=opportunities, rows=attributes | ✓ VERIFIED | `comparar/page.tsx:132-142` renders `<TablaComparacion>`; `tabla-comparacion.tsx:62-186` — TableHead per opportunity, TableRow per attribute |
| 8 | Best value highlighted ONLY on Precio UF / Precio UF/m² / % vs. mediana rows; Superficie/Días publicado never highlighted | ✓ VERIFIED | `tabla-comparacion.tsx:38-58` computes `mejorPrecioUfId`/`mejorPrecioUfM2Id`/`mejorDesviacionId` and applies `CELL_MEJOR_VALOR` only in rows 88-115; Superficie (119-125) and Días publicado (128-138) rows never reference these ids |
| 9 | Mixed tipoPropiedad/operacion in `?ids=` never renders the table — explicit error | ✓ VERIFIED | `comparar/page.tsx:97-108` — `new Set(...).size > 1` check returns `<MensajeError>` before any `<TablaComparacion>` render, executed unconditionally regardless of entry path |
| 10 | `<2` or `>5` valid ids shows explicit message, never a crash | ✓ VERIFIED | `comparar/page.tsx:64-73` (range check pre-fetch) and `80-90` (post-fetch existence check) both return `<MensajeError>` with return-early, before `.map()` in `TablaComparacion` |
| 11 | Non-existent id excluded with "N of M" banner; `dado_de_baja` id included with badge | ✓ VERIFIED | `comparar/page.tsx:78-90,134-138` (faltantes banner); `tabla-comparacion.tsx:75-79` (Badge "Dado de baja") |
| 12 | "Rentabilidad implícita de zona" row shown with "Estimado de zona" badge, never highlighted as best | ✓ VERIFIED | `tabla-comparacion.tsx:167-184` — no `idConMenorValor` call for this row; `comparar/page.tsx:110-129` computes it once per distinct comuna |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mercado-locales-server.ts` | `construirOportunidadDetalle()` internal helper + exported `obtenerOportunidadesPorIds` | ✓ VERIFIED | Helper at line 640 (not exported); `obtenerOportunidadesPorIds` exported at line 747 |
| `components/mercado-inmobiliario/selector-comparacion.tsx` | Client island, checkbox + cap 5 + floating button + router.push | ✓ VERIFIED | `"use client"` line 1; full implementation present |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` | Uses `<SelectorComparacion>` instead of inline card mapping | ✓ VERIFIED | Imported line 11, rendered line 116-120 |
| `components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx` | Presentational Server Component, `export function TablaComparacion` | ✓ VERIFIED | Line 34 `export function TablaComparacion` |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx` | Server Component, parses/dedupes/validates ids, calls `obtenerOportunidadesPorIds`, validates range+homogeneity before render | ✓ VERIFIED | Full cascade present lines 49-143; `new Set(` present (3 uses beyond the dedup Set) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `obtenerOportunidadPorId()` | `construirOportunidadDetalle()` | direct call | ✓ WIRED | line 730 |
| `obtenerOportunidadesPorIds()` | `construirOportunidadDetalle()` | 1 call per listing inside `.map()` | ✓ WIRED | line 786 |
| `obtenerOportunidadesPorIds()` | `mercado_locales_listings` / `historial_precio` | single `.in('id', ids)` / `.in('listing_id', ids)` | ✓ WIRED | lines 755, 763 — no per-id loop |
| `selector-comparacion.tsx` | `/oportunidades/comparar` | `router.push(...ids=...)` | ✓ WIRED | line 108 |
| `oportunidades/page.tsx` | `selector-comparacion.tsx` | import + `<SelectorComparacion oportunidades=... />` | ✓ WIRED | lines 11, 116-120 |
| `comparar/page.tsx` | `obtenerOportunidadesPorIds()` (Plan 14-01) | `await obtenerOportunidadesPorIds(idsValidos)` | ✓ WIRED | line 76 |
| `comparar/page.tsx` | homogeneity validation | `new Set(oportunidades.map(o => o.tipoPropiedad/operacion)).size === 1` | ✓ WIRED | lines 97-108, blocks before render |
| `comparar/page.tsx` | `tabla-comparacion.tsx` | `<TablaComparacion oportunidades=... rentabilidadPorComuna=... />` | ✓ WIRED | line 140, only reachable after all validations |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|-----------------|
| COMPA-01 (select 2-5 same tipo/operacion) | ✓ SATISFIED | checkbox selection + cap-of-5 in list, homogeneous by construction (list is pre-filtered to one tipo/operacion per render) |
| COMPA-02 (table, columns=properties, rows=attributes, best highlighted) | ✓ SATISFIED | `TablaComparacion` renders 7 rows × N columns with correct-direction highlighting |
| COMPA-03 (structural prevention of mixing tipo/operacion) | ✓ SATISFIED | Real defense is server-side `new Set(...)` check in `comparar/page.tsx`, executed unconditionally regardless of entry point (checkbox is only UX layer 1) |
| COMPA-04 (selection persists in URL) | ✓ SATISFIED | `?ids=` is the only state; page is a Server Component reading `searchParams`, reloadable/shareable |

Note: `.planning/REQUIREMENTS.md` still lists COMPA-01..04 as "Pending" (lines 60-63) — this is a documentation-sync lag, not a code gap; STATE.md already marks Phase 14 as ✅ Completa. Flagged for the orchestrator to update REQUIREMENTS.md status, not a phase-goal blocker.

### Anti-Patterns Found

None. Scanned all 5 modified/created files for TODO/FIXME/XXX/HACK/placeholder/empty-implementation patterns — no matches (the two `grep` hits were a legitimate HTML `placeholder=` attribute and the Spanish word "TODO" inside a comment, not markers of incomplete work).

### Human Verification Required

None outstanding — Task 3 of Plan 14-03 was a `checkpoint:human-verify` gate and was already completed and approved live by the user per 14-03-SUMMARY.md (8-step end-to-end walkthrough including the critical homogeneity-via-manual-URL test).

### Gaps Summary

No gaps found. All 12 must-have truths across the 3 plans are verified against actual code, not just SUMMARY claims:

- **Data layer (14-01):** `obtenerOportunidadesPorIds()` does exactly 1 listings query + 1 history query + a bandas cache keyed by the full comuna|tipo|operacion combination — confirmed by reading the query code directly (single `.in()` calls, no loop). `obtenerOportunidadPorId()`'s public behavior is provably unchanged (same fetch + delegate pattern).
- **Selector (14-02):** Checkbox, 5-cap, floating button, and URL navigation are all present with correct guard logic (both in `toggle()` state and in the `disabled` prop).
- **Route + table (14-03):** The homogeneity check — the actual "structural prevention" required by COMPA-03 — lives in the Server Component and runs unconditionally on every request to `/comparar`, independent of how the URL was reached. Highlighting logic correctly excludes Superficie/Días publicado/Señales/Rentabilidad-de-zona from "best value" comparison, and excludes fabricated 0-prices from winning. `npx tsc --noEmit` and `npm run build` both pass cleanly across the whole project, and the `/mercado-inmobiliario/oportunidades/comparar` route appears in the build output.

---

*Verified: 2026-08-02*
*Verifier: Claude (gsd-verifier)*
