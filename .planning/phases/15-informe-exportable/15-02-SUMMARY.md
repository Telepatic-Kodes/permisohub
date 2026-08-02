---
phase: 15-informe-exportable
plan: 02
subsystem: ui
tags: [nextjs, react, print-css, server-components, mercado-inmobiliario]

# Dependency graph
requires:
  - phase: 15-informe-exportable
    plan: 01
    provides: "PrintButton, PreparadoPorPara, PortadaInforme, MetodologiaInforme (components/mercado-inmobiliario/informe/) + formatTimestampCorto en lib/formato-fecha.ts + fix global print:hidden/print:pl-0 en el layout (dashboard)"
  - phase: 13-refactor-scoring-dashboard-detalle
    provides: "obtenerOportunidadPorId / obtenerComparablesOportunidad / REASON_LABEL_DETALLE en lib/mercado-locales-server.ts, TIPO_PROPIEDAD_LABEL en lib/scrapers/mercado-locales-common.ts"
provides:
  - "Ruta /oportunidades/[id]/informe — Server Component imprimible con portada, precio con guard precioValido, vigencia por fila (INFO-03), posicionamiento vs. cohorte, señales, comparables y metodología/fuentes (INFO-01)"
  - "Punto de entrada real 'Exportar informe' en la ficha de detalle (oportunidades/[id]/page.tsx), junto a 'Ver aviso original'"
