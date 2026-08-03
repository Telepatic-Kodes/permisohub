---
phase: 18-competencia-por-formato
plan: 05
subsystem: cabida-comercial
tags: [vitest, tdd, competencia-por-formato, confianza-degradada, pure-function]

# Dependency graph
requires:
  - phase: 18-01
    provides: "CompetidorDetectado, FormatoComercial, ResultadoCompetenciaFormato, NivelConfianza en lib/cabida-comercial.ts"
provides:
  - "calcularResultadoCompetencia(competidores, formato) — función PURA que implementa la degradación de confianza de COMPE-05"
affects: [18-06, 18-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Función pura (sin I/O) testeada con TDD RED→GREEN→REFACTOR, siguiendo el mismo patrón que evaluarOportunidad() en lib/mercado-locales-server.ts"
    - "Constantes de disclosure grep-eables citando ids exactos de .planning/data-sources.yaml, en vez de texto libre repetido"

key-files:
  created:
    - lib/competencia-formato.ts
    - tests/unit/competencia-formato.test.ts
  modified: []

key-decisions:
  - "confianzaGlobal tiene un tope duro en 'media' (nunca 'alta') porque coberturaConocida es SIEMPRE false en v1.7 — el tope vive en código (TOPE_CONFIANZA_GLOBAL), no solo en documentación, y está cubierto por el test más importante del plan"
  - "competidores.length === 0 se traduce SIEMPRE en confianzaGlobal 'baja' con disclosure explícita, nunca en 'sin competencia confirmada' (COMPE-05 / Pitfall 3)"
  - "El array 'competidores' del resultado es la misma referencia de entrada (sin copiar/filtrar/reordenar) — mantiene la función simple y evita divergencia accidental de orden"

patterns-established:
  - "Disclosure por formato construido a partir de constantes nombradas (DISCLOSURE_GAP_SUPER_MINI / DISCLOSURE_GAP_STRIP_POWER) que citan el id exacto de data-sources.yaml — un solo lugar para actualizar si el gap de datos se resuelve"

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 18 Plan 05: Núcleo puro de degradación de confianza de competencia por formato Summary

**`calcularResultadoCompetencia()` en `lib/competencia-formato.ts` — función pura, testeada vía TDD, que capa `confianzaGlobal` en `'media'` (nunca `'alta'`) y nunca lee 0 competidores como "sin competencia confirmada", citando el id exacto de `data-sources.yaml` en cada disclosure.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-03T01:44:00Z
- **Completed:** 2026-08-03T01:45:20Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 2

## Accomplishments
- `calcularResultadoCompetencia(competidores, formato)` implementada como función pura (sin fetch/I/O), lista para que Plan 18-06 la use como última pieza del orquestador async
- Tope duro de `confianzaGlobal` en `'media'` verificado por test — el caso más peligroso identificado en la investigación de fase (Pitfall 1 de 18-RESEARCH.md / Pitfall 3 de PITFALLS.md) queda cerrado en código, no solo en documentación
- `coberturaConocida` siempre `false` para los 4 formatos objetivo, con disclosure que cita el id exacto de la entrada de `data-sources.yaml` correspondiente (`sii-nomina-sucursales-holdings-sin-tiendas` para super/mini, `strip-power-centers-chile-seed` para strip/power)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Tests para calcularResultadoCompetencia()** - `3286596` (test)
2. **Task 2 (GREEN): Implementar calcularResultadoCompetencia()** - `2b2048c` (feat)
3. **Task 3 (REFACTOR): Extraer textos de disclosure a constantes nombradas** - `51b4f36` (refactor)

**Plan metadata:** (pendiente — commit de cierre de plan, ver final_commit)

_TDD: RED (test falla por ausencia del módulo) → GREEN (9/9 tests pasan) → REFACTOR (mismos 9/9 tests, cero regresión)_

## Files Created/Modified
- `tests/unit/competencia-formato.test.ts` - 9 casos: cobertura conocida siempre false, tope duro de confianza en `'media'`, disclosure por formato citando el id exacto de data-sources.yaml, `consultadoEl` ISO válido, `competidores` de salida === entrada
- `lib/competencia-formato.ts` - `calcularResultadoCompetencia()` pura, `NIVEL_ORDEN`/`TOPE_CONFIANZA_GLOBAL` para el cálculo del mínimo capado, `construirDisclosure()` con constantes `DISCLOSURE_GAP_SUPER_MINI`/`DISCLOSURE_GAP_STRIP_POWER`

## Decisions Made
- Tope duro (`TOPE_CONFIANZA_GLOBAL = 'media'`) como constante explícita en código, no como comentario aislado — cualquier intento futuro de quitarlo rompe el test "NUNCA alta" de Task 1
- Disclosure distingue explícitamente el texto de 0 competidores ("No se encontraron...") del texto con competidores ("Se encontraron N...") — evita un mensaje genérico que oculte la diferencia semántica entre ambos casos
- Constantes de disclosure extraídas en el REFACTOR (Task 3) para que un `grep` por el id de `data-sources.yaml` encuentre la cita en un único lugar, sin tocar comportamiento

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`calcularResultadoCompetencia()` queda lista, pura y 100% testeada sin red/DB para que Plan 18-06 la invoque como paso final de su orquestador async (que resolverá `CompetidorDetectado[]` desde Overpass, seed list y SII geocodificado). No hay bloqueantes.

---
*Phase: 18-competencia-por-formato*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: lib/competencia-formato.ts
- FOUND: tests/unit/competencia-formato.test.ts
- FOUND: .planning/phases/18-competencia-por-formato/18-05-SUMMARY.md
- FOUND: 3286596 (test)
- FOUND: 2b2048c (feat)
- FOUND: 51b4f36 (refactor)
