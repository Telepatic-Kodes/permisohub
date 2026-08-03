---
phase: 19-veredicto-metodologia-mapa-y-tab
plan: 01
subsystem: business-logic
tags: [vitest, tdd, cabida-comercial, veredicto, terciles]

# Dependency graph
requires:
  - phase: 18-competencia-por-formato
    provides: "AnalisisCabidaComercial, ResultadoCompetenciaFormato, NivelConfianza, FormatoComercial (lib/cabida-comercial.ts) + calcularResultadoCompetencia() pattern (lib/competencia-formato.ts)"
  - phase: 17-demografia-y-consumo
    provides: "PoblacionCensoResultado (lib/censo-manzana-server.ts), ConsumoEstimadoResultado (lib/consumo-macro-zona.ts)"
provides:
  - "calcularVeredictoCabida(analisis, formato, percentiles) — función pura de síntesis de 3 estados (evidencia_de_espacio | mercado_parece_cubierto | evidencia_insuficiente)"
  - "Tipos locales DemografiaYConsumo, AnalisisParaVeredicto, PercentilesGapScore, RazonInsuficiencia, VeredictoCabida, VeredictoEstado exportados desde lib/veredicto-cabida.ts"
affects: [19-03-orquestador-veredicto, 19-04-tab-cabida-comercial]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Banding por terciles (p33/p66) provistos como parámetro por el llamador — nunca un corte numérico hardcodeado dentro de una función pura"
    - "gapScore = competidores/1000hab, siempre etiquetado como proxy de densidad, nunca leakage/surplus real"
    - "Guard de undefined explícito ANTES de cualquier cálculo — nunca colapsar 'campo nunca poblado' con 'campo poblado en cero'"
    - "Tope duro de confianza documentado con constante nombrada (TOPE_CONFIANZA_VEREDICTO), defensa en profundidad aunque el upstream ya cape"

key-files:
  created:
    - lib/veredicto-cabida.ts
    - tests/unit/veredicto-cabida.test.ts
  modified: []

key-decisions:
  - "El corte entre evidencia_de_espacio y mercado_parece_cubierto SIEMPRE viene de terciles (p33/p66) pasados como parámetro — la función nunca calcula ni asume un corte absoluto de gap score (decisión LOCKED del founder, ver objective del plan)"
  - "percentiles: PercentilesGapScore | null explícito para modelar cold-start (cero análisis reales en cabida_comercial_cache a la fecha) — cuando es null o muestraN < MUESTRA_MINIMA (10), el veredicto es SIEMPRE evidencia_insuficiente con razonInsuficiencia 'muestra_comparativa_insuficiente'"
  - "Isócrona degradada a círculo equivalente fuerza confianza 'baja' incondicionalmente, incluso con demografia/competencia completas — la degradación de método geoespacial nunca queda silenciada por datos base válidos"
  - "Banda intermedia (entre p33 y p66) es su propio razonInsuficiencia ('banda_intermedia_no_concluyente') con confianza NO forzada a 'baja' — se distingue explícitamente de los modos de falla por datos faltantes/degradados"

patterns-established:
  - "Tipo espejo local (DemografiaYConsumo/AnalisisParaVeredicto) cuando el campo real todavía no existe en un tipo committeado por un plan gateado — documentado inline qué plan futuro debe reconciliar shapes"

# Metrics
duration: 15min
completed: 2026-08-03
---

# Phase 19 Plan 01: Núcleo puro de veredicto de cabida comercial Summary

**`calcularVeredictoCabida()` pura con banding por terciles (nunca threshold hardcodeado), gapScore-como-proxy-de-densidad nunca fabricado, y tope duro de confianza en 'media' — 14 casos de test, cero I/O.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-03T22:55:00Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 2 (1 creado nuevo + su test)

