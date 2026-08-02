---
phase: 15-informe-exportable
verified: 2026-08-02T21:38:35Z
status: passed
score: 15/15 must-haves verified
---

# Phase 15: Informe Exportable Verification Report

**Phase Goal:** El arquitecto/inversionista puede generar una vista exportable/imprimible — de una oportunidad individual o de una comparación — para compartir externamente con cliente o inversionista, con la misma disciplina de fuentes y fechas que ya rige el resto del proyecto.
**Verified:** 2026-08-02T21:38:35Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Aggregated from must_haves.truths across 15-01-PLAN.md, 15-02-PLAN.md, 15-03-PLAN.md.

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | (15-01) Al imprimir cualquier página bajo `(dashboard)` la sidebar no aparece | ✓ VERIFIED | `components/dashboard/sidebar.tsx:192` has `print:hidden` on `<aside>` className; `app/(dashboard)/layout.tsx:46` has `print:pl-0` on `<main>`. Pattern already proven working in codebase (pre-existing `print:hidden` used identically in `cadenas-comerciales/[id]/compliance/page.tsx:119`). Human-verified live in 15-02/15-03 checkpoints ("Cmd+P... sin sidebar"). |
| 2   | (15-01) `formatTimestampCorto` existe, hermano de `formatFechaCorta`, sin tercera reimplementación local | ✓ VERIFIED | `lib/formato-fecha.ts` exports both functions side-by-side with cross-referencing doc comments. `grep -rn "formatTimestamp(" app/ components/` (excluding `formatTimestampCorto(`) returns zero matches — no orphan local duplicate anywhere. |
| 3   | (15-01) Botón de impresión reutilizable calcado del precedente | ✓ VERIFIED | `components/mercado-inmobiliario/informe/print-button.tsx` — `"use client"`, `Printer` icon, `window.print()`, `print:hidden` on the button itself, matches `cadenas-comerciales/.../print-button.tsx` pattern. |
| 4   | (15-01) Campo "preparado por/para" sin persistencia, visible en pantalla e impresión | ✓ VERIFIED | `components/mercado-inmobiliario/informe/preparado-por-para.tsx` — 2 controlled inputs via `useState`, no localStorage/backend call, no `print:hidden` class present. |
| 5   | (15-01) Portada y metodología reutilizables entre los 2 informes nuevos | ✓ VERIFIED | `PortadaInforme` and `MetodologiaInforme` (`components/mercado-inmobiliario/informe/`) are both imported and rendered, unmodified, by both `[id]/informe/page.tsx` and `comparar/informe/page.tsx`. |
| 6   | (15-02) Link "Exportar informe" desde ficha lleva a vista imprimible con portada+cuerpo+metodología (INFO-01) | ✓ VERIFIED | `[id]/page.tsx:148-153` renders `<Link href=".../informe">`. `[id]/informe/page.tsx` composes `PortadaInforme` → price/positioning/comparables body → `MetodologiaInforme`. Human-verified live (checkpoint "aprobado", 8 steps). |
| 7   | (15-02) Informe individual muestra fecha de generación (portada) Y fecha de última verificación del dato en el cuerpo — 2 vigencias distintas | ✓ VERIFIED | `PortadaInforme` shows "Generado el {formatTimestampCorto(generadoEl)}"; `[id]/informe/page.tsx:76-78` separately shows "Última verificación de este dato: {formatTimestampCorto(oportunidad.ultimaVezVistoEl)}" in the body, not buried in methodology only. |
| 8   | (15-02) "Preparado por/para" editable en la portada del informe individual | ✓ VERIFIED | `PortadaInforme` (used by `[id]/informe/page.tsx`) embeds `<PreparadoPorPara />` unconditionally. |
| 9   | (15-02) Precio con `precioValido=false` nunca se muestra como "0 UF" | ✓ VERIFIED | `[id]/informe/page.tsx:69-71`: `{oportunidad.precioValido ? \`${fmt(...)} UF\` : "Precio no disponible en moneda reconocida"}` — explicit guard, matches Pitfall 2. |
| 10  | (15-02) Al imprimir, toolbar y sidebar desaparecen, cuerpo queda en hoja A4 limpia | ✓ VERIFIED | `print:hidden` on toolbar div (`[id]/informe/page.tsx:47`) + PrintButton; `@page { size: A4 portrait; margin: 15mm 12mm }` in embedded `<style>`. Human-verified live. |
| 11  | (15-03) Link "Exportar informe" desde comparación lleva a vista con portada+tabla+metodología, misma disciplina que informe individual (INFO-02) | ✓ VERIFIED | `comparar/page.tsx:142-147` renders the link with `?ids=...`. `comparar/informe/page.tsx` composes `PortadaInforme` → `TablaComparacion` → verification strip → `MetodologiaInforme`. Human-verified live (checkpoint "aprobado", 9 steps incl. Pitfall 5). |
| 12  | (15-03) Ruta `/comparar/informe` re-valida independientemente rango 2-5, existencia y homogeneidad (Pitfall 5) | ✓ VERIFIED | `comparar/informe/page.tsx` duplicates `UUID_REGEX`, range check (`idsSolicitados.length < 2 \|\| > 5`), post-fetch existence check, and `tipos.size > 1 \|\| operaciones.size > 1` homogeneity check — independent of `comparar/page.tsx`, does not import from it. Human-verified live (hand-built 1-id URL correctly rejected). |
| 13  | (15-03) Informe de comparación muestra fecha de última verificación POR oportunidad, no solo fecha de generación global | ✓ VERIFIED | `comparar/informe/page.tsx:151-157` renders a strip below `TablaComparacion`: `{o.titulo}: verificado {formatTimestampCorto(o.ultimaVezVistoEl)}` per oportunidad. |
| 14  | (15-03) "Preparado por/para" editable en la portada del informe de comparación | ✓ VERIFIED | `PortadaInforme` (used by `comparar/informe/page.tsx`) embeds `<PreparadoPorPara />`. |
| 15  | (15-03) Cuerpo reutiliza `TablaComparacion` (Fase 14) sin reconstruirla | ✓ VERIFIED | `comparar/informe/page.tsx` imports and renders `<TablaComparacion oportunidades={...} rentabilidadPorComuna={...} />` directly. `git log` on `tabla-comparacion.tsx` shows only its original Fase 14 commit (`07a5a06`) — untouched by Phase 15. |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `lib/formato-fecha.ts` | `formatTimestampCorto(iso)` exported, sibling of `formatFechaCorta` | ✓ VERIFIED | Both functions present, cross-referenced doc comments, correct null-guard and timezone handling. |
| `components/mercado-inmobiliario/informe/print-button.tsx` | `PrintButton` client island | ✓ VERIFIED | 12 lines, matches precedent almost verbatim. |
| `components/mercado-inmobiliario/informe/preparado-por-para.tsx` | `PreparadoPorPara` client island, 2 controlled inputs, no persistence | ✓ VERIFIED | Matches plan's example code exactly. |
| `components/mercado-inmobiliario/informe/portada-informe.tsx` | `PortadaInforme` presentational component | ✓ VERIFIED | Renders eyebrow, title, subtitle, generation date, embeds `PreparadoPorPara`. |
| `components/mercado-inmobiliario/informe/metodologia-informe.tsx` | `MetodologiaInforme` presentational component | ✓ VERIFIED | Handles `usoFallback`, `bandas: null` case with amber note, uses `formatFechaCorta` for `statsDate` (correct date-only formatter). |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/informe/page.tsx` | Server Component, ≥90 lines, direct data-layer calls | ✓ VERIFIED | 165 lines. Calls `obtenerOportunidadPorId`/`obtenerComparablesOportunidad` directly, no API route. |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/informe/page.tsx` | Server Component, ≥100 lines, independent validation + `TablaComparacion` | ✓ VERIFIED | 162 lines. Independent UUID/range/homogeneity validation; renders `TablaComparacion` unmodified. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `components/dashboard/sidebar.tsx` | `@media print` | `print:hidden` on `<aside>` | ✓ WIRED | Confirmed at line 192. |
| `historial-tab.tsx` | `lib/formato-fecha.ts` | `import formatTimestampCorto` | ✓ WIRED | Local `formatTimestamp` deleted; 3 call sites now use `formatTimestampCorto`. |
| `portada-informe.tsx` | `preparado-por-para.tsx` | renders `<PreparadoPorPara />` | ✓ WIRED | Confirmed. |
| `[id]/informe/page.tsx` | `lib/mercado-locales-server.ts` | `obtenerOportunidadPorId` | ✓ WIRED | Direct server-to-server call, no API route indirection. |
| `[id]/page.tsx` | `[id]/informe/page.tsx` | `Link href=".../informe"` | ✓ WIRED | Confirmed lines 148-153. |
| `comparar/informe/page.tsx` | `TablaComparacion` | renders `<TablaComparacion .../>` | ✓ WIRED | Imported and rendered with correct props, component untouched since Fase 14. |
| `comparar/page.tsx` | `comparar/informe/page.tsx` | `Link href="...informe?ids=..."` | ✓ WIRED | Uses already-fetched `oportunidades.map(o => o.id)`, not raw querystring — confirmed lines 142-147. |
| `comparar/informe/page.tsx` | homogeneidad tipoPropiedad/operacion | `new Set(...).size` re-validated independently | ✓ WIRED | Confirmed, does not import from `comparar/page.tsx`. |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
| ----------- | ------ | --------------- |
| INFO-01 | ✓ SATISFIED (functionally) | None. Note: `.planning/REQUIREMENTS.md` traceability table (lines 64-67) still shows INFO-01..04 as "Pending" rather than "Complete" — this is a documentation-sync gap (the table for phases 13/14 was updated to "Complete" post-verification; phase 15's row hasn't been updated yet), not a functional gap. Non-blocking; recommend updating during phase-complete. |
| INFO-02 | ✓ SATISFIED (functionally) | Same doc-sync note as above. |
| INFO-03 | ✓ SATISFIED (functionally) | Same doc-sync note as above. |
| INFO-04 | ✓ SATISFIED (functionally) | Same doc-sync note as above. |

