---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 04
subsystem: ai
tags: [openai, responses-api, sse, streaming, react, client-component]

# Dependency graph
requires:
  - phase: 13-02
    provides: "streamConContexto() en lib/ai.ts + lib/resumen-oportunidad-prompts.ts (buildSystemResumenOportunidad/buildUserQueryResumenOportunidad)"
provides:
  - "POST /api/oportunidades-resumen — ruta SSE flat que genera el resumen ejecutivo IA de una oportunidad, sin búsqueda web"
  - "<ResumenTab contexto={...}> — client component bajo demanda (botón → streaming → InformeEjecutivo), sin auto-disparo"
affects: [13-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rutas SSE de IA de dominio 'ya calculado' (sin búsqueda web) mirroran exactamente el orden de guardas de app/api/tasacion/route.ts (aiAuthGuard -> checkRateLimit -> recordUsage ANTES del stream), solo cambiando la función de streaming (streamConContexto vs streamConBusquedaWeb) y omitiendo secciones que no aplican al dominio (avaluoFiscal/SII)"
    - "Tabs 'bajo demanda' (DETA-06): ausencia total de useEffect de auto-fetch — el estado inicial vacío siempre renderiza un botón explícito, nunca dispara la llamada de IA por sí solo"

key-files:
  created:
    - app/api/oportunidades-resumen/route.ts
    - components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx
  modified: []

key-decisions:
  - "Ruta flat /api/oportunidades-resumen (no /api/oportunidades/[id]/resumen) — id/contexto viajan en el body POST, igual que Tasación, evitando introducir un patrón de SSE anidado bajo [id] que no existe en ningún otro lugar del repo (decisión de 13-RESEARCH.md)"
  - "Sin caching/persistencia entre visitas — cada click en 'Generar'/'Regenerar' recalcula desde cero, mismo criterio de cero-caching que Tasación/Due Diligence"

patterns-established: []

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 13 Plan 04: Resumen Ejecutivo IA de Oportunidad (DETA-06) Summary

**Ruta SSE POST /api/oportunidades-resumen (streamConContexto, sin búsqueda web) + ResumenTab client component con generación bajo demanda vía botón explícito, mismo patrón visual InformeEjecutivo que Tasación/Due Diligence.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-02T15:43:20-04:00 (approx)
- **Completed:** 2026-08-02T15:43:35-04:00
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `app/api/oportunidades-resumen/route.ts` — ruta SSE flat, mismo orden de guardas que `app/api/tasacion/route.ts` (aiAuthGuard → checkRateLimit → recordUsage antes del stream), usa `streamConContexto` exclusivamente (verificado sin rastro de `streamConBusquedaWeb`)
- `components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx` — client component sin `useEffect` de auto-disparo; el estado inicial siempre muestra el botón "Generar resumen ejecutivo", streamea vía `leerEventosSSE`, y renderiza el resultado final con `InformeEjecutivo` (mismas `fuentes` trazables: muestra, comparables, rentabilidad de zona)
- Errores de generación quedan aislados dentro del propio componente (banner rojo + botón "Reintentar"), sin bloquear ni afectar el resto de la ficha

## Task Commits

Each task was committed atomically:

1. **Task 1: Ruta SSE POST /api/oportunidades-resumen** - `8ed59c6` (feat)
2. **Task 2: ResumenTab (client, bajo demanda)** - `0530389` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `app/api/oportunidades-resumen/route.ts` - Ruta POST SSE, guardas en orden (aiAuthGuard → checkRateLimit → recordUsage), body validado (titulo/comuna string), `streamConContexto` sin tools, framing SSE idéntico a Tasación (`data: {text}` / `data: [DONE]` / `data: {error}`)
- `components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx` - Client component `ResumenTab({ contexto })`: botón inicial → fetch POST → `leerEventosSSE` → texto streaming en vivo → `InformeEjecutivo` final con `fuentes` (muestra/comparables/rentabilidad), botón "Regenerar", error con "Reintentar"

## Decisions Made
- Ruta flat (no anidada bajo `[id]`) confirmando la decisión ya tomada en 13-RESEARCH.md — el contexto completo (`ResumenOportunidadContexto`) viaja en el body POST, el Server Component padre (13-07) es quien lo arma con los datos ya fetchados
- Sin caching entre visitas ("Claude's Discretion" habilitado por CONTEXT.md) — cada click regenera desde cero, mismo criterio que Tasación/DD, evitando la complejidad de invalidación de caché para una primera versión

## Deviations from Plan

None - plan executed exactly as written. Both files match the plan's code blocks verbatim.

## Issues Encountered

None. `npx tsc --noEmit` limpio tras ambos tasks. `npx eslint components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx` limpio. Ambos greps de verificación (`streamConBusquedaWeb` en la ruta, `useEffect` en el componente) confirmaron ausencia, como exige el plan.

## User Setup Required

None - no external service configuration required (reutiliza `OPENAI_API_KEY` ya configurada en Vercel desde milestones anteriores).

## Next Phase Readiness
- DETA-06 completo end-to-end salvo el wiring final: 13-07 debe armar el `ResumenOportunidadContexto` real con los datos ya fetchados server-side (desde `obtenerOportunidadPorId` de 13-03 + `evaluarOportunidad` de 13-01) y pasarlo a `<ResumenTab contexto={...}>` dentro de la página de detalle
- Ningún archivo existente fuera de los dos creados fue tocado — sin riesgo de regresión en Tasación/Due Diligence
- No blockers para 13-05/13-06 (independientes) ni para 13-07 (consumidor directo)

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created files and all task commits verified present on disk / in git log.
