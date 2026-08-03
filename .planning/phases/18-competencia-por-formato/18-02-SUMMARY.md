---
phase: 18-competencia-por-formato
plan: 02
subsystem: cabida-comercial
tags: [overpass, geospatial, turf, testing, vitest, cabida-comercial, competencia]

# Dependency graph
requires:
  - phase: 18-competencia-por-formato
    provides: "CompetidorDetectado, FormatoComercial (Plan 18-01) — tipos que este módulo produce"
provides:
  - "lib/overpass-competencia.ts — obtenerCompetidoresOverpass(lat, lng, radioM) que consulta Overpass API por shop=supermarket|convenience|mall|department_store y retorna CompetidorDetectado[] real (nombre, tag, coordenadas, distancia), en vez del conteo agregado que lib/terrenos-ubicacion.ts hace para el dominio de Terrenos"
  - "Throttle de 5s entre requests a Overpass (módulo nuevo, independiente del throttle de lib/terrenos-ubicacion.ts)"
  - "Filtro de radio fijo generoso + turf.booleanPointInPolygon() (decisión bloqueada del research de Fase 18) para precisión, sin depender de la isócrona real de Fase 16 (todavía no construida)"
affects: [18-06, 18-08]

# Tech tracking
tech-stack:
  added: ["@turf/turf"]
  patterns:
    - "Módulo nuevo y paralelo (lib/overpass-competencia.ts) en vez de modificar lib/terrenos-ubicacion.ts — mismo dominio externo (Overpass) pero scope de dominio distinto (Terrenos vs. Cabida Comercial), evita acoplar dos features no relacionadas"
    - "out center tags en la Overpass QL (en vez de out count) para obtener nombre/coordenadas por POI, no solo un agregado"

key-files:
  created:
    - lib/overpass-competencia.ts
    - tests/unit/overpass-competencia.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "RADIO_COMPETENCIA_M fijo (constante, 3000m) en vez de radio calculado dinámicamente — decisión ya bloqueada por el research de Fase 18, evita depender de la isócrona real de Phase 16 que todavía no existe"
  - "turf.booleanPointInPolygon() reservado para cuando exista una isócrona real que filtrar; con radio simple el filtro es solo por distancia euclidiana"
  - "Mapeo de tag OSM a formato: shop=supermarket|mall|department_store → supermercado, shop=convenience → minimarket"

patterns-established:
  - "Verificación humana con Overpass real (no mocks) contra 2 direcciones conocidas de Santiago antes de aceptar el checkpoint — mismo estándar que zonificación/Overpass en Fase 16/Terrenos"

# Metrics
duration: ~25min
completed: 2026-08-03
---

# Phase 18 Plan 02: Extensión de Overpass para Competencia por Formato Summary

**Nuevo módulo lib/overpass-competencia.ts que consulta Overpass API real por POIs de supermercado/minimarket con nombre y distancia, verificado en vivo contra Providencia y Las Condes (291 y 204 competidores reales respectivamente, incluyendo cadenas reconocibles como Unimarc, Líder Express y Cenco Alto Las Condes)**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-03

## Accomplishments
- `obtenerCompetidoresOverpass(lat, lng, radioM)` retorna una lista real de competidores (nombre, tag OSM, coordenadas, distancia en metros), extendiendo el patrón de conteo agregado ya existente en `lib/terrenos-ubicacion.ts` a un módulo nuevo con datos POI completos
- Throttle de 5s entre requests confirmado funcionando en vivo (dos llamadas consecutivas, la segunda esperó el intervalo completo antes de disparar el fetch)
- Verificación humana con datos reales: 291 competidores cerca de Av. Providencia 2124 y 204 cerca de Av. Apoquindo 4700, sin 406/429, con nombres de cadena reales dominando el resultado

## Task Commits

1. **Task 1: Instalar @turf/turf + scaffolding del módulo** - `26256fe` (feat)
2. **Task 2: Parseo → CompetidorDetectado[] + filtro por isócrona real** - `3924cc1` (feat)
3. **Task 3: Verificación humana — consulta Overpass real contra dirección conocida** - checkpoint aprobado por el orquestador (sin commit de código, solo verificación)

**Plan metadata:** cerrado en esta sesión de continuación tras un error de conexión transitorio en el primer intento de cierre.

## Files Created/Modified
- `lib/overpass-competencia.ts` - Módulo nuevo: query Overpass QL, throttle, parseo a `CompetidorDetectado[]`, mapeo de tag→formato
- `tests/unit/overpass-competencia.test.ts` - Tests unitarios del parseo y mapeo
- `package.json` / `package-lock.json` - Agrega `@turf/turf`

## Decisions Made
- Radio fijo generoso (3000m) + `turf.booleanPointInPolygon()` reservado para isócrona real futura, en vez de radio calculado — decisión ya bloqueada por el research de Fase 18, evita acoplar este plan a Phase 16 (todavía no construida)
- Módulo paralelo a `lib/terrenos-ubicacion.ts`, no una extensión de ese archivo — dominios distintos (Terrenos vs. Cabida Comercial) aunque comparten Overpass como fuente externa

## Deviations from Plan

None - plan ejecutado según lo escrito.

## Issues Encountered

El primer intento de cerrar este plan (escribir SUMMARY.md tras el checkpoint aprobado) terminó en un error de conexión API a mitad de respuesta — no relacionado con el código ni con el trabajo ya hecho. Reintentado en esta sesión; Tasks 1-3 ya estaban completos y verificados, solo faltaban los artefactos de cierre.

## User Setup Required

None - no external service configuration required beyond Overpass API, que no requiere key (mismo criterio que Nominatim ya en uso).

## Next Phase Readiness
- `obtenerCompetidoresOverpass()` listo para ser consumido por el orquestador async de Plan 18-06, junto con la seed list (18-03) y el geocoding SII (18-04)

---
*Phase: 18-competencia-por-formato*
*Completed: 2026-08-03*
