---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 03
subsystem: mercado-inmobiliario
tags: [supabase, mercado-locales, scoring, comparables]

# Dependency graph
requires:
  - phase: 13-01
    provides: "evaluarOportunidad() — función pura de scoring, fuente única de verdad para reasonCodes"
provides:
  - "obtenerOportunidadPorId(id) — listing individual por status='activo' O 'dado_de_baja', con bandas y reasonCodes calculados vía evaluarOportunidad()"
  - "obtenerComparablesOportunidad(params) — comparables reales por match exacto de comuna+tipo+operación, consultando mercado_locales_listings directamente (no reutiliza obtenerOportunidadesMercadoLocales)"
  - "obtenerHistorialPrecioListing(listingId) — historial COMPLETO de precio de un listing (no acotado a 7 días)"
  - "REASON_LABEL_DETALLE — versión extendida de REASON_LABEL para explicar reasonCodes en la ficha de detalle"
  - "REASON_LABEL re-exportado desde lib/mercado-locales-server.ts (hoy vive también como const local en oportunidades/page.tsx — 13-07 lo reemplaza)"
affects: [13-05, 13-06, 13-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Comparables/detalle calculan reasonCodes SOLO sobre el conjunto final ya ordenado/recortado, nunca sobre los cientos de candidatos crudos — evita N+1 de historial de precio", "null-goes-last en sorts de proximidad numérica: un valor null nunca se coerciona a 0 para participar en un Math.abs()"]

key-files:
  created: []
  modified: [lib/mercado-locales-server.ts]

key-decisions:
  - "obtenerComparablesOportunidad() consulta mercado_locales_listings directamente en vez de reutilizar obtenerOportunidadesMercadoLocales() — esa función descarta cualquier listing sin reasonCodes (línea 503 original), lo que produciría un subconjunto autoseleccionado de 'ya flageados' en vez del cohorte real comuna+tipo+operación que pide CONTEXT.md"
  - "obtenerOportunidadPorId() nunca filtra por status — a diferencia de la lista, un aviso dado_de_baja se puede seguir consultando por su ficha (ej. link compartido), exponiendo status='dado_de_baja' explícitamente en vez de devolver null/404"
  - "limit=5 por defecto en comparables (Claude's Discretion per CONTEXT.md) — consistente con MIN_COHORT_SIZE=15 ya usado en el resto del módulo"
  - "Sort de comparables por cercanía de UF/m²: candidatos con precioUfM2 conocido y sin él se ordenan en dos grupos separados (conM2 primero, sinM2 al final por proximidad de UF cruda) — nunca se trata null como 0"

patterns-established:
  - "reasonCodes en vistas de detalle/comparables se calculan solo sobre el resultado final ya filtrado/ordenado, reutilizando evaluarOportunidad() de 13-01 — nunca se reimplementa el cálculo de scoring"

# Metrics
duration: 2min
completed: 2026-08-02
---

# Phase 13 Plan 03: Capa de Datos para Ficha de Detalle Summary

**Tres funciones nuevas en `lib/mercado-locales-server.ts` — `obtenerOportunidadPorId()`, `obtenerComparablesOportunidad()` (con fuente de datos corregida vs. el research original) y `obtenerHistorialPrecioListing()` — todas reutilizando `evaluarOportunidad()` de 13-01 como única fuente de verdad de scoring**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-02T19:42:24Z
- **Completed:** 2026-08-02T19:44:15Z
- **Tasks:** 3 (2 con commit de código, 1 de verificación pura)
- **Files modified:** 1

## Accomplishments
- `obtenerOportunidadPorId(id)` — trae un listing individual sin filtrar por status, calcula bandas + reasonCodes con la misma lógica que la lista, expone `status`/`dadoDeBajaEl` explícitamente
- `obtenerHistorialPrecioListing(listingId)` — historial completo de precio (sin ventana de 7 días), reutilizado tanto dentro de `obtenerOportunidadPorId()` como disponible standalone para 13-05/13-06
- `obtenerComparablesOportunidad(params)` — consulta directa a `mercado_locales_listings` por comuna+tipo+operación exactos (nunca reutiliza `obtenerOportunidadesMercadoLocales()`), sort por cercanía de UF/m² con null-goes-last, reasonCodes calculados solo para el top 5 final
- `REASON_LABEL` y `REASON_LABEL_DETALLE` exportados desde este archivo, listos para que 13-07 reemplace la const local duplicada en `oportunidades/page.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: obtenerOportunidadPorId() + historial + labels** - `08ef64e` (feat)
2. **Task 2: obtenerComparablesOportunidad()** - `7f24561` (feat)
3. **Task 3: Verificación — sin regresión en scoring ni en call sites** - sin commit (verificación pura, ningún archivo modificado)

**Plan metadata:** (este commit)

## Files Created/Modified
- `lib/mercado-locales-server.ts` - Agregadas `REASON_LABEL`, `REASON_LABEL_DETALLE`, `PuntoHistorialPrecio`, `obtenerHistorialPrecioListing()`, `OportunidadDetalle`, `obtenerOportunidadPorId()`, `ComparableOportunidad`, `obtenerComparablesOportunidad()` — todo después de `obtenerOportunidadesMercadoLocales()`, antes de `export { obtenerValorUF }`

## Decisions Made
- `obtenerComparablesOportunidad()` consulta `mercado_locales_listings` directamente en vez de filtrar sobre `obtenerOportunidadesMercadoLocales()`, evitando el sesgo de "solo listings ya flageados como oportunidad" que documentó 13-RESEARCH.md
- `limit=5` por defecto para comparables (a discreción, sin bloqueo explícito en CONTEXT.md)
- reasonCodes de comparables se calculan solo para el top final ya recortado — evita traer historial de precio de hasta 500 candidatos descartados

## Deviations from Plan

None - plan executed exactly as written. El código agregado coincide con los bloques especificados en el plan; ambas verificaciones (`npx tsc --noEmit` y el grep de `obtenerOportunidadesMercadoLocales` filtrado por "comparable") pasaron sin cambios.

## Issues Encountered
Ninguno relevante a este plan. Se detectaron en `git log` dos commits de otro plan (13-04: `app/api/oportunidades-resumen/route.ts` y `resumen-tab.tsx`) intercalados cronológicamente entre los commits de este plan — ejecución concurrente de otro agente sobre el mismo repo sin branching (`branching_strategy: none`), consistente con lo ya observado en 13-01-SUMMARY.md. No tocan `lib/mercado-locales-server.ts`, sin conflicto.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
La capa de datos completa para la ficha de detalle existe: `obtenerOportunidadPorId()`, `obtenerComparablesOportunidad()` y `obtenerHistorialPrecioListing()` quedan disponibles para que 13-05/13-06/13-07 construyan la ficha visual sin reimplementar scoring ni consultas. Sin bloqueos.

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: lib/mercado-locales-server.ts
- FOUND: .planning/phases/13-refactor-de-scoring-dashboard-de-detalle/13-03-SUMMARY.md
- FOUND: commit 08ef64e (feat)
- FOUND: commit 7f24561 (feat)
- FOUND: export async function obtenerOportunidadPorId, obtenerComparablesOportunidad, obtenerHistorialPrecioListing, REASON_LABEL/REASON_LABEL_DETALLE in lib/mercado-locales-server.ts
