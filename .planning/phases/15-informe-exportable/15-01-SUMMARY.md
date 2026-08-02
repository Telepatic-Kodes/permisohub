---
phase: 15-informe-exportable
plan: 01
subsystem: ui
tags: [nextjs, react, print-css, server-components, mercado-inmobiliario]

# Dependency graph
requires:
  - phase: 13-refactor-scoring-dashboard-detalle
    provides: "lib/formato-fecha.ts con formatFechaCorta (date-only), lib/mercado-locales-server.ts con BandasMercadoLocal"
  - phase: 14-comparacion-lado-a-lado
    provides: "patrón de validación server-side de homogeneidad reutilizado conceptualmente por MetodologiaInforme"
provides:
  - "Fix global de layout de impresión: print:hidden en <aside> del sidebar, print:pl-0 en <main> del layout (dashboard)"
  - "formatTimestampCorto(iso) en lib/formato-fecha.ts — formateador timestamptz compartido, hermano de formatFechaCorta"
  - "4 componentes reutilizables en components/mercado-inmobiliario/informe/: PrintButton, PreparadoPorPara, PortadaInforme, MetodologiaInforme"
affects: [15-02-informe-individual, 15-03-informe-comparacion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "print:hidden / print:pl-0 en layout (dashboard) para excluir chrome de navegación de la impresión"
    - "Componentes de informe presentacionales (Server Components) que embeben islands de cliente (PreparadoPorPara) sin forzar 'use client' en el padre"

key-files:
  created:
    - components/mercado-inmobiliario/informe/print-button.tsx
    - components/mercado-inmobiliario/informe/preparado-por-para.tsx
    - components/mercado-inmobiliario/informe/portada-informe.tsx
    - components/mercado-inmobiliario/informe/metodologia-informe.tsx
  modified:
    - "app/(dashboard)/layout.tsx"
    - components/dashboard/sidebar.tsx
    - lib/formato-fecha.ts
    - components/mercado-inmobiliario/oportunidad-detalle/historial-tab.tsx

key-decisions:
  - "PreparadoPorPara sin persistencia (ni localStorage ni backend) — simple sobre prematuro, tradeoff MVP aceptado explícitamente en RESEARCH.md Open Question 3"
  - "Fix de print:hidden/print:pl-0 aplicado globalmente al layout (dashboard), no solo a las 2 rutas nuevas — beneficia retroactivamente a los 2 precedentes existentes (clientes/[id]/informe, cadenas-comerciales/[id]/compliance) que nunca habían sido probados imprimiendo de verdad"
  - "MetodologiaInforme diseñado genéricamente (array de fuentes) desde el inicio para servir tanto al informe individual (15-02, un elemento) como al de comparación (15-03, uno por comuna distinta), evitando duplicación futura"

patterns-established:
  - "formatTimestampCorto vive junto a formatFechaCorta en lib/formato-fecha.ts con doc comment cruzado — evita una tercera reimplementación local de formateo de fecha/timestamp"

# Metrics
duration: ~8min
completed: 2026-08-02
---

# Phase 15 Plan 01: Infraestructura Compartida del Informe Exportable Summary

**Fix de layout de impresión global (sidebar oculto) + formatTimestampCorto compartido + 4 componentes reutilizables (PrintButton, PreparadoPorPara, PortadaInforme, MetodologiaInforme) para los informes de Plan 15-02 y 15-03**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-02T21:11:00Z
- **Completed:** 2026-08-02T21:19:40Z
- **Tasks:** 3 completed
- **Files modified:** 8 (4 modified, 4 created)

## Accomplishments
- Imprimir cualquier página bajo `(dashboard)` ya no muestra la barra lateral de navegación ni su padding reservado
- `formatTimestampCorto` promovido a `lib/formato-fecha.ts`, eliminando la tercera reimplementación local que RESEARCH.md advertía evitar
- 4 componentes de informe listos para consumo directo por Plan 15-02 (informe individual) y Plan 15-03 (informe de comparación), sin duplicación de portada/metodología/botón de impresión/campo preparado por-para

## Task Commits

Each task was committed atomically:

1. **Task 1: Print-safe dashboard layout + promote formatTimestampCorto** - `d3c2813` (feat)
2. **Task 2: PrintButton + PreparadoPorPara client islands** - `b4b8e07` (feat)
3. **Task 3: PortadaInforme + MetodologiaInforme shared components** - `a8a53c9` (feat)

_Note: no TDD tasks in this plan — all 3 are `type="auto"` infra/component tasks._

## Files Created/Modified
- `app/(dashboard)/layout.tsx` - añadido `print:pl-0` estático al `<main>` para anular el padding reservado del sidebar en impresión
- `components/dashboard/sidebar.tsx` - añadido `print:hidden` al `<aside>` para ocultar la navegación en impresión
- `lib/formato-fecha.ts` - nueva función exportada `formatTimestampCorto(iso)`, hermana de `formatFechaCorta`, con doc comment cruzado
- `components/mercado-inmobiliario/oportunidad-detalle/historial-tab.tsx` - eliminada la función local `formatTimestamp`, ahora importa y usa `formatTimestampCorto` de la lib compartida (3 call sites)
- `components/mercado-inmobiliario/informe/print-button.tsx` - `PrintButton`, copia casi verbatim del precedente en `cadenas-comerciales/[id]/compliance`
- `components/mercado-inmobiliario/informe/preparado-por-para.tsx` - `PreparadoPorPara`, 2 inputs controlados sin persistencia, visible en pantalla e impresión (sin `print:hidden`)
- `components/mercado-inmobiliario/informe/portada-informe.tsx` - `PortadaInforme`, título/subtítulo/fecha de generación (via `formatTimestampCorto`), embebe `PreparadoPorPara`
- `components/mercado-inmobiliario/informe/metodologia-informe.tsx` - `MetodologiaInforme`, lista de fuentes con muestra_n, `usoFallback`, UF usado y vigencia de banda (via `formatFechaCorta`, campo date-only)

## Decisions Made
- `PreparadoPorPara` deliberadamente sin persistencia — decisión ya resuelta en RESEARCH.md Open Question 3, ejecutada tal cual
- Fix de impresión aplicado a nivel de layout global (no scoped a las 2 rutas nuevas), ya que el `<aside>`/`<main>` son compartidos por todo el grupo `(dashboard)` — efecto colateral aceptado explícitamente en el plan
- `MetodologiaInforme` recibe un array de `FuenteMetodologia` (no un solo objeto) para servir sin cambios tanto al informe individual como al de comparación

## Deviations from Plan

None - plan executed exactly as written. Los 3 tasks se implementaron siguiendo el código de ejemplo provisto en el plan casi verbatim (bloques `tsx` del PLAN.md), sin necesidad de fixes Rule 1-3 ni decisiones arquitectónicas Rule 4.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 15-02 (informe individual) y Plan 15-03 (informe de comparación) pueden consumir directamente `PrintButton`, `PreparadoPorPara`, `PortadaInforme`, `MetodologiaInforme` sin reimplementar nada
- `formatTimestampCorto` disponible para cualquier campo `timestamptz` que ambos informes necesiten mostrar
- Sin bloqueadores identificados

---
*Phase: 15-informe-exportable*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 8 created/modified files verified present on disk. All 3 task commits (`d3c2813`, `b4b8e07`, `a8a53c9`) verified present in `git log`.
