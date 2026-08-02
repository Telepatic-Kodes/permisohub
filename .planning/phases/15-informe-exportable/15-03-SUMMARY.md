---
phase: 15-informe-exportable
plan: 03
subsystem: ui
tags: [nextjs, react, print-css, server-components, mercado-inmobiliario, comparacion]

# Dependency graph
requires:
  - phase: 15-informe-exportable
    provides: "PortadaInforme, MetodologiaInforme, PrintButton, formatTimestampCorto (Plan 15-01)"
  - phase: 14-comparacion-lado-a-lado
    provides: "TablaComparacion, obtenerOportunidadesPorIds, patrón de validación de homogeneidad de comparar/page.tsx"
provides:
  - "Ruta /oportunidades/comparar/informe — informe imprimible de una comparación (INFO-02)"
  - "Re-validación independiente de rango 2-5 / existencia / homogeneidad tipoPropiedad-operacion en la nueva ruta (Pitfall 5), sin asumir que comparar/page.tsx ya la hizo"
  - "Franja de fecha de última verificación por oportunidad, variante de comparación de INFO-03/Pitfall 4"
  - "Campo 'preparado por/para' editable en la portada del informe de comparación (INFO-04)"
  - "Link 'Exportar informe' wireado en comparar/page.tsx usando el set de ids ya-fetcheado, no el querystring crudo"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@page { size: A4 landscape; margin: 12mm } + max-w-[297mm] para informes con tabla ancha (hasta 5 columnas), en vez del A4 portrait usado en el informe individual"
    - "Metodología de comparación: una entrada FuenteMetodologia por comuna distinta (no por oportunidad), reusando tipoPropiedad/operacion ya homogéneos"

key-files:
  created:
    - app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/informe/page.tsx
  modified:
    - app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx

key-decisions:
  - "Homogeneidad (tipoPropiedad/operacion) y rango (2-5) re-validados desde cero en la nueva ruta, con el mismo UUID_REGEX duplicado localmente — la ruta es bookmarkable/compartible de forma independiente, no solo alcanzable vía el botón de la app (Pitfall 5)"
  - "TablaComparacion (Fase 14) reutilizada sin modificaciones — la franja de 'verificado {fecha}' por oportunidad se agrega como sección separada debajo de la tabla en vez de tocar el componente compartido"
  - "Link 'Exportar informe' usa oportunidades.map(o => o.id) (el set ya fetcheado/validado en pantalla), no el querystring idsSolicitados crudo — así el informe siempre refleja exactamente lo que el usuario ve, incluso cuando faltantes > 0"

patterns-established: []

# Metrics
duration: ~10min (Tasks 1-2) + tiempo de verificación humana (Task 3)
completed: 2026-08-02
---

# Phase 15 Plan 03: Informe de Comparación Exportable Summary

**Ruta /oportunidades/comparar/informe con re-validación independiente de rango/existencia/homogeneidad, reutilizando TablaComparacion + PortadaInforme + MetodologiaInforme sin reconstruirlas, y wireada desde comparar/page.tsx**

## Performance

- **Duration:** ~10 min (Tasks 1-2) + verificación humana en vivo (Task 3)
- **Started:** 2026-08-02T21:20:00Z (aprox., paralelo a Plan 15-02)
- **Completed:** 2026-08-02
- **Tasks:** 3 completed (2 auto + 1 checkpoint human-verify aprobado)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Informe de comparación imprimible en `/oportunidades/comparar/informe`, con portada, tabla comparativa reutilizada 1:1 de Fase 14, franja de verificación por oportunidad y metodología por comuna
- Defensa de Pitfall 5 verificada en vivo: URL armada a mano con un solo id válido muestra "Selección inválida" en vez de crashear o renderizar una comparación de 1 columna
- INFO-02 cerrado; junto con Plan 15-02 (INFO-01), completan INFO-01 a INFO-04 de la Fase 15

## Task Commits

Each task was committed atomically:

1. **Task 1: Build /oportunidades/comparar/informe/page.tsx** - `eab3286`* (feat)
2. **Task 2: Wire entry point from comparar/page.tsx** - `9805c8b` (feat)
3. **Task 3: Verificación humana del informe de comparación** - checkpoint aprobado por el usuario ("aprobado"), sin commit propio (gate de verificación, no cambio de código)

