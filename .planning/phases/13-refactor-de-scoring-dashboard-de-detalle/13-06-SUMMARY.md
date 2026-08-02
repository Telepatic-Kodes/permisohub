---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 06
subsystem: ui
tags: [react, next-link, mercado-inmobiliario, oportunidad-detalle]

# Dependency graph
requires:
  - phase: 13-02
    provides: "formatFechaCorta() compartido en lib/formato-fecha.ts"
  - phase: 13-03
    provides: "obtenerOportunidadPorId/obtenerComparablesOportunidad/obtenerHistorialPrecioListing + REASON_LABEL/REASON_LABEL_DETALLE en lib/mercado-locales-server.ts"
provides:
  - "HistorialTab — días publicado, historial de precio completo (o mensaje explícito si vacío), reasonCodes explicados en detalle vía REASON_LABEL_DETALLE, señales cruzadas (expansión de cadenas + tendencia constructiva INE) cuando existen"
  - "ComparablesTab — mini-cards clickeables hacia /mercado-inmobiliario/oportunidades/[id], SIEMPRE visible, nunca oculta comparables reales detrás del mensaje de insuficiencia"
affects: [13-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Tabs de detalle son componentes presentacionales puros — reciben datos ya fetchados por props, cero lógica de red propia (mismo patrón que resume-tab.tsx de 13-04)", "timestamptz (primera_vez_visto_el, ultima_vez_visto_el, capturado_el) se formatea con new Date(iso) directo — NUNCA con formatFechaCorta(), reservada para campos date-only"]

key-files:
  created:
    - components/mercado-inmobiliario/oportunidad-detalle/historial-tab.tsx
    - components/mercado-inmobiliario/oportunidad-detalle/comparables-tab.tsx
  modified: []

key-decisions:
  - "ComparablesTab renderiza mensaje de insuficiencia Y grilla simultáneamente cuando comparables.length === 1 (no son mutuamente excluyentes) — nunca se rellena con datos fuera de criterio para completar un mínimo"
  - "senalExpansion/tendenciaConstruccion en HistorialTab degradan omitiendo el bloque cuando son null, sin mensaje explícito de 'sin señal' — a diferencia de comparables/rentabilidad, CONTEXT.md no las trata como dato central de la ficha, son un plus opcional"

patterns-established:
  - "reasonCodes en vistas de detalle usan REASON_LABEL_DETALLE (texto largo explicativo); listas/mini-cards siguen usando REASON_LABEL (badge corto) — ambos re-exportados desde lib/mercado-locales-server.ts (13-03)"

# Metrics
duration: 2min
completed: 2026-08-02
---

# Phase 13 Plan 06: Tabs Historial + Comparables Summary

**HistorialTab (días publicado + historial de precio completo + reasonCodes en detalle + señales cruzadas) y ComparablesTab (mini-cards clickeables hacia la ficha del comparable, siempre visible incluso con 0 o 1 resultado) — ambos componentes presentacionales puros sin lógica de red propia**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-02T19:48:14Z
- **Completed:** 2026-08-02T19:49:21Z
- **Tasks:** 2
- **Files modified:** 2 (ambos nuevos)

## Accomplishments
- `HistorialTab` — muestra "publicado hace N días", historial de precio completo (o mensaje explícito "sin cambios de precio registrados" si el historial viene vacío), cada reasonCode explicado en detalle vía `REASON_LABEL_DETALLE`, y las señales cruzadas (expansión de cadenas via `SenalExpansionComuna`, tendencia constructiva INE via `TendenciaConstruccionComuna`) cuando existen
- `ComparablesTab` — grilla de mini-cards clickeables (`Link` hacia `/mercado-inmobiliario/oportunidades/[id]`) con precio UF, UF/m² cuando existe, comuna y badges de reasonCode; el mensaje de insuficiencia y la grilla coexisten cuando hay exactamente 1 comparable, nunca se oculta un dato real

## Task Commits

Each task was committed atomically:

1. **Task 1: HistorialTab — historial de precio + reason codes + señales cruzadas** - `6f2b881` (feat)
2. **Task 2: ComparablesTab — mini-cards o mensaje explícito** - `8950c72` (feat)

**Plan metadata:** (este commit)

## Files Created/Modified
- `components/mercado-inmobiliario/oportunidad-detalle/historial-tab.tsx` - Tab de historial de precio (DETA-03) + reason codes en detalle + señales cruzadas (DETA-04)
- `components/mercado-inmobiliario/oportunidad-detalle/comparables-tab.tsx` - Tab de comparables sugeridos (DETA-05)

## Decisions Made
- Ninguna decisión nueva más allá de las ya bloqueadas en el plan — el código se escribió exactamente como especificado en 13-06-PLAN.md, verificado línea por línea contra las interfaces reales (`OportunidadDetalle`, `PuntoHistorialPrecio`, `ComparableOportunidad`, `SenalExpansionComuna`, `TendenciaConstruccionComuna`) en `lib/mercado-locales-server.ts`, `lib/cadenas-sucursales-server.ts` y `lib/ine-permisos-server.ts` antes de escribir los archivos — todos los campos coinciden exactamente

## Deviations from Plan

None - plan executed exactly as written. El código coincide con los bloques especificados en el plan.

## Issues Encountered
`npx eslint` reporta un warning (no error) de `react-hooks/purity` por el uso de `Date.now()` durante el render en `historial-tab.tsx` (línea 30, cálculo de `diasPublicado`). Se verificó que este mismo warning existe en código ya mergeado (`components/proyecto/zonificacion-card.tsx:112`), confirmando que es un patrón aceptado en el codebase — no es un error introducido por este plan, y el exit code de eslint es 0 (limpio en el sentido de "sin errores bloqueantes").

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
DETA-03, DETA-04 y DETA-05 completos como componentes presentacionales puros. Junto con `ResumenTab` (13-04) y `PosicionamientoTab` (13-05, en ejecución paralela), las cuatro tabs de la ficha de detalle quedan listas para que 13-07 las integre en la página `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx`, conectando los datos reales de `obtenerOportunidadPorId`/`obtenerComparablesOportunidad`/`obtenerHistorialPrecioListing`. Sin bloqueos.

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: components/mercado-inmobiliario/oportunidad-detalle/historial-tab.tsx
- FOUND: components/mercado-inmobiliario/oportunidad-detalle/comparables-tab.tsx
- FOUND: commit 6f2b881 (feat)
- FOUND: commit 8950c72 (feat)