### Anti-Patterns Found

None. Scanned all 12 files created/modified across the 3 plans (`grep -rn -E "TODO|FIXME|XXX|HACK|PLACEHOLDER"`) — zero matches. No empty implementations, no console.log-only handlers, no stub returns.

### Human Verification Required

None outstanding — both blocking human-verify checkpoints (15-02 Task 3, 15-03 Task 3) are documented as approved live by the user in their respective SUMMARY.md files and in STATE.md's "Current Position" ("aprobado", 8 steps for informe individual; "aprobado", 9 steps including the Pitfall 5 hand-built URL defense, for informe de comparación).

### Gaps Summary

No gaps found. All 15 aggregated must-have truths across the 3 plans are verified against actual code (not just SUMMARY claims): the print-safe layout fix is real and reuses a pattern already proven in the codebase; `formatTimestampCorto` is genuinely promoted with zero orphan duplicates; all 4 shared informe components exist, are substantive, and are wired into both new report routes; both new routes (`[id]/informe` and `comparar/informe`) fetch real data directly from the data layer (no mocks, no API route indirection); the `precioValido` guard and dual-date-vigency requirements are correctly implemented; `comparar/informe` independently re-validates range/existence/homogeneity without trusting `comparar/page.tsx`; `TablaComparacion` is reused unmodified. `npx tsc --noEmit` is clean project-wide. Both blocking human-verify checkpoints were approved live.

The only finding is a cosmetic one: `.planning/REQUIREMENTS.md`'s traceability table still lists INFO-01 through INFO-04 as "Pending" instead of "Complete," inconsistent with how phases 13/14 were updated. This does not affect goal achievement and should be corrected as part of phase-complete/milestone bookkeeping.

---

_Verified: 2026-08-02T21:38:35Z_
_Verifier: Claude (gsd-verifier)_
