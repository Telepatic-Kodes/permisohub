---
phase: 14-comparacion-lado-a-lado
plan: 02
subsystem: ui
tags: [react, nextjs, client-component, next-navigation, base-ui-checkbox]

# Dependency graph
requires: []
provides:
  - "SelectorComparacion: client island con checkbox por oportunidad, tope de 5 seleccionadas y botón flotante 'Comparar (N)'"
  - "Navegación client-side hacia /mercado-inmobiliario/oportunidades/comparar?ids=id1,id2,... (COMPA-04, selección en la URL)"
  - "oportunidades/page.tsx delega el render de la lista de cards a SelectorComparacion, manteniendo el fetch server-side intacto"
affects: [14-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conversión Map -> Record vía Object.fromEntries() en el Server Component antes de pasar como prop a un client island (RSC no serializa Map de forma confiable)"
    - "Tope de selección con guarda tanto en el estado (toggle) como en el prop disabled del control, para que la UI y la lógica coincidan"

key-files:
  created: [components/mercado-inmobiliario/selector-comparacion.tsx]
  modified: ["app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx"]

key-decisions:
  - "Se usaron los tipos exportados SenalExpansionComuna y TendenciaConstruccionComuna directamente (import type) en vez de redefinir shapes ad-hoc en las props del componente — más preciso que lo sugerido literalmente en el plan y evita desincronización si esos tipos cambian"
  - "El botón 'Comparar (N)' solo se renderiza con 2+ seleccionadas (no se muestra deshabilitado con 0-1) para minimizar ruido visual, tal como pedía el plan"

patterns-established:
  - "Client island que recibe datos ya fetched del Server Component vía props (sin fetch propio), usado para agregar interactividad de selección sin duplicar la carga de datos"

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 14 Plan 02: Selector de Comparación Summary

**Client island `SelectorComparacion` con checkbox por oportunidad, tope de 5 seleccionadas, y navegación hacia `/oportunidades/comparar?ids=...` vía `router.push`**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-08-02
- **Tasks:** 2/2 completados
- **Files modified:** 2 (1 creado, 1 modificado)

## Accomplishments
- `components/mercado-inmobiliario/selector-comparacion.tsx` nuevo: migra el JSX de cada card de oportunidad (título con link externo, precio, comuna/superficie/UF-m², badges de reasonCodes, badges de señales de expansión/tendencia constructiva, link "Ver ficha completa") y le agrega un `<Checkbox>` por ítem con tope de 5 seleccionadas simultáneamente (COMPA-01 + capa cliente de COMPA-03).
- Botón flotante `Comparar (N)` visible solo con 2 o más oportunidades marcadas; al hacer click, navega a `/mercado-inmobiliario/oportunidades/comparar?ids=id1,id2,...` (COMPA-04 — la selección vive en la URL, no en estado volátil).
- `oportunidades/page.tsx` reemplaza el `.map()` inline de cards por `<SelectorComparacion>`, convirtiendo `senalesExpansion`/`tendenciasConstruccion` (ambos `Map`) a objetos planos con `Object.fromEntries(...)` justo antes de pasarlos como props — el resto de la página (form de filtros, histograma, estados vacío/error) queda intacto.

## Task Commits

Each task was committed atomically:

1. **Task 1: Crear SelectorComparacion** - `07ef7f7` (feat)
2. **Task 2: Wirear SelectorComparacion en oportunidades/page.tsx** - `ecf1a71` (feat)

_Nota: entre estos dos commits, el plan paralelo 14-01 (wave 1, sin dependencias entre sí) commiteó sus propios cambios en `lib/mercado-locales-server.ts` (`36f2c6d`, `8cc0137`) — no relacionados con este plan, verificados como no conflictivos vía `git status`/`git diff` antes de cada commit de este plan._

## Files Created/Modified
- `components/mercado-inmobiliario/selector-comparacion.tsx` - Client island: checkbox + tope de 5 + botón flotante "Comparar (N)" + router.push hacia /oportunidades/comparar
- `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` - Usa `<SelectorComparacion>` en vez de mapear las cards inline; Server Component sigue haciendo el fetch de datos

## Decisions Made
- Se tipó `senalesExpansion`/`tendenciasConstruccion` con los tipos reales exportados por `lib/cadenas-sucursales-server.ts`/`lib/ine-permisos-server.ts` (`SenalExpansionComuna`, `TendenciaConstruccionComuna`) en vez de las shapes simplificadas sugeridas en el plan — más preciso y evita desincronización futura.
- El botón "Comparar (N)" solo aparece desde 2 seleccionadas (no se renderiza deshabilitado con 0-1), siguiendo la preferencia explícita del plan por menos ruido visual.

## Deviations from Plan

None - plan ejecutado tal como estaba escrito. Los tipos de props fueron ajustados a los tipos reales exportados por las funciones de datos (explícitamente permitido por el plan: "Ajusta los tipos exactos... si el tipo inferido no calza directo").

## Issues Encountered
Ninguno. `npx tsc --noEmit` limpio y `npm run build` compiló sin errores ni warnings, incluyendo la ruta `/mercado-inmobiliario/oportunidades`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- El `router.push` construye la URL con el formato `?ids=uuid1,uuid2` que Plan 14-03 (`/comparar/page.tsx`) espera parsear.
- La ruta `/mercado-inmobiliario/oportunidades/comparar` aún no existe (responsabilidad de Plan 14-03) — el botón navegará a un 404 hasta que ese plan se ejecute; no bloquea la verificación de este plan (verificación es de tipos/build, no end-to-end de navegador, según lo indicado en `<verification>` del plan).
- Sin bloqueadores para Plan 14-03.

---
*Phase: 14-comparacion-lado-a-lado*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: components/mercado-inmobiliario/selector-comparacion.tsx
- FOUND: app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx
- FOUND: .planning/phases/14-comparacion-lado-a-lado/14-02-SUMMARY.md
- FOUND commit: 07ef7f7
- FOUND commit: ecf1a71
