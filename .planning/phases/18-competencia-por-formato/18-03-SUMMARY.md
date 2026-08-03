---
phase: 18-competencia-por-formato
plan: 03
subsystem: cabida-comercial
tags: [typescript, geocoding, nominatim, testing, vitest, cabida-comercial, competencia, data-sources]

# Dependency graph
requires:
  - phase: 18-competencia-por-formato
    provides: "CompetidorDetectado, FormatoComercial (Plan 18-01) — tipos que la seed list produce"
provides:
  - "lib/strip-power-centers-chile.ts — STRIP_POWER_CENTERS_CHILE (25 filas RM, 18 pre-geocodificadas reales) + obtenerCompetidoresSeedList(formato, origen, radioM)"
  - "scripts/geocode-strip-power-seed.mjs — script auditable de geocoding one-shot contra Nominatim real (no repetible en cada request)"
  - "Entrada strip-power-centers-chile-seed en .planning/data-sources.yaml documentando el gap conocido (Grupo Patio, Más Center sin activos nombrados)"
affects: [18-06, 18-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Array estático git-versionado (no tabla DB) para datos de mantenimiento infrecuente sin pipeline de ingesta — mismo patrón editorial que CADENAS_RUT_CONOCIDOS en lib/scrapers/sii-nomina-sucursales.ts"
    - "Geocoding pre-computado una sola vez vía script auditable, coordenadas literales committeadas — nunca geocoding on-demand para datos que no cambian"
    - "Invariante de datos verificada por test: toda fila con direccion !== null tiene lat/lng !== null (guard contra geocoding silenciosamente faltante)"

key-files:
  created:
    - lib/strip-power-centers-chile.ts
    - tests/unit/strip-power-centers-chile.test.ts
    - scripts/geocode-strip-power-seed.mjs
  modified:
    - .planning/data-sources.yaml

key-decisions:
  - "Filas sin dirección confirmada en el research (.planning/research/SEED-STRIP-POWER-CENTERS-CHILE.md) quedan con direccion/lat/lng: null a propósito, visibles solo para auditoría — nunca coordenadas fabricadas ni aproximadas"
  - "Gap de Grupo Patio y Más Center (cero activos nombrados en la lista, pese a ser el líder de mercado y un operador de ~30 strip centers) documentado explícitamente en data-sources.yaml, citado por lib/competencia-formato.ts (Plan 18-05) para evitar falso 'confirmado: sin competencia'"

patterns-established:
  - "Script de geocoding auditable (scripts/geocode-strip-power-seed.mjs) como artefacto permanente en el repo, no un script desechable — permite re-correr si se agregan filas nuevas al seed doc"

# Metrics
duration: ~35min
completed: 2026-08-03
---

# Phase 18 Plan 03: Seed List de Strip/Power Centers Summary

**lib/strip-power-centers-chile.ts — 25 strip/power centers de la Región Metropolitana convertidos del research SEED-STRIP-POWER-CENTERS-CHILE.md a un array TypeScript estático, con 18 filas pre-geocodificadas contra Nominatim real (nunca fabricadas) y 7 filas explícitamente sin lat/lng donde el research no confirmó dirección**

## Performance

- **Duration:** ~35 min (incluye 2 intentos de cierre que sufrieron stalls de infraestructura transitorios, sin relación al código)
- **Completed:** 2026-08-03

## Accomplishments
- `STRIP_POWER_CENTERS_CHILE` con 25 filas RM, cruce real 1:1 contra `.planning/research/SEED-STRIP-POWER-CENTERS-CHILE.md`
- `obtenerCompetidoresSeedList(formato, origen, radioM)` filtra por formato y radio, excluyendo automáticamente filas sin lat/lng
- Invariante verificada por test: ninguna fila con `direccion !== null` puede quedar con `lat`/`lng: null` sin que el test falle
- Entrada nueva en `data-sources.yaml` documentando el gap de cobertura (Grupo Patio, Más Center) para que Plan 18-05 lo cite en la degradación de confianza

## Task Commits

1. **Task 1: Geocodificar las direcciones reales del seed doc (script auditable, ejecutado una vez)** - `d03774a` (feat)
2. **Task 2: lib/strip-power-centers-chile.ts + obtenerCompetidoresSeedList() + entrada en data-sources.yaml** - `512a835` (feat)

**Plan metadata:** cerrado por el orquestador tras verificación independiente (tsc limpio, tests pasando) — el agente ejecutor original tuvo dos stalls de infraestructura consecutivos (sin progreso 600s) durante el cierre de Task 2, sin dejar el código en estado roto.

## Files Created/Modified
- `lib/strip-power-centers-chile.ts` - Array estático + `obtenerCompetidoresSeedList()`
- `tests/unit/strip-power-centers-chile.test.ts` - 6 tests: invariante de geocoding, rango geográfico de Chile, presencia de ambos formatos, filtro por formato/radio, exclusión de filas sin coordenadas
- `scripts/geocode-strip-power-seed.mjs` - Script de geocoding one-shot contra Nominatim
- `.planning/data-sources.yaml` - Nueva entrada `strip-power-centers-chile-seed`

## Decisions Made
- Ver `key-decisions` en el frontmatter — filas sin dirección quedan explícitamente sin coordenadas (nunca fabricadas), y el gap de Grupo Patio/Más Center queda documentado como riesgo de falso negativo, no oculto.

## Deviations from Plan

None - plan ejecutado según lo escrito. Los stalls de infraestructura durante el cierre no afectaron el contenido del código, solo retrasaron el commit/documentación final.

## Issues Encountered

Dos intentos consecutivos de agente para cerrar Task 2 (commit + SUMMARY.md) sufrieron un stall de infraestructura (sin progreso por 600s, watchdog no se recuperó) — no relacionado con el código, que ya estaba completo y correcto en ambos intentos. El orquestador verificó independientemente (`npx tsc --noEmit` limpio, `npm run test -- tests/unit/strip-power-centers-chile.test.ts` con exit 0, diff de `data-sources.yaml` confirmado aislado a la nueva entrada) antes de commitear directamente y cerrar el plan sin un tercer intento de agente.

## User Setup Required

None - no external service configuration required. El geocoding ya está pre-computado y committeado; no requiere Nominatim en runtime para las 25 filas existentes (solo si se agregan filas nuevas en el futuro, re-corriendo el script).

## Next Phase Readiness
- `obtenerCompetidoresSeedList()` listo para ser consumido por el orquestador async de Plan 18-06 junto con Overpass (18-02) y geocoding SII (18-04)

---
*Phase: 18-competencia-por-formato*
*Completed: 2026-08-03*
