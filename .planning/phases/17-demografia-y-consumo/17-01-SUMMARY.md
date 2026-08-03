---
phase: 17-demografia-y-consumo
plan: 01
subsystem: database
tags: [arcgis, censo-2017, supabase, migration, geojson, vitest]

# Dependency graph
requires:
  - phase: 16-ubicacion-e-isocrona
    provides: "cabida_comercial_cache (tabla angosta con isocrona_status), precedente de migración aditiva"
provides:
  - "obtenerPoblacionEnPoligono(geometria) — cálculo de población/viviendas en vivo por intersección espacial contra el Censo 2017, puro por geometría"
  - "geometriaGeoJsonARings() — conversión GeoJSON Polygon/MultiPolygon → Esri rings, único lugar de esta conversión en el repo"
  - "Columnas demografia_* en cabida_comercial_cache (aplicadas en vivo en Supabase)"
  - "Corrección documentada del URL correcto del FeatureServer de manzanas censales (services9.arcgis.com/kKJR3Qt68ohAWuet) vs. el URL incorrecto citado a nivel de milestone en STACK.md/ARCHITECTURE.md (services3.arcgis.com/cTnMkBRk4HWkUCRo, cero cobertura RM)"
affects: [17-03, 18-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consulta POST (nunca GET) a FeatureServer ArcGIS para evitar límites de longitud de URL con polígonos de isócrona reales"
    - "Contrato non-throw explícito { ok: boolean, ...ceros } ante cualquier fallo de red/parseo — mismo criterio que geocodeDireccion()"
    - "Migración aditiva sobre tabla ya existente (cabida_comercial_cache), independiente de que el wiring final (Plan 17-03) exista todavía"
    - "Guard de regresión de URL en tests: assertion explícita de que el fetch NUNCA contiene el URL incorrecto citado a nivel de milestone"

key-files:
  created:
    - lib/censo-manzana-server.ts
    - supabase/migrations/20260811_cabida_comercial_cache_demografia.sql
    - tests/unit/censo-manzana-server.test.ts
  modified:
    - .planning/data-sources.yaml

key-decisions:
  - "URL correcto del FeatureServer confirmado en vivo (services9.arcgis.com/kKJR3Qt68ohAWuet, 49.974 manzanas en RM) y hardcoded con comentario explícito citando 17-RESEARCH.md, para blindar contra un revert accidental al URL incorrecto de STACK.md/ARCHITECTURE.md (services3.arcgis.com/cTnMkBRk4HWkUCRo, 0 cobertura RM, falla silenciosamente con features:[] en vez de error)"
  - "obtenerPoblacionEnPoligono() es pura por geometría — nunca acepta oportunidadId ni depende de lib/cabida-comercial-server.ts — para permitir testing/verificación independiente de Phase 16"
  - "features:[] se trata como ok:true con totales en 0, NUNCA como error — un polígono real puede genuinamente no tocar ninguna manzana; distinguirlo del failure mode del URL incorrecto queda documentado en el test suite, no solo en el código"
  - "Migración demografia_* aplicada en vivo contra Supabase por el orquestador vía acceso directo a Supabase MCP (el agente ejecutor de Task 1 no tenía tools MCP bound en su sesión, mismo fallback ya documentado en 10-01-SUMMARY.md/16-03-SUMMARY.md)"

patterns-established:
  - "Comentario de código citando la fuente de investigación (17-RESEARCH.md) junto a una constante crítica, para que un mantenedor futuro no revierta silenciosamente una corrección de bug ya verificada en vivo"

# Metrics
duration: ~5min
completed: 2026-08-03
---

# Phase 17 Plan 01: Módulo de población censal (Censo 2017 por manzana) Summary

**`obtenerPoblacionEnPoligono()` calcula población/viviendas en vivo intersectando cualquier polígono GeoJSON contra el FeatureServer ArcGIS correcto de manzanas del Censo 2017 (49.974 manzanas en RM) — corrigiendo el URL con cero cobertura RM que STACK.md/ARCHITECTURE.md citaban como "confirmado en vivo" a nivel de milestone.**

## Performance

- **Duration:** ~5 min (3 tasks: 2 auto + 1 checkpoint human-verify)
- **Tasks:** 3/3 completos
- **Files modified:** 4 (3 creados, 1 modificado)

## Accomplishments

- `lib/censo-manzana-server.ts`: `obtenerPoblacionEnPoligono(geometria)` puro por geometría, consulta POST en vivo contra `services9.arcgis.com/kKJR3Qt68ohAWuet/.../Manzanas_censo_2017/FeatureServer/0/query`, agrega `TOTAL_PERS`/`TOTAL_VIVI`, deduplica comunas tocadas, nunca lanza (`{ ok, ...ceros }` explícito ante cualquier fallo).
- `geometriaGeoJsonARings()`: conversión GeoJSON Polygon/MultiPolygon → Esri rings, único lugar de esta lógica en el repo.
- 8/8 tests unitarios en verde, incluyendo el guard de regresión de URL más importante del plan: assertion explícita de que el fetch nunca contiene `services3.arcgis.com/cTnMkBRk4HWkUCRo` (el URL incorrecto citado a nivel de milestone).
- Verificación en vivo con curl real (Task 3, checkpoint aprobado): el servicio correcto retorna manzanas reales de Providencia con `TOTAL_PERS`/`TOTAL_VIVI` numéricos no-cero; el servicio incorrecto retorna HTTP 200 con `features:[]` para el mismo polígono — confirmando que el guard de URL del Task 2 protege contra el failure mode más peligroso posible (ceros silenciosos, no un error visible).
- Migración `demografia_*` (6 columnas aditivas: `demografia_status`, `demografia_total_personas`, `demografia_total_viviendas`, `demografia_manzanas_intersectadas`, `demografia_censo_ano`, `demografia_consultado_el`) aplicada en vivo contra `cabida_comercial_cache` en el proyecto Supabase real, verificada por el orquestador vía consulta directa a `information_schema.columns`.
- Entrada `ine-censo-2017-manzana` agregada a `.planning/data-sources.yaml`, documentando explícitamente la corrección del URL y por qué `called_from` queda vacío hasta el wiring de Plan 17-03.

## Task Commits

1. **Task 1: Migración aditiva demografia_* + lib/censo-manzana-server.ts** - `7789fdf` (feat)
2. **Task 2: Tests unitarios — agregación, exceededTransferLimit, fallos, y guard contra el URL incorrecto** - `3128360` (test)
3. **Task 3: Verificación en vivo contra el servicio ArcGIS real** - checkpoint human-verify, sin commit propio (verificación evidenciada con curl real por el agente ejecutor; migración confirmada aplicada en el proyecto real por el orquestador vía Supabase MCP directo)

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `lib/censo-manzana-server.ts` - `obtenerPoblacionEnPoligono()` + `geometriaGeoJsonARings()`, URL corregido y comentado
- `supabase/migrations/20260811_cabida_comercial_cache_demografia.sql` - 6 columnas `demografia_*` aditivas sobre `cabida_comercial_cache`
- `tests/unit/censo-manzana-server.test.ts` - 8 casos: agregación, vacío-no-error, paginado, fallo-nunca-lanza, guard de URL correcto/incorrecto, conversión de geometría (Polygon/MultiPolygon)
- `.planning/data-sources.yaml` - entrada `ine-censo-2017-manzana`

## Decisions Made

Ver `key-decisions` en el frontmatter. La decisión central del plan es la corrección del URL del FeatureServer (services9 en vez de services3), verificada en vivo dos veces: primero en `17-RESEARCH.md`, y de nuevo en el checkpoint del Task 3 de este plan, con el URL incorrecto probado en paralelo para dejar evidencia concreta del failure mode silencioso que el guard de tests previene.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito. El único punto de fricción operativa (el agente ejecutor de Task 1 no tenía tools MCP de Supabase bound en su sesión para aplicar la migración) es el mismo patrón de fallback ya documentado en `10-01-SUMMARY.md` y `16-03-SUMMARY.md` — no es una deviation del plan, es una limitación de tooling de sesión resuelta por el orquestador con acceso directo.

## Issues Encountered

Ninguno bloqueante. La aplicación de la migración quedó pendiente del agente ejecutor de Task 1 (sin tools MCP bound) y fue completada y verificada de forma independiente por el orquestador antes de cerrar este plan — 6 columnas `demografia_*` confirmadas presentes en `cabida_comercial_cache` vía `information_schema.columns`.

## User Setup Required

None - no external service configuration required (el FeatureServer de ArcGIS es público, sin API key).

## Next Phase Readiness

- `obtenerPoblacionEnPoligono()` está lista para ser invocada de forma independiente, hoy, con cualquier `GeoJSON.Polygon`/`MultiPolygon` — no depende de que Phase 16 (isócrona) esté cerrada ni de que `lib/cabida-comercial-server.ts` exista.
- `cabida_comercial_cache` tiene schema listo (`demografia_*`) para que Plan 17-03 (gateado por Phase 16) haga cache-through sin fricción de migración pendiente.
- Plan 17-02 (consumo-macro-zona, EPF/CASEN) corre en paralelo, sin dependencia de este plan.
- Ningún blocker conocido para Plan 17-03 más allá de la disponibilidad de `ORS_API_KEY` de Phase 16 (16-01, pausado por 403 de HeiGIT — no bloqueante para este plan).

---
*Phase: 17-demografia-y-consumo*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `lib/censo-manzana-server.ts`
- FOUND: `supabase/migrations/20260811_cabida_comercial_cache_demografia.sql`
- FOUND: `tests/unit/censo-manzana-server.test.ts`
- FOUND: commit `7789fdf`
- FOUND: commit `3128360`
- FOUND: commit `5a68662` (docs: complete plan)
