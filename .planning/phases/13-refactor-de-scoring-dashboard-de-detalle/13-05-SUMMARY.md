---
phase: 13-refactor-de-scoring-dashboard-de-detalle
plan: 05
subsystem: mercado-inmobiliario
tags: [react, ui, presentational-component, cap-rate]

# Dependency graph
requires:
  - phase: 13-03
    provides: "OportunidadDetalle y BandasMercadoLocal (tipos + obtenerOportunidadPorId) — fuente de props de PosicionamientoTab"
provides:
  - "PosicionamientoTab — componente presentacional puro (DETA-02 + DETA-07): banda de precio vs. cohorte con banner amber prominente si falta banda o hay fallback citywide, muestra_n declarada en texto visible, y rentabilidad implícita de zona con badge violet 'Estimado de zona'"
affects: [13-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Banners amber de advertencia reutilizan el markup EXACTO de app/(dashboard)/patentes/page.tsx (border-amber-200/bg-amber-50/⚠ text-amber-500) en vez de inventar un tratamiento nuevo — mismo lenguaje visual en todo el módulo"
    - "Datos derivados (rentabilidad de zona) que dependen de dos fuentes opcionales nunca se ocultan silenciosamente cuando falta una — siempre se renderiza el contenedor con un mensaje explícito que distingue cuál fuente falta"

key-files:
  created:
    - components/mercado-inmobiliario/oportunidad-detalle/posicionamiento-tab.tsx
  modified: []

key-decisions:
  - "El bloque de rentabilidad de zona (DETA-07) se renderiza siempre, incondicional a oportunidad.operacion — es un dato de zona, no del activo específico, y aplica tanto a fichas de arriendo como de venta"
  - "Badge 'Estimado de zona' usa variant violet (border-violet-200/bg-violet-100/text-violet-800), deliberadamente distinto del amber de los banners de advertencia y del pill 'Estimado' blueprint de KpiCard — evita que el usuario confunda un dato agregado de zona con una advertencia o con el placeholder genérico"
  - "calcularCapRate() de lib/calculadora-inversion.ts se reutiliza tal cual (rentaMensual=medianaUfM2 arriendo, precioVenta=medianaUfM2 venta) en vez de reimplementar la fórmula de cap rate — mismos supuestos de vacancia 7%/opex 15% que el resto de la app"

patterns-established:
  - "Componente de tab de detalle 100% presentacional: recibe oportunidad + bandas ya resueltas por props, no hace fetch ni llama a Supabase — permite que 13-07 lo componga en la página sin acoplamiento"

# Metrics
duration: ~1min
completed: 2026-08-02
---

# Phase 13 Plan 05: Tab de Posicionamiento (DETA-02 + DETA-07) Summary

**`PosicionamientoTab` — banda de precio vs. cohorte con banner amber prominente (sin banda / fallback citywide) y muestra_n siempre visible en texto, más rentabilidad implícita de zona vía `calcularCapRate()` con badge violet distintivo y desglose completo de ambas bandas**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-08-02T15:47:00-04:00 (aprox.)
- **Completed:** 2026-08-02T15:49:27-04:00
- **Tasks:** 2
- **Files modified:** 1 (creado)

## Accomplishments
- DETA-02: banner amber prominente (mismo markup que `app/(dashboard)/patentes/page.tsx`) cuando no hay banda alguna o cuando la banda usada es fallback citywide — nunca una nota discreta
- `N=` de la cohorte declarado en texto visible siempre, no solo disponible vía tooltip
- Gauge de precio vs. P75 + barra de desviación vs. mediana + tabla P25/mediana/P75 (UF y UF/m²), todo condicionado a que exista banda
- DETA-07: rentabilidad implícita de zona SIEMPRE visible (independiente de `oportunidad.operacion`), calculada solo cuando ambas bandas (arriendo y venta) tienen `medianaUfM2` real, con badge violet "Estimado de zona" y desglose de ambas bandas (N + fallback de cada una)
- Mensaje explícito y específico (nunca genérico) cuando falta cobertura: distingue "falta arriendo", "falta venta" y "faltan ambas"

## Task Commits

Each task was committed atomically:

1. **Task 1: Banda de posicionamiento + banner de muestra chica** - `2d02c39` (feat)
2. **Task 2: Rentabilidad implícita de zona (DETA-07)** - `a1eb931` (feat)

**Plan metadata:** (este commit)

## Files Created/Modified
- `components/mercado-inmobiliario/oportunidad-detalle/posicionamiento-tab.tsx` - `PosicionamientoTab`, componente presentacional puro con banner de advertencia amber, gauge/desviación de precio vs. cohorte, tabla P25/mediana/P75, y bloque de rentabilidad implícita de zona (badge violet + desglose completo)

## Decisions Made
- Rentabilidad de zona siempre se muestra (no condicionada a `operacion === 'venta'`) — es dato de zona, aplica a fichas de arriendo y de venta por igual, per CONTEXT.md
- Badge violet para "Estimado de zona", distinto del amber de advertencia y del blueprint del pill genérico "Estimado" de `KpiCard`, para que sea visualmente distinguible sin depender de un tooltip
- Reuso directo de `calcularCapRate()` ya testeado en `lib/calculadora-inversion.ts` en vez de reimplementar la fórmula — mismos supuestos genéricos (vacancia 7%, opex 15%) que el resto de la app

## Deviations from Plan

None - plan executed exactly as written. Los tipos exportados por `lib/mercado-locales-server.ts` en 13-03 (`OportunidadDetalle`, `BandasMercadoLocal`) coinciden exactamente con la firma de props asumida por el plan; ningún ajuste fue necesario.

## Issues Encountered
Ninguno relevante a este plan. `git log` muestra dos commits de otro plan (13-06: `HistorialTab` y `ComparablesTab`) intercalados cronológicamente entre los dos commits de este plan — ejecución concurrente de otro agente sobre el mismo repo sin branching (`branching_strategy: none`), mismo patrón ya observado en 13-01-SUMMARY.md y 13-03-SUMMARY.md. No tocan `posicionamiento-tab.tsx`, sin conflicto.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`PosicionamientoTab` queda listo para que 13-07 lo componga en la página final de la ficha de detalle, recibiendo `oportunidad` (de `obtenerOportunidadPorId()`), `bandasArriendo` y `bandasVenta` (de `obtenerBandasMercadoLocales()` para cada operación) sin ningún cambio adicional a este archivo. Sin bloqueos.

---
*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: components/mercado-inmobiliario/oportunidad-detalle/posicionamiento-tab.tsx
- FOUND: .planning/phases/13-refactor-de-scoring-dashboard-de-detalle/13-05-SUMMARY.md
- FOUND: commit 2d02c39 (feat)
- FOUND: commit a1eb931 (feat)