## Accomplishments
- `lib/veredicto-cabida.ts` creado: función pura `calcularVeredictoCabida(analisis, formato, percentiles)` que nunca retorna un veredicto binario, siempre trae `estado` y `confianza` juntos, nunca fabrica `gapScore` cuando faltan datos base, y clasifica exclusivamente contra terciles pasados por parámetro.
- `tests/unit/veredicto-cabida.test.ts` con los 14 casos obligatorios del plan (3 estados, banding, cold-start, muestra bajo el mínimo, degradación de isócrona, tope de confianza, fórmula exacta de gapScore, banda intermedia distinguida de falla de datos).
- Ciclo TDD completo: RED (import error confirmado) → GREEN (14/14 tests pasan, tsc limpio) → REFACTOR (motivos extraídos a funciones nombradas, cero regresión).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Tests para calcularVeredictoCabida()** - `87e238b` (test)
2. **Task 2 (GREEN): Implementar calcularVeredictoCabida()** - `46c049d` (feat)
3. **Task 3 (REFACTOR): Confirmar disciplina de comentarios y nombres** - `2cd20f7` (refactor)

_Ciclo TDD: test → feat → refactor, como especifica el plan._

## Files Created/Modified
- `lib/veredicto-cabida.ts` - Función pura `calcularVeredictoCabida()` + tipos `DemografiaYConsumo`, `AnalisisParaVeredicto`, `PercentilesGapScore`, `RazonInsuficiencia`, `VeredictoEstado`, `VeredictoCabida`
- `tests/unit/veredicto-cabida.test.ts` - 14 casos vitest cubriendo los 3 estados, banding por terciles, cold-start, muestra insuficiente, degradación de isócrona y tope de confianza

## Decisions Made
Ninguna decisión de arquitectura nueva — el plan ya venía con la decisión LOCKED del founder (banding por terciles, nunca threshold absoluto) documentada en su `<objective>`; se implementó tal cual. Ver `key-decisions` en el frontmatter para el detalle de las 4 decisiones de diseño heredadas del plan y aplicadas literalmente en código.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture de `consumo` en el test le faltaban campos requeridos por `ConsumoEstimadoResultado`**
- **Found during:** Task 2 (verificación `npx tsc --noEmit`)
- **Issue:** El fixture `demografiaFixture()` del test (copiado literal del skeleton del plan) construía el objeto `consumo` sin `comuna`, `nivelGeografico` ni `fuente` — campos requeridos (no opcionales) del tipo real `ConsumoEstimadoResultado` de `lib/consumo-macro-zona.ts`. `tsc --noEmit` fallaba con TS2739.
- **Fix:** Se agregaron los 3 campos faltantes al fixture con valores representativos (`comuna: 'Providencia'`, `nivelGeografico: 'macro_zona_gran_santiago'`, `fuente` con el mismo formato de string que produce `obtenerConsumoEstimado()`).
- **Files modified:** `tests/unit/veredicto-cabida.test.ts`
- **Verification:** `npx tsc --noEmit` limpio, 14/14 tests siguen en verde.
- **Committed in:** `46c049d` (Task 2 commit, junto con la implementación GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix mecánico de tipos en el fixture del test, sin afectar la lógica ni los 14 casos descritos en el plan. Cero scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`calcularVeredictoCabida()` queda 100% puro y testeado, listo para que Plan 19-03 (gateado por Phase 16/17-03/18-07) lo importe sin modificaciones y le pase los percentiles reales que ese plan calcula desde `cabida_comercial_cache`. Sin blockers para este plan; los siguientes planes de la fase (19-02 mapa, 19-03 orquestador gateado, 19-04 tab) pueden avanzar independientemente según sus propias dependencias.

---
*Phase: 19-veredicto-metodologia-mapa-y-tab*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: lib/veredicto-cabida.ts
- FOUND: tests/unit/veredicto-cabida.test.ts
- FOUND: .planning/phases/19-veredicto-metodologia-mapa-y-tab/19-01-SUMMARY.md
- FOUND commit: 87e238b (test)
- FOUND commit: 46c049d (feat)
- FOUND commit: 2cd20f7 (refactor)
