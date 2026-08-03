---
phase: 18-competencia-por-formato
plan: 01
subsystem: cabida-comercial
tags: [typescript, types, testing, vitest, cabida-comercial, competencia]

# Dependency graph
requires:
  - phase: 16-ubicacion-e-isocrona
    provides: "lib/cabida-comercial.ts con UbicacionCabida, IsocronaResultado, FormatoComercial, AnalisisCabidaComercial y consultarCabidaComercial() ya estables"
provides:
  - "CompetidorDetectado, ResultadoCompetenciaFormato, FuenteCompetidor, NivelConfianza — contrato tipado compartido para todos los planes restantes de Fase 18"
  - "AnalisisCabidaComercial.competencia? opcional, additive, no rompe consumidores de Phase 16"
  - "Guard automatizado (tests/unit/cabida-comercial-tipos.test.ts) que falla la compilación si el FormatoComercial de cabida-comercial se unifica alguna vez con el FormatoComercial no relacionado de lib/terrenos-comercial.ts"
affects: [18-02, 18-03, 18-04, 18-05, 18-06, 18-07, 18-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Union types explícitos (FuenteCompetidor, NivelConfianza) en vez de string libre para campos de proveniencia/confianza"
    - "Test de colisión de nombres via @ts-expect-error verificado manualmente (remover el error real y correr typecheck) para confirmar que el guard es real, no cosmético"

key-files:
  created:
    - tests/unit/cabida-comercial-tipos.test.ts
  modified:
    - lib/cabida-comercial.ts

key-decisions:
  - "FormatoComercial de Fase 18 se reusa desde lib/cabida-comercial.ts (nunca redefinido ni importado desde lib/terrenos-comercial.ts) — colisión de nombres cerrada con guard de tipos, no solo comentario"
  - "competencia? en AnalisisCabidaComercial es opcional para no romper consumidores existentes de Phase 16 hasta que Plan 18-07 lo pueble"
  - "coberturaConocida y confianzaGlobal son campos obligatorios (nunca opcionales) en ResultadoCompetenciaFormato desde el primer commit — cierra COMPE-05 a nivel de tipo"

patterns-established:
  - "Guard de colisión de tipos: @ts-expect-error + verificación manual de que remover el comentario rompe el typecheck, documentado en el propio test"

# Metrics
duration: ~10min
completed: 2026-08-03
---

# Phase 18 Plan 01: Tipos de Competencia por Formato Summary

**4 tipos nuevos (CompetidorDetectado, ResultadoCompetenciaFormato, FuenteCompetidor, NivelConfianza) agregados de forma aditiva a lib/cabida-comercial.ts, más un test que falla en tiempo de compilación si el FormatoComercial de este archivo se llega a confundir con el de lib/terrenos-comercial.ts**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-03T01:30:59Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `lib/cabida-comercial.ts` expone ahora `FuenteCompetidor`, `NivelConfianza`, `CompetidorDetectado`, `ResultadoCompetenciaFormato`, y `AnalisisCabidaComercial.competencia?` — el contrato tipado que usarán los 5 planes restantes de Fase 18 (Overpass, seed list, geocoding SII, lógica de confianza, orquestador).
- Cambio 100% aditivo: verificado con `git diff` que no hay líneas eliminadas — ningún tipo/función de Phase 16 (`UbicacionCabida`, `IsocronaResultado`, `FormatoComercial`, `consultarCabidaComercial`) cambió de forma.
- Riesgo de colisión de nombres `FormatoComercial` (identificado en 18-RESEARCH.md) cerrado con un guard automatizado, no solo documental: `tests/unit/cabida-comercial-tipos.test.ts` usa `@ts-expect-error` para forzar que un `FormatoTerreno` válido ('local') sea rechazado al asignarse a `FormatoCabida`. Verificado manualmente removiendo el `@ts-expect-error` y confirmando que `npm run typecheck` falla con `TS2322: Type '"local"' is not assignable to type 'FormatoComercial'` — luego restaurado.
- `npm run typecheck` y `npm run test -- tests/unit/cabida-comercial-tipos.test.ts` pasan limpio (3/3 tests verdes).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extender lib/cabida-comercial.ts con los tipos de competencia** - `340680e` (feat)
2. **Task 2: Test de colisión de tipos FormatoComercial (guard automatizado)** - `bc7eb0e` (test)

_Note: No plan-metadata commit created yet — pending in final_commit step._

## Files Created/Modified
- `lib/cabida-comercial.ts` - Agrega FuenteCompetidor, NivelConfianza, CompetidorDetectado, ResultadoCompetenciaFormato + AnalisisCabidaComercial.competencia? opcional + comentario de advertencia sobre colisión de nombres
- `tests/unit/cabida-comercial-tipos.test.ts` - Guard de tipos: valores de FormatoCabida, no-intercambiabilidad con FormatoTerreno vía @ts-expect-error, forma mínima de CompetidorDetectado/ResultadoCompetenciaFormato

## Decisions Made
- Se reutiliza el `FormatoComercial` ya existente en `lib/cabida-comercial.ts` en vez de crear un tipo nuevo — evita triplicar la definición y mantiene un único punto de verdad para los 4 formatos objetivo de Fase 18.
- `coberturaConocida` y `confianzaGlobal` son obligatorios (no opcionales) desde el día 1, siguiendo directamente la "truth" del plan (COMPE-05): ningún resultado de competencia puede omitir esta información.
- `competencia?` en `AnalisisCabidaComercial` queda opcional deliberadamente — permite que Plan 18-07 lo pueble más adelante sin requerir cambios en los consumidores actuales de Phase 16.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Los 4 tipos de competencia están listos para ser importados por los 5 planes restantes de Fase 18 (Overpass, seed list, geocoding SII, lógica de confianza TDD, orquestador) sin necesidad de reconciliar formas incompatibles.
- El guard de colisión de nombres queda activo y verificado — cualquier intento futuro de unificar `FormatoComercial` de cabida-comercial y terrenos-comercial romperá el typecheck.
- Sin bloqueos para Wave 2 de Fase 18 (planes 18-02 a 18-04, paralelos, dependen de este plan).

---
*Phase: 18-competencia-por-formato*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: lib/cabida-comercial.ts
- FOUND: tests/unit/cabida-comercial-tipos.test.ts
- FOUND: .planning/phases/18-competencia-por-formato/18-01-SUMMARY.md
- FOUND commit: 340680e
- FOUND commit: bc7eb0e
