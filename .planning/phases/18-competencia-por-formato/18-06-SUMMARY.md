---
phase: 18-competencia-por-formato
plan: 06
subsystem: api
tags: [turf, overpass, sii-geocoding, competencia, orquestacion-async]

# Dependency graph
requires:
  - phase: 18-02
    provides: obtenerCompetidoresOverpass() en lib/overpass-competencia.ts
  - phase: 18-03
    provides: obtenerCompetidoresSeedList() en lib/strip-power-centers-chile.ts
  - phase: 18-04
    provides: obtenerCadenasGeocodificadasPorComuna() en lib/cadenas-sucursales-server.ts
  - phase: 18-05
    provides: calcularResultadoCompetencia() pura en lib/competencia-formato.ts
provides:
  - obtenerCompetenciaPorFormato(ubicacion, formato, isocronaGeometria?, radioM?) — orquestador async único, listo para que Plan 18-07 lo importe y llame
affects: [18-07, 18-08, cabida-comercial-server]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ramificación por formato: strip_center/power_center usan seed list síncrona; supermercado/minimarket usan Promise.all(Overpass, geocoding SII) — recursos externos independientes en paralelo, no secuencial"
    - "Cruce espacial por proximidad (turf.distance, radio fijo 150m) para sustituir un tag OSM genérico por el nombre real de una cadena geocodificada, subiendo confianza individual a 'alta' solo con corroboración independiente"

key-files:
  created: []
  modified:
    - lib/competencia-formato.ts
    - tests/unit/competencia-formato-orquestador.test.ts

key-decisions:
  - "obtenerCompetenciaPorFormato() vive en el mismo archivo que calcularResultadoCompetencia() (lib/competencia-formato.ts), no en un archivo nuevo — mantiene toda la lógica de negocio del dominio Competencia por Formato en un solo lugar, standalone de lib/cabida-comercial-server.ts (que aún no existe)"
  - "RADIO_MATCH_CADENA_SII_M = 150m como umbral fijo para considerar que un POI OSM y una fila SII geocodificada son la misma tienda física — documentado inline, no configurable"

patterns-established:
  - "Orquestador async standalone que compone múltiples fuentes de datos ya construidas en waves paralelas, sin acoplarse a la capa server-only del dominio padre (mismo criterio ya usado en Fase 16/17)"

# Metrics
duration: ~15min
completed: 2026-08-03
---

# Phase 18 Plan 06: Orquestador de composición de competencia por formato Summary

**Implementado `obtenerCompetenciaPorFormato()`, el orquestador async que compone Overpass + seed list + geocoding SII en un único resultado por formato, incluyendo el cruce espacial que sustituye tags OSM genéricos por nombres reales de cadena (COMPE-06).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-03
- **Tasks:** 2/2 completados
- **Files modified:** 2

## Accomplishments
- `obtenerCompetenciaPorFormato(ubicacion, formato, isocronaGeometria?, radioM?)` exportada desde `lib/competencia-formato.ts`, ramifica correctamente entre seed list (strip_center/power_center) y Overpass+SII (supermercado/minimarket)
- Overpass y el geocoding SII corren en `Promise.all` — verificado con un test que usa promesas controladas manualmente para probar que ambas llamadas se disparan antes de que ninguna resuelva
- Cruce espacial (turf.distance, radio 150m) sustituye el tag OSM crudo por el nombre real de cadena cuando hay match, subiendo la confianza del competidor individual a 'alta'
- El resultado final siempre delega a `calcularResultadoCompetencia` (Plan 18-05) — no reimplementa la degradación de confianza

## Task Commits

Each task was committed atomically:

1. **Task 1: obtenerCompetenciaPorFormato() — composición + cruce espacial OSM↔SII** - `64406f2` (feat)
2. **Task 2: Tests del orquestador (mocks de las 3 fuentes)** - `bd6f681` (test)

_Nota: se invirtió el orden feat→test respecto al ejemplo TDD del template porque este plan no está marcado `tdd="true"` — se implementó primero la función real (Task 1 del plan tal cual está escrito) y luego sus tests (Task 2), siguiendo el orden literal de las tareas del plan._

## Files Created/Modified
- `lib/competencia-formato.ts` - agrega `obtenerCompetenciaPorFormato()` (orquestador async); `calcularResultadoCompetencia()` de Plan 18-05 queda intacta
- `tests/unit/competencia-formato-orquestador.test.ts` - 5 casos: ramificación strip_center sin Overpass/SII, paralelismo Promise.all para supermercado, match espacial <150m, sin match >150m, delegación a calcularResultadoCompetencia

## Decisions Made
- Se mantuvo el orquestador en el mismo archivo que la función pura de Plan 18-05, tal como especificaba el plan, en vez de crear un archivo `lib/competencia-formato-server.ts` separado — evita una capa adicional de indirección para una sola función.
- El test de paralelismo usa promesas controladas manualmente (no `vi.useFakeTimers` ni temporizadores) para verificar de forma determinista que ambas llamadas mockeadas se disparan antes de que cualquiera resuelva, confirmando `Promise.all` sin depender de timing real.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito. El código de `obtenerCompetenciaPorFormato()` implementado coincide con el snippet del plan (import de `UbicacionCabida` agregado a los imports de tipos ya existentes, ambas constantes `RADIO_COMPETENCIA_DEFAULT_M`/`RADIO_MATCH_CADENA_SII_M` agregadas, comentario de cabecera sobre el tradeoff de throttle no compartido incluido en el JSDoc de la función).

## Self-Check: PASSED

- FOUND: lib/competencia-formato.ts contiene `obtenerCompetenciaPorFormato` exportada
- FOUND: tests/unit/competencia-formato-orquestador.test.ts existe con 5 tests
- FOUND commit 64406f2 (feat)
- FOUND commit bd6f681 (test)
- `npm run test -- tests/unit/competencia-formato-orquestador.test.ts tests/unit/competencia-formato.test.ts` → 14/14 passed
- `npm run typecheck` → sin errores
