---
phase: 19-veredicto-metodologia-mapa-y-tab
plan: 02
subsystem: ui
tags: [leaflet, react, geojson, mapa, cabida-comercial]

# Dependency graph
requires:
  - phase: 11-vista-de-zonificacion-en-el-proyecto
    provides: "Patrón probado de integración Leaflet (dynamic import, L.geoJSON, L.divIcon) en components/proyecto/zonificacion-mapa.tsx"
  - phase: 18-competencia-por-formato
    provides: "CompetidorDetectado (lib/cabida-comercial.ts) con lat/lng no-opcionales"
provides:
  - "CabidaComercialMapa: componente Leaflet client que renderiza el polígono del área de influencia (Polygon | MultiPolygon) + pines de competidores con popup, verificado en vivo contra fixture"
affects: [19-04-tab-cabida-comercial]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Componente NUEVO clonado de zonificacion-mapa.tsx (no extensión) — dominio distinto (isócrona/radio + competidores vs. un único polígono PRC), mismo criterio recomendado en 19-RESEARCH.md"
    - "Paleta de color deliberadamente distinta de zonificacion-mapa.tsx (#16a34a verde vs. #2563eb azul) para evitar confundir 'área de influencia comercial' con 'polígono de zonificación PRC' cuando ambos tabs coexisten en memoria del usuario"
    - "L.geoJSON(...).getBounds()/.fitBounds() para encuadre automático — sin dependencia de turf, mismo criterio que zonificacion-mapa.tsx"

key-files:
  created:
    - components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-mapa.tsx
  modified: []

key-decisions:
  - "Componente acepta geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon desde el día 1 (no solo Polygon como ZonaPolygon) porque IsocronaResultado.geometria de lib/cabida-comercial.ts ya está tipado así — evita que Plan 19-04 tenga que tocar este componente al integrar datos reales"
  - "Cero dependencia dura de lib/cabida-comercial-server.ts, lib/isocrona-server.ts ni el tab de Fase 16 — el componente toma GeoJSON + array de pines como props planos, verificable con un fixture a mano hoy mismo"
  - "Página de preview temporal (app/dev-preview-cabida-mapa/page.tsx) eliminada tras la aprobación del checkpoint, tal como el plan lo prescribe — no debía quedar en el repo"

patterns-established:
  - "Cuando un nuevo mapa Leaflet se agrega a este codebase, clonar la estructura de zonificacion-mapa.tsx (única integración Leaflet probada) pero con paleta de color propia si coexiste visualmente con otro mapa en el mismo flujo de usuario"

# Metrics
duration: ~10min (Task 1) + checkpoint de verificación en vivo
completed: 2026-08-03
---

# Phase 19 Plan 02: Componente CabidaComercialMapa Summary

**Mapa Leaflet client-side que renderiza el polígono del área de influencia comercial (Polygon | MultiPolygon, color verde #16a34a) + pines rojos de competidores con popup nombre/distancia, clonado de zonificacion-mapa.tsx pero con paleta y props propios — verificado en vivo con Playwright contra un fixture real de Providencia.**

## Performance

- **Duration:** ~10 min (Task 1, código) + verificación visual en vivo (Task 2, checkpoint)
- **Completed:** 2026-08-03
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1 permanente (componente) + 1 temporal creado y eliminado (página de preview)

## Accomplishments
- `components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-mapa.tsx` creado: exporta `CabidaComercialMapa`, clona la estructura de `zonificacion-mapa.tsx` (dynamic import de leaflet, `L.geoJSON`, `L.divIcon`) con tres diferencias deliberadas — acepta `Polygon | MultiPolygon`, pinta el área de influencia en verde (#16a34a) en vez de azul, y agrega pines rojos de competidores con popup `"{nombre} — {distancia formateada}"`.
- `npx tsc --noEmit` y `eslint` limpios sobre el archivo nuevo.
- Verificación visual end-to-end aprobada dos veces: primero por el executor en la sesión previa, y de forma independiente por el orquestador vía Playwright contra el dev server real (`http://localhost:3000/dev-preview-cabida-mapa`) — los 7 criterios del checkpoint confirmados con capturas: mapa centrado cerca de Providencia, marcador azul de origen, polígono verde, 3 pines rojos, popup real al hacer click ("Unimarc Providencia — 320 m"), `fitBounds` automático al polígono, y 0 errores de consola (solo warnings benignos recurrentes de Fast Refresh/font-preload del dev server, no relacionados al componente).
- Página de preview temporal (`app/dev-preview-cabida-mapa/`) eliminada tras la aprobación — no quedó en el repo ni fue comiteada.

## Task Commits

Each task was committed atomically:

1. **Task 1: Componente CabidaComercialMapa** - `8198a9b` (feat)
2. **Task 2: Verificación visual en vivo contra fixture** - sin commit propio (checkpoint de verificación; el archivo temporal de preview fue creado y luego eliminado sin entrar al historial de git)

**Plan metadata:** (este commit, docs: complete plan)

## Files Created/Modified
- `components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-mapa.tsx` - `CabidaComercialMapa`: mapa Leaflet client-side, props `{ lat, lng, geometria, competidores, className? }`, polígono verde de área de influencia + pines rojos de competidores con popup, `fitBounds` automático al polígono.

## Decisions Made
Ninguna decisión de arquitectura nueva más allá de las ya heredadas del plan (ver `key-decisions` en el frontmatter): tipo de geometría `Polygon | MultiPolygon` desde el día 1, paleta de color distinta a `zonificacion-mapa.tsx`, cero dependencia dura de artefactos de Fase 16/17/18 todavía inexistentes.

## Deviations from Plan

None - plan executed exactly as written. El componente se construyó verbatim según el skeleton del plan; la verificación visual confirmó los 7 criterios sin necesidad de ajustes ni iteración.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`CabidaComercialMapa` queda listo para que Plan 19-04 (gateado por Phase 16/18-07) lo importe y le pase `analisis.isocrona.geometria` y `analisis.competencia?.competidores ?? []` el día que esos artefactos existan, sin necesidad de modificar este componente. Sin blockers para este plan.

---
*Phase: 19-veredicto-metodologia-mapa-y-tab*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: components/mercado-inmobiliario/oportunidad-detalle/cabida-comercial-mapa.tsx
- FOUND commit: 8198a9b (feat)
- CONFIRMED: app/dev-preview-cabida-mapa/ deleted, not present in git status
