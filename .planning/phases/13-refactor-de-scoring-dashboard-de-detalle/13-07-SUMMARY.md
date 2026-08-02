---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 07
subsystem: ui
tags: [next-server-component, react, mercado-inmobiliario, oportunidad-detalle, next-link]

# Dependency graph
requires:
  - phase: 13-03
    provides: "obtenerOportunidadPorId/obtenerComparablesOportunidad/obtenerHistorialPrecioListing/obtenerBandasMercadoLocales + REASON_LABEL en lib/mercado-locales-server.ts"
  - phase: 13-04
    provides: "ResumenTab (streaming bajo demanda) + ResumenOportunidadContexto en lib/resumen-oportunidad-prompts.ts"
  - phase: 13-05
    provides: "PosicionamientoTab (banda de precio vs. cohorte + banner de muestra chica + rentabilidad implícita de zona)"
  - phase: 13-06
    provides: "HistorialTab + ComparablesTab (componentes presentacionales puros)"
provides:
  - "Ruta navegable /mercado-inmobiliario/oportunidades/[id] — Server Component que fetch-ea todo en paralelo (Promise.all) y compone las 4 tabs con datos reales"
  - "notFound() solo para id inexistente; status='dado_de_baja' renderiza banner rojo explícito, nunca 404"
  - "Link 'Ver ficha completa' en cada card de la lista, coexistiendo con el link externo al aviso original"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Página de detalle Server Component: un único await Promise.all([...]) al tope agrega TODAS las fuentes (oportunidad, bandas, comparables, historial, señales) antes de componer las tabs — ninguna tab bloquea a otra ni al resumen IA", "Señales cruzadas opcionales (obtenerSenalesExpansionPorComuna, obtenerTendenciasConstruccionPorComuna) se envuelven en .catch(() => new Map()) para que un fallo en una fuente secundaria nunca tumbe la ficha completa"]

key-files:
  created:
    - "app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx"
  modified:
    - "app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx"

key-decisions:
  - "Orden de tabs Posicionamiento → Resumen → Historial → Comparables (el dato duro antes que la narrativa IA, per CONTEXT.md) — la lista de nombres de tabs en CONTEXT.md no es un mandato de orden, la sección explícita de orden de secciones sí lo es"
  - "notFound() reservado exclusivamente para id inexistente; 'dado_de_baja' es un estado de negocio válido con su propio banner, jamás un 404"

patterns-established:
  - "Cierre de fase 13: las 4 tabs aisladas (13-04/13-05/13-06) se integran en una sola página real sin que ninguna requiera cambios — confirma que el contrato de props definido en cada plan anterior era correcto de punta a punta"

# Metrics
duration: ~9min
completed: 2026-08-02
---

# Phase 13 Plan 07: Integración Final de la Ficha de Detalle Summary

**Server Component `/mercado-inmobiliario/oportunidades/[id]` que fetch-ea oportunidad + bandas + comparables + historial + señales en un único Promise.all y compone las 4 tabs reales, más el wiring "Ver ficha completa" desde la lista — cierra DETA-01 a DETA-07 de punta a punta**

## Performance

- **Duration:** ~9 min (Tasks 1-2) + checkpoint humano aprobado sin correcciones
- **Started:** 2026-08-02T19:55:21Z
- **Completed:** 2026-08-02T19:56:04Z (Tasks 1-2); checkpoint aprobado en sesión posterior
- **Tasks:** 3 (2 auto + 1 checkpoint humano)
- **Files modified:** 2 (1 nuevo, 1 modificado)

## Accomplishments
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` — Server Component `async` (Next 16, `await params`) que resuelve `obtenerOportunidadPorId`, dispara `notFound()` solo si el id no existe, y trae en paralelo bandas de arriendo+venta, comparables, historial y señales cruzadas (expansión de cadenas + tendencia constructiva INE) antes de renderizar. Compone header (precio/comuna/tipo/operación + link externo al aviso original + banner rojo si `dado_de_baja`) y las 4 tabs con datos 100% reales, en el orden Posicionamiento → Resumen → Historial → Comparables.
- `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` — eliminadas las copias locales de `REASON_LABEL` y `formatFechaCorta` en favor de los exports compartidos (`lib/mercado-locales-server.ts`, `lib/formato-fecha.ts`, ya existentes desde 13-02/13-03); agregado el link "Ver ficha completa" en cada card, coexistiendo con el link externo `<a href={o.url}>` sin reemplazarlo.
- Checkpoint humano (Task 3): usuario recorrió los 7 pasos de verificación en vivo (links de la lista, header + 4 tabs, N= explícito y banner/badge de Posicionamiento, streaming bajo demanda de Resumen, Historial, navegación entre Comparables, 404 para id inexistente) y respondió "aprobado" sin hallazgos.

## Task Commits

Each task was committed atomically:

1. **Task 1: [id]/page.tsx — Server Component completo** - `006e428` (feat)
2. **Task 2: Wiring de la lista — link "Ver ficha completa" + imports compartidos** - `0e0b1e3` (feat)
3. **Task 3: Verificación humana end-to-end de la ficha completa** - checkpoint, sin commit propio (aprobado por el usuario: "aprobado")

**Plan metadata:** (este commit)

## Files Created/Modified
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` - Server Component de la ficha de detalle completa (nuevo)
- `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` - imports compartidos (elimina duplicación) + link "Ver ficha completa" por card

## Decisions Made
- Ninguna decisión nueva más allá de las ya bloqueadas en 13-07-PLAN.md — código escrito exactamente como especificado, verificado contra las interfaces reales de `lib/mercado-locales-server.ts`, `lib/cadenas-sucursales-server.ts`, `lib/ine-permisos-server.ts` y `lib/calculadora-inversion.ts` antes de escribir el archivo.

## Deviations from Plan

None - plan executed exactly as written. El código de ambos archivos coincide con los bloques especificados en el plan.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

Fase 13 (Refactor de Scoring + Dashboard de Detalle) completa: 7/7 planes. Verificación final ejecutada tras la aprobación del checkpoint:
- `npx tsc --noEmit` limpio en todo el proyecto.
- `npm run build` completa sin errores (ruta `/mercado-inmobiliario/oportunidades/[id]` listada como dinámica `ƒ`).
- `npx vitest run tests/unit/evaluar-oportunidad.test.ts` — 9/9 tests en verde, sin regresión de scoring.
- Checkpoint humano (Task 3) aprobado en vivo, cubriendo los 7 pasos de verificación end-to-end.

DETA-01 a DETA-07 completos y navegables de punta a punta. Milestone v1.6 (Reportes Profesionales de Oportunidades) queda con la ficha de detalle cerrada; fases 14 (Comparación Lado a Lado) y 15 (Informe Exportable) no iniciadas, sin bloqueos conocidos hacia ellas.

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx
- FOUND: commit 006e428 (feat)
- FOUND: commit 0e0b1e3 (feat)
