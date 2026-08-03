---
phase: 18-competencia-por-formato
plan: 04
subsystem: database
tags: [supabase, geocoding, nominatim, cache-through, cadenas-sii]

# Dependency graph
requires:
  - phase: 16-ubicacion-e-isocrona
    provides: "lib/geocoding.ts geocodeDireccion() — geocoder Nominatim con throttle y contrato { ok, lat, lng, displayName }"
  - phase: 09-automatizaciones (indirecto, vía 18-01/18-RESEARCH)
    provides: "tabla cadenas_sucursales (605 direcciones reales Walmart/SMU) ya en producción"
provides:
  - "Columnas lat/lng/geocodificado_el en cadenas_sucursales (migración aditiva aplicada en vivo)"
  - "obtenerCadenasGeocodificadasPorComuna(comuna) — geocoding on-demand con cache-through, exportada desde lib/cadenas-sucursales-server.ts"
affects: [18-06-composicion-con-cadenas-sii, 18-08-tab-competencia-por-formato]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache-through en la propia fila (lat/lng/geocodificado_el nullable) en vez de tabla de cache separada — evita el join extra que cabida_comercial_cache (16-03) sí necesita, porque acá cada dirección se geocodifica como máximo una vez en su vida."
    - "normalizarNombreComuna() aplicado en JS después de traer todas las filas activas (mismo patrón ya usado en obtenerSenalesExpansionPorComuna), nunca un .eq('comuna', ...) directo — cadenas_sucursales.comuna viene en MAYÚSCULAS sin tildes del SII."

key-files:
  created:
    - supabase/migrations/20260810_cadenas_sucursales_geocoding.sql
    - tests/unit/cadenas-sucursales-geocoding.test.ts
  modified:
    - lib/cadenas-sucursales-server.ts

key-decisions:
  - "Cache-through en la fila (no tabla separada): cada dirección SII se geocodifica una única vez en su vida útil, así que un cache dedicado como cabida_comercial_cache habría sido complejidad sin beneficio."
  - "Fallo de geocoding por fila es silencioso (fila se omite del resultado, mismo contrato { ok: false } que geocodeDireccion ya usa en Fase 16) — no se lanza excepción que tumbe el resto de la consulta de la comuna."
  - "La ingesta mensual existente (correrIngestaCadenasSucursales) no fue tocada — las 3 columnas nuevas son nullable y el upsert por (rut,calle,numero,comuna) nunca las sobreescribe, así que direcciones ya geocodificadas conservan su cache aunque el SII las vuelva a reportar el mes siguiente."

# Metrics
duration: ~15min
completed: 2026-08-02
---

# Phase 18 Plan 04: Geocoding on-demand de cadenas SII Summary

**`obtenerCadenasGeocodificadasPorComuna(comuna)` resuelve lat/lng reales para sucursales SII conocidas (Walmart/SMU) con cache-through persistido en la fila, verificado en vivo contra Supabase con coordenadas reales de Maipú.**

## Performance

- **Duration:** ~15 min (Tasks 1-2 automated; Task 3 checkpoint verified live twice — once by executor, once independently re-verified by orchestrator)
- **Started:** 2026-08-03T00:32:00Z
- **Completed:** 2026-08-03T00:34:30Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments
- Migración aditiva `lat`, `lng`, `geocodificado_el` en `cadenas_sucursales` aplicada en vivo contra el proyecto Supabase real (no solo escrita en disco)
- `obtenerCadenasGeocodificadasPorComuna(comuna)` geocodifica solo direcciones sin coordenadas todavía, persiste el resultado en la fila, y nunca vuelve a pagar el throttle de Nominatim para una dirección ya resuelta
- Verificación en vivo (doble, independiente) contra datos reales: comuna de Maipú resuelta a coordenadas geográficamente válidas (dentro de Chile), segunda consulta cache-hit instantánea, 3 direcciones no geocodificables excluidas limpiamente del resultado sin excepciones

## Task Commits

Each task was committed atomically:

1. **Task 1: Migración aditiva lat/lng/geocodificado_el en cadenas_sucursales** - `e88ca70` (feat)
2. **Task 2: obtenerCadenasGeocodificadasPorComuna() con cache-through** - `35eeea8` (feat)
3. **Task 3: Verificación humana — geocoding real con cache-through** - checkpoint only, no code commit; approved "aprobado" by user after independent orchestrator re-verification via live Supabase queries

**Plan metadata:** (this commit) `docs(18-04): complete geocoding on-demand de cadenas SII plan`

## Files Created/Modified
- `supabase/migrations/20260810_cadenas_sucursales_geocoding.sql` - ALTER TABLE aditivo, 3 columnas nullable con comentarios documentando el contrato de la ingesta mensual
- `lib/cadenas-sucursales-server.ts` - agrega `obtenerCadenasGeocodificadasPorComuna()` y la interfaz `CadenaGeocodificada`, reusa `geocodeDireccion()` de Fase 16 verbatim
- `tests/unit/cadenas-sucursales-geocoding.test.ts` - cubre cache-hit (no llama geocoder), primer geocoding (llama una vez + persiste vía `.update()`), y fallo silencioso (`geo.ok === false` no lanza, fila omitida)

## Decisions Made
- Cache-through en la propia fila en vez de una tabla de cache dedicada (ver key-decisions en frontmatter) — cada dirección SII conocida se geocodifica una única vez en su vida útil, a diferencia de `cabida_comercial_cache` (16-03) que cachea por combinación lat/lng redondeada + modo + minutos y sí necesita su propia tabla.
- Contrato de fallo silencioso idéntico al ya establecido por `geocodeDireccion()` en Fase 16: una fila que no puede geocodificarse simplemente no aparece en el resultado, en vez de lanzar y tumbar la consulta completa de la comuna.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Task 3 (checkpoint humano) fue verificado dos veces de forma independiente: primero por el agente ejecutor original, luego re-verificado en vivo por el orquestador vía queries directas a Supabase (`select ... from cadenas_sucursales where comuna ilike '%MAIPU%'`), confirmando coordenadas reales dentro de rango geográfico de Chile, comportamiento de cache-through (segunda consulta sin re-geocodificar), y exclusión limpia de 3 direcciones no resolubles. Usuario aprobó con "aprobado".

## User Setup Required

None - no external service configuration required. `SUPABASE_SERVICE_ROLE_KEY` ya estaba configurado en `.env.local` desde fases anteriores.

## Next Phase Readiness
- `obtenerCadenasGeocodificadasPorComuna()` queda lista como la pieza que Plan 18-06 (composición con cadenas SII) necesita para cruzar espacialmente un POI de Overpass contra una sucursal SII conocida y sustituir un tag OSM genérico por el nombre real de cadena ("Líder Express" en vez de "supermarket").
- Sin bloqueos. Plan 18-01 (tipos de competencia por formato) también completo — Fase 18 tiene 2/8 planes ejecutados (18-01, 18-04), ambos en Wave 1 sin dependencias entre sí.

---
*Phase: 18-competencia-por-formato*
*Completed: 2026-08-02*