affects: [15-03-informe-comparacion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component de informe re-invoca la capa de datos directamente (obtenerOportunidadPorId/obtenerComparablesOportunidad) en vez de pasar por una API route intermedia — mejora sobre los 2 precedentes @media print existentes del repo"
    - "Vigencia de dato dual: fecha de generación del informe (portada, PortadaInforme) vs. fecha de última verificación del dato individual (cuerpo, línea explícita junto al precio) — nunca una sola fecha genérica"

key-files:
  created:
    - "app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/informe/page.tsx"
  modified:
    - "app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx"

key-decisions:
  - "Sin gráficos Recharts en el cuerpo del informe (decisión ya resuelta en 15-RESEARCH.md Open Question 2) — tablas/texto plano son suficientes para INFO-01 tal como está redactado, evita el riesgo no verificado de ResponsiveContainer bajo @media print"
  - "dynamic = 'force-dynamic' en la nueva ruta, igual que [id]/page.tsx, para garantizar que 'Generado el {fecha}' en la portada sea un timestamp real de render, nunca cacheado"

patterns-established: []

# Metrics
duration: ~7min (Tasks 1-2 automatizados) + checkpoint humano
completed: 2026-08-02
---

# Phase 15 Plan 02: Informe Individual Exportable Summary

**Ruta imprimible `/oportunidades/[id]/informe` (portada + precio con guard + vigencia por fila + posicionamiento + metodología) con punto de entrada real desde la ficha de detalle, verificada en vivo por el usuario**

## Performance

- **Duration:** ~7 min (Tasks 1-2, trabajo automatizado) + tiempo de verificación humana en Task 3
- **Started:** 2026-08-02T21:24:10Z (commit `eab3286`)
- **Completed:** 2026-08-02 (aprobación de checkpoint por el usuario)
- **Tasks:** 3 completed (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Informe individual imprimible con portada (título, comuna/tipo/operación, fecha de generación, campos editables "preparado por/para"), cuerpo (precio con guard `precioValido`, vigencia del dato, posicionamiento vs. cohorte, señales, comparables) y metodología/fuentes — cumple INFO-01
- Vigencia dual visible: fecha de generación en portada vs. "Última verificación de este dato" en el cuerpo, junto al precio — cumple la mitad de INFO-03 correspondiente al informe individual (Pitfall 4)
- Campo "preparado por/para" editable en la portada — cumple la mitad de INFO-04 correspondiente al informe individual
- Link "Exportar informe" real en la ficha de detalle existente, sin el cual la ruta habría quedado inalcanzable desde la UI
- Verificado en vivo por el usuario: navegación completa (lista → ficha → informe), portada, guard de precio, vigencia por fila, metodología, y vista previa de impresión (Cmd+P) sin sidebar ni toolbar — aprobado sin hallazgos

## Task Commits

Each task was committed atomically:

1. **Task 1: Build /oportunidades/[id]/informe/page.tsx** - `eab3286` (feat)
2. **Task 2: Wire entry point from ficha de detalle** - `c7132ff` (feat)
3. **Task 3: Verificación humana (checkpoint)** - aprobado por el usuario, sin commit propio de código (checkpoint de verificación, no de implementación)

**Checkpoint progress commit:** `0385318` (docs: record checkpoint progress, Tasks 1-2 done)

_Note: no TDD tasks in this plan — Tasks 1-2 son `type="auto"`, Task 3 es `type="checkpoint:human-verify"`._

## Files Created/Modified
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/informe/page.tsx` - Server Component nuevo: fetch directo de `obtenerOportunidadPorId`/`obtenerComparablesOportunidad`, portada (`PortadaInforme`), precio con guard `precioValido`, línea de vigencia (`formatTimestampCorto(ultimaVezVistoEl)`), tabla de posicionamiento vs. cohorte (P25/Mediana/P75), señales (`REASON_LABEL_DETALLE`), tabla de comparables, metodología (`MetodologiaInforme`) y `<style>` de impresión A4
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` - agregado link "Exportar informe" (ícono `Printer`) junto a "Ver aviso original", apuntando a `/mercado-inmobiliario/oportunidades/{id}/informe`

## Decisions Made
- Sin gráficos Recharts en el cuerpo (decisión ya resuelta en 15-RESEARCH.md, ejecutada tal cual — ver key-decisions)
- `dynamic = "force-dynamic"` para timestamp de generación siempre real, igual patrón que `[id]/page.tsx`
- Datos fuera de alcance explícitamente excluidos del informe v1: `bandasArriendo`/`bandasVenta` de zona, señales de expansión, tendencias de construcción (potencian el narrative IA de `ResumenTab`/`PosicionamientoTab` en la página viva, no el informe imprimible) — `oportunidad.bandas` es suficiente para la metodología de INFO-01

## Deviations from Plan

None en el trabajo de este plan en sí — Tasks 1-2 se implementaron siguiendo el plan casi verbatim, `npx tsc --noEmit` limpio, greps de verificación (`precioValido`, `formatTimestampCorto`, link de entrada) confirmados.

**Nota de contexto compartido (no es una desviación de este plan, documentada para trazabilidad):** el commit `eab3286` de Task 1 también incluye `comparar/informe/page.tsx`, archivo del Plan 15-03 ejecutado en paralelo en el mismo working directory sin aislamiento por branch/worktree (`branching_strategy: none`). Contenido verificado idéntico byte a byte contra lo commiteado independientemente por 15-03 en `9805c8b`. Sin pérdida de datos, sin impacto funcional — solo atribución cosmética del mensaje de commit. Ver también nota equivalente en `15-03-SUMMARY.md`.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- INFO-01 completo. Las porciones de INFO-03/INFO-04 correspondientes al informe individual, completas y verificadas en vivo.
- Fase 15 queda completa cuando 15-03 (informe de comparación) también cierre su propio checkpoint Task 3 — ver `15-03-SUMMARY.md` / STATE.md para su estado.
- Sin bloqueadores identificados para este plan.

---
*Phase: 15-informe-exportable*
*Completed: 2026-08-02*

## Self-Check: PASSED

Ambos archivos verificados presentes en disco. Ambos commits de tarea (`eab3286`, `c7132ff`) verificados presentes en `git log`. `npx tsc --noEmit` limpio al momento de finalizar el plan. Greps de verificación del plan (`precioValido`, `formatTimestampCorto`, link `oportunidades/${oportunidad.id}/informe`) confirmados con output real arriba.
