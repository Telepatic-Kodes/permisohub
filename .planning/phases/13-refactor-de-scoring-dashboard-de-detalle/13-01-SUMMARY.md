---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 01
subsystem: mercado-inmobiliario
tags: [vitest, tdd, refactor, scoring, mercado-locales]

# Dependency graph
requires: []
provides:
  - "evaluarOportunidad() — función pura exportada desde lib/mercado-locales-server.ts, fuente única de verdad para el scoring de reasonCodes (below_p25_ufm2, below_p25_uf, price_drop_7d)"
  - "obtenerOportunidadesMercadoLocales() refactorizada para llamar evaluarOportunidad() en el loop, sin cambio de comportamiento observable"
affects: [13-03, 13-04, 13-05, 13-06, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Extracción de lógica de scoring inline a función pura testeable — patrón a replicar para cualquier otro cálculo compartido entre list view y detail view"]

key-files:
  created: [tests/unit/evaluar-oportunidad.test.ts]
  modified: [lib/mercado-locales-server.ts]

key-decisions:
  - "Firma de evaluarOportunidad() usa objeto de params (no posicional) para legibilidad en los futuros call sites de detalle/comparables"
  - "else-if entre below_p25_ufm2 y below_p25_uf preservado exactamente (mutuamente excluyentes) — no se 'corrigió' a ifs independientes"
  - "price_drop_7d compara solo las últimas dos entradas de historialReciente, no el mínimo/máximo de la ventana — comportamiento documentado explícitamente en el JSDoc y cubierto por test de rebote"

patterns-established:
  - "Scoring de oportunidad centralizado en evaluarOportunidad() — cualquier vista futura que necesite reasonCodes (ficha de detalle, comparables) debe llamar esta función, nunca reimplementar el cálculo inline"

# Metrics
duration: 8min
completed: 2026-08-02
---

# Phase 13 Plan 01: Extracción de evaluarOportunidad() Summary

**Función pura `evaluarOportunidad()` extraída del loop de `obtenerOportunidadesMercadoLocales()`, con TDD RED→GREEN, preservando exactamente el comportamiento de scoring (below_p25_ufm2/below_p25_uf mutuamente excluyentes, price_drop_7d desde las últimas dos entradas)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-02T15:29:24-04:00
- **Completed:** 2026-08-02T15:37:25-04:00
- **Tasks:** 3 (2 con commit de código, 1 de verificación pura)
- **Files modified:** 2

## Accomplishments
- `evaluarOportunidad()` exportada desde `lib/mercado-locales-server.ts`, cubierta por 9 tests unitarios (RED→GREEN)
- `obtenerOportunidadesMercadoLocales()` refactorizada: el bloque de 13 líneas inline reemplazado por una llamada de 6 líneas a la función extraída
- Confirmado sin cambio de comportamiento observable en los 5 call sites del proyecto (firma de función y tipo de retorno intactos)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Tests para evaluarOportunidad()** - `e97818d` (test)
2. **Task 2 (GREEN): Extraer evaluarOportunidad() y refactorizar el loop** - `025e3f0` (feat)
3. **Task 3: Verificación de preservación de comportamiento** - sin commit (verificación pura, ningún archivo modificado; ver sección de verificación abajo)

**Plan metadata:** (este commit)

## Files Created/Modified
- `tests/unit/evaluar-oportunidad.test.ts` - 9 casos: below_p25_ufm2/below_p25_uf mutuamente excluyentes, cohortes null, price_drop_7d (2 entradas, rebote de 3 entradas, 1 sola entrada), caso combinado, ningún criterio
- `lib/mercado-locales-server.ts` - Nueva función exportada `evaluarOportunidad()` (con JSDoc explicando el propósito para Fase 13) + loop de `obtenerOportunidadesMercadoLocales()` refactorizado para usarla

## Decisions Made
- Firma con objeto de params (no posicional) — más legible en los futuros call sites de la ficha de detalle y comparables (Plan 13-03+)
- El JSDoc de la función documenta explícitamente que `below_p25_ufm2`/`below_p25_uf` son mutuamente excluyentes a propósito y que `price_drop_7d` compara solo las últimas dos entradas — para que futuros mantenedores no "corrijan" esto por accidente

## Deviations from Plan

None - plan executed exactly as written. El código extraído coincide byte a byte con el bloque inline original (líneas 489-501 antes del refactor), y el `git diff` final coincide exactamente con lo descrito en la sección `<verification>` del plan (nueva función agregada + bloque de 13 líneas reemplazado por llamada de 6 líneas, sin otros cambios en el archivo).

## Issues Encountered
None. Se detectó, en paralelo a esta ejecución, que otro plan de la misma fase (13-02) se estaba ejecutando concurrentemente sobre el mismo repositorio (sin branching, `branching_strategy: none`) — no generó conflictos con los archivos de este plan (`lib/mercado-locales-server.ts`, `tests/unit/evaluar-oportunidad.test.ts` no fueron tocados por 13-02).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`evaluarOportunidad()` está lista para ser reutilizada por los planes 13-03 en adelante (ficha de detalle de listing individual y sus comparables), sin necesidad de reimplementar la lógica de scoring. Sin bloqueos.

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: lib/mercado-locales-server.ts
- FOUND: tests/unit/evaluar-oportunidad.test.ts
- FOUND: SUMMARY.md (this file)
- FOUND: commit e97818d (test)
- FOUND: commit 025e3f0 (feat)
- FOUND: `export function evaluarOportunidad` in lib/mercado-locales-server.ts