_Note: no TDD tasks in this plan — Tasks 1-2 son `type="auto"`, Task 3 es `type="checkpoint:human-verify"`._

*`eab3286` está commiteado con el mensaje `feat(15-02): add /oportunidades/[id]/informe printable report page`, atribuido a la ejecución concurrente de Plan 15-02. Ambos planes se ejecutaron en paralelo en el mismo working directory (sin worktree/branch aislado — `branching_strategy: none`), y un `git add` de esa ejecución concurrente incluyó también el archivo nuevo de este plan (`comparar/informe/page.tsx`). Contenido verificado byte-idéntico contra lo especificado por este plan (greps de verificación pasan, `npx tsc --noEmit` limpio). Sin pérdida de datos — únicamente atribución cosmética del mensaje de commit. Ver detalle en STATE.md "Current Position".

## Files Created/Modified
- `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/informe/page.tsx` - Server Component nuevo: re-implementa UUID_REGEX + rango 2-5 + existencia + homogeneidad tipoPropiedad/operacion de forma independiente (Pitfall 5); calcula rentabilidadPorComuna (1 fetch por comuna distinta, no por oportunidad) igual que `comparar/page.tsx`; construye `FuenteMetodologia[]` con una entrada por comuna distinta; renderiza `PortadaInforme` + `TablaComparacion` (reutilizada sin cambios) + franja de "verificado {fecha}" por oportunidad + `MetodologiaInforme`; CSS de impresión `@page { size: A4 landscape; margin: 12mm }` con `max-w-[297mm]`
- `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx` - Link "Exportar informe" (ícono `Printer` de lucide-react) hacia `/comparar/informe?ids=...`, usando `oportunidades.map(o => o.id)` ya-fetcheado en vez del querystring crudo, colocado tras el aviso ámbar de faltantes y antes de `TablaComparacion`

## Decisions Made
- Homogeneidad y rango re-validados desde cero en la nueva ruta (no se asume que `comparar/page.tsx` ya validó) — decisión explícita del plan (Pitfall 5), ejecutada tal cual
- Franja de verificación por oportunidad implementada como sección separada debajo de `TablaComparacion`, sin tocar el componente compartido de Fase 14
- Metodología con una entrada por comuna distinta (no por oportunidad), evitando fetches redundantes cuando varias oportunidades comparadas comparten comuna

## Deviations from Plan

### Auto-fixed Issues

Ninguna deviation de código bajo Rules 1-3. La única anomalía es la atribución de commit descrita arriba (`eab3286`), que es un artefacto de la ejecución paralela sin worktree aislado, no una desviación de contenido — el archivo entregado coincide exactamente con lo especificado por el plan.

---

**Total deviations:** 0 auto-fixed. 1 anomalía cosmética de atribución de commit (sin impacto en contenido ni funcionalidad).
**Impact on plan:** Ninguno — plan ejecutado tal como fue escrito.

## Issues Encountered
Ninguno. La ejecución paralela de Plan 15-02 y 15-03 en el mismo working directory (sin branch/worktree aislado) causó que un `git add` de la ejecución concurrente capturara el archivo `comparar/informe/page.tsx` de este plan dentro del commit `eab3286` de 15-02. No afectó la integridad del código ni requirió re-trabajo — solo se documenta para claridad del historial.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fase 15 (Informe Exportable) completa: INFO-01 a INFO-04 cubiertos entre Plan 15-02 (informe individual) y Plan 15-03 (informe de comparación), ambos con checkpoint humano aprobado en vivo
- Sin bloqueadores identificados
- Milestone v1.6 "Reportes Profesionales de Oportunidades" — verificar si quedan fases pendientes en ROADMAP.md o si el milestone está completo

---
*Phase: 15-informe-exportable*
*Completed: 2026-08-02*

## Self-Check: PASSED

Both created/modified files verified present on disk: `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/informe/page.tsx` and `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx`. Both task commits (`eab3286`, `9805c8b`) verified present in `git log`. Task 3 checkpoint approved live by the user ("aprobado", 9 steps including Pitfall 5 hand-built URL defense). Verification greps re-confirmed: homogeneity re-validated independently, `TablaComparacion` imported and rendered (not reimplemented), entry-point link wired with already-fetched ids. `npx tsc --noEmit` clean.
