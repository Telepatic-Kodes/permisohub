---
phase: 16-ubicacion-e-isocrona-motor-desacoplado
plan: 02
subsystem: geocoding
tags: [nominatim, geocoding, typescript-types, client-safe]

# Dependency graph
requires:
  - phase: 10-motor-de-zonificacion
    provides: geocodeDireccion() y patrón de throttle/fetchWithTimeout contra Nominatim en lib/geocoding.ts
provides:
  - "geocodeComunaCentroide(comuna) en lib/geocoding.ts — fallback de centroide de comuna vía Nominatim con parámetros estructurados (city=/country=Chile)"
  - "lib/cabida-comercial.ts — tipos client-safe canónicos (UbicacionCabida, UbicacionPrecision, IsocronaMetodo, IsocronaResultado, FormatoComercial, AnalisisCabidaComercial) + consultarCabidaComercial() fetch helper"
affects: [16-03, 16-04, 16-05, 17-*, 18-*, 19-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fallback de geocoding con parámetros estructurados Nominatim (city=/country=) en vez de q= libre, para queries de área administrativa vs. direcciones puntuales"
    - "Archivo de tipos client-safe + fetch helper (lib/cabida-comercial.ts) espejando el patrón ya establecido en lib/zonificacion.ts, separado de la lógica server-only"

key-files:
  created:
    - lib/cabida-comercial.ts
    - tests/unit/geocoding-comuna-centroide.test.ts
  modified:
    - lib/geocoding.ts

key-decisions:
  - "geocodeComunaCentroide() vive en el mismo archivo que geocodeDireccion() para reusar el throttle module-level compartido (mismo servicio Nominatim, mismo rate limit de 1.1s)"
  - "UbicacionPrecision deliberadamente NO incluye 'exacta' en v1.7 (mercado_locales_listings no tiene columna direccion) — unión abierta para agregar 'exacta' sin breaking change en un futuro modo standalone (CABI-03)"
  - "consultarCabidaComercial() (client-safe) se nombra distinto de obtenerAnalisisCabidaComercial() (server-only, reservado para Plan 16-04) siguiendo el precedente lookupZonificacion()/persistZonificacionParaProyecto()"

patterns-established:
  - "Pattern: fallback de geocoding a nivel de comuna usa Nominatim city=/country= estructurado, nunca q= de texto libre ni reuso de geocodeDireccion con direccion vacía"

# Metrics
duration: 12min
completed: 2026-08-03
---

# Phase 16 Plan 02: Geocoding de Centroide de Comuna + Tipos Client-Safe Summary

**geocodeComunaCentroide() (Nominatim city=/country= estructurado) en lib/geocoding.ts + lib/cabida-comercial.ts con los 6 tipos canónicos client-safe y el fetch helper consultarCabidaComercial() que consumirá el resto de la Fase 16**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-03T00:20:00Z
- **Completed:** 2026-08-03T00:32:02Z
- **Tasks:** 3
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- Agregado `geocodeComunaCentroide(comuna)` como fallback dedicado de centroide de comuna, distinto de `geocodeDireccion()`, usando parámetros estructurados de Nominatim (`city=`/`country=Chile`) en vez de `q=` libre
- Creado `lib/cabida-comercial.ts` con los tipos client-safe canónicos (`UbicacionCabida`, `UbicacionPrecision`, `IsocronaMetodo`, `IsocronaResultado`, `FormatoComercial`, `AnalisisCabidaComercial`, `CabidaComercialAnalisisResponse`) y el fetch helper `consultarCabidaComercial()`
- Tests unitarios confirmando que la query usa `city=`/`country=Chile` (no `q=`) y que un resultado vacío de Nominatim retorna `ok:false` sin lanzar

## Task Commits

Each task was committed atomically:

1. **Task 1: geocodeComunaCentroide() en lib/geocoding.ts** - `f2f771b` (feat)
2. **Task 2: lib/cabida-comercial.ts — tipos client-safe** - `60f8aba` (feat)
3. **Task 3: test de geocodeComunaCentroide** - `9816e4c` (test)

**Plan metadata:** (pending — will be recorded with this summary's commit)

## Files Created/Modified
- `lib/geocoding.ts` - Agregada `geocodeComunaCentroide(comuna)`, comparte throttle/fetchWithTimeout/User-Agent con `geocodeDireccion()`
- `lib/cabida-comercial.ts` - Tipos client-safe canónicos + `consultarCabidaComercial()` fetch helper hacia `/api/cabida-comercial/analisis`
- `tests/unit/geocoding-comuna-centroide.test.ts` - Tests de parámetros estructurados y manejo de resultado vacío

## Decisions Made
- `geocodeComunaCentroide()` en el mismo archivo que `geocodeDireccion()` para compartir el throttle module-level (mismo servicio Nominatim, mismo rate limit)
- `UbicacionPrecision` deja la unión abierta a un futuro `'exacta'` en vez de un boolean o enum cerrado de 2 valores
- Nombres distintos entre fetch helper client-safe (`consultarCabidaComercial`) y función pura server-only futura (`obtenerAnalisisCabidaComercial`, reservada para Plan 16-04), replicando el patrón `lookupZonificacion()`/`persistZonificacionParaProyecto()`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `lib/cabida-comercial.ts` define la forma canónica que Plan 16-04 (server orchestration) y Plan 16-05 (ruta + UI) van a producir/consumir
- `geocodeComunaCentroide()` queda listo para ser invocado como fallback desde `lib/cabida-comercial-server.ts` (Plan 16-04) cuando `geocodeDireccion()` falle
- Sin bloqueos para Plan 16-03/16-04/16-05

---
*Phase: 16-ubicacion-e-isocrona-motor-desacoplado*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: lib/geocoding.ts
- FOUND: lib/cabida-comercial.ts
- FOUND: tests/unit/geocoding-comuna-centroide.test.ts
- FOUND commit: f2f771b
- FOUND commit: 60f8aba
- FOUND commit: 9816e4c
