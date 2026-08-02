---
phase: 14-comparacion-lado-a-lado
plan: 01
subsystem: database
tags: [supabase, batch-fetch, n+1-prevention, mercado-inmobiliario]

# Dependency graph
requires:
  - phase: 13-refactor-scoring-dashboard-detalle
    provides: "obtenerOportunidadPorId(), evaluarOportunidad(), OportunidadDetalle, BandasMercadoLocal en lib/mercado-locales-server.ts"
provides:
  - "construirOportunidadDetalle() — helper interno puro (sin I/O) que calcula OportunidadDetalle a partir de listing+bandas+historial ya resueltos"
  - "obtenerOportunidadesPorIds(ids: string[]): Promise<OportunidadDetalle[]> — capa de datos en lote para la comparación lado a lado"
affects: [14-02-selector-comparacion, 14-03-ruta-comparar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extracción de cálculo puro (sin I/O) desde una función con fetch, para reusar la misma lógica en variantes single vs. batched sin duplicar código ni reintroducir N+1"
    - "Cache de bandas por Map<string, Promise<...>> keyed por comuna|tipoPropiedad|operacion (mismo patrón que compararPortafolioConMercado en lib/propiedades-portafolio-server.ts)"

key-files:
  created: []
  modified:
    - lib/mercado-locales-server.ts

key-decisions:
  - "construirOportunidadDetalle() se extrajo como función privada NO exportada (no un archivo nuevo) — mantiene todo el dominio de 'oportunidad' cohesionado en un solo módulo, como ya establece Fase 13"
  - "El helper recibe historialReciente ya filtrado a 7 días (no hace su propio fetch) — el caller es responsable del I/O, lo que permite que obtenerOportunidadesPorIds haga una sola query de historial batched en vez de N"
  - "obtenerOportunidadesPorIds no valida homogeneidad de tipo/operación ni longitud de ids, ni filtra por status — es pura capa de datos; esas reglas de negocio son responsabilidad de la ruta /comparar (Plan 14-03)"

# Metrics
duration: 25min
completed: 2026-08-02
---

# Phase 14 Plan 01: Capa de Datos para Comparación en Lote Summary

**`obtenerOportunidadesPorIds(ids)` en lib/mercado-locales-server.ts trae hasta 5 oportunidades con 1 query de listings + 1 de historial + máximo 1 de bandas por combinación comuna×tipo×operación, reusando el mismo cálculo que la ficha de detalle vía un helper extraído.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-02T20:19:00Z
- **Completed:** 2026-08-02T20:32:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `construirOportunidadDetalle()` extraída como función privada pura (sin I/O) que reproduce exactamente el cálculo que antes vivía inline en `obtenerOportunidadPorId()` (CLP→UF, precioUfM2, reasonCodes vía `evaluarOportunidad()`)
- `obtenerOportunidadPorId()` reescrita para hacer su propio fetch de listing/bandas/historial y delegar el cálculo al helper — cero cambio de comportamiento observable, verificado campo por campo contra la versión batched con 3 ids reales
- `obtenerOportunidadesPorIds(ids)` exportada: 1 sola query `.in('id', ids)` a listings, 1 sola query `.in('listing_id', ids)` a historial (filtrada a 7 días en la query misma, no en JS), y cache de bandas por combinación exacta comuna|tipoPropiedad|operacion — nunca 1 query por oportunidad ni proporcional a `ids.length`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extraer construirOportunidadDetalle() de obtenerOportunidadPorId()** - `36f2c6d` (refactor)
2. **Task 2: Agregar obtenerOportunidadesPorIds(ids) con fetch batched** - `8cc0137` (feat)

## Files Created/Modified
- `lib/mercado-locales-server.ts` - Agrega `construirOportunidadDetalle()` (privada, sin I/O) y `obtenerOportunidadesPorIds()` (exportada); `obtenerOportunidadPorId()` reescrita para usar el helper sin cambiar su firma pública

## Decisions Made
- Se adoptó la recomendación de 14-RESEARCH.md (Open Question 4): extraer el bloque de cálculo en vez de duplicarlo o llamar `obtenerOportunidadPorId()` en loop, evitando reintroducir el pitfall de N+1 que el research de milestone marcó explícitamente.
- El orden del array devuelto por `obtenerOportunidadesPorIds()` NO garantiza coincidir con el orden de `ids` de entrada (documentado en el plan; el caller de Plan 14-03 reordena si lo necesita).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `tsx` no estaba instalado en el proyecto para la verificación manual del Task 2 (llamar `obtenerOportunidadesPorIds` con ids reales). Se instaló temporalmente vía `npm install --no-save tsx` (node_modules está gitignored, sin impacto en package.json/lock), se corrió el script de verificación contra la base real vía `node --env-file=.env.local`, y se eliminó el script temporal al terminar. No quedó ningún artefacto de esta verificación en el repo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `obtenerOportunidadesPorIds(ids)` está lista para que la ruta `/oportunidades/comparar` (Plan 14-03) la consuma directamente — devuelve `OportunidadDetalle[]` con la misma forma exacta que ya usa la ficha de detalle individual, sin filtrar por status ni validar homogeneidad (esa validación vive en la UI de Plan 14-03).
- Plan 14-02 (selector de comparación) se ejecutó en paralelo durante esta sesión (ver commits `07ef7f7`/`ecf1a71`) — sin conflicto de archivos con este plan (14-01 solo tocó `lib/mercado-locales-server.ts`).

---
*Phase: 14-comparacion-lado-a-lado*
*Completed: 2026-08-02*

## Self-Check: PASSED
- lib/mercado-locales-server.ts: FOUND
- .planning/phases/14-comparacion-lado-a-lado/14-01-SUMMARY.md: FOUND
- Commit 36f2c6d: FOUND
- Commit 8cc0137: FOUND
