---
phase: 14-comparacion-lado-a-lado
plan: 03
subsystem: ui
tags: [nextjs, server-component, supabase, url-state, shadcn-table, mercado-inmobiliario]

# Dependency graph
requires:
  - phase: 14-01
    provides: "obtenerOportunidadesPorIds(ids) — capa de datos en lote en lib/mercado-locales-server.ts"
  - phase: 14-02
    provides: "SelectorComparacion — checkbox + botón 'Comparar (N)' que navega hacia /oportunidades/comparar?ids=..."
provides:
  - "TablaComparacion — componente presentacional puro (Server Component), columnas=oportunidades, filas=atributos, con resaltado de 'mejor valor' SOLO en las 3 filas de dirección inequívoca (Precio UF, Precio UF/m², % vs. mediana cohorte)"
  - "/mercado-inmobiliario/oportunidades/comparar — ruta con validación server-side real de rango (2-5), existencia, y homogeneidad de tipoPropiedad/operacion, ANTES de renderizar la tabla"
  - "Cierre de la fase 14: COMPA-01 a COMPA-04 completos y verificados en vivo"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validación server-side en cascada con return temprano por cada capa (parseo/dedup UUID -> rango 2-5 -> fetch -> existencia -> homogeneidad) — cada fallo renderiza un mensaje explícito y NUNCA llega al render de la tabla"
    - "Defensa real de una regla de negocio (COMPA-03) se implementa en el Server Component que resuelve la URL, no solo en el control de UI que la origina — la URL es input no confiable y debe validarse igual sin importar cómo se llegó a ella"
    - "Cache de rentabilidad implícita de zona por comuna distinta (no por oportunidad) para evitar recalcular el mismo capRate N veces cuando varias oportunidades comparten comuna"

key-files:
  created:
    - components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx
  modified:
    - app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx

key-decisions:
  - "TablaComparacion es un componente nuevo, no reutiliza los tabs de ficha individual de Fase 13 (posicionamiento-tab.tsx, etc.) — esos están diseñados para layout vertical de una sola oportunidad, no para celdas compactas de tabla comparativa"
  - "Resaltado de 'mejor valor' limitado a las 3 filas con dirección inequívoca (menor=mejor): Precio UF, Precio UF/m², % vs. mediana de cohorte. Superficie, Días publicado, Señales y Rentabilidad de zona se muestran sin resaltar, para no fabricar una interpretación de 'mejor' donde es ambiguo (Open Questions 1 y 2 de 14-RESEARCH.md)"
  - "Un precio inválido (precioValido=false o precioUfNormalizado=0, que es el valor interno fabricado por construirOportunidadDetalle) se excluye explícitamente del cálculo de 'menor valor' — un 0 fabricado nunca puede ganar la comparación de más barato"
  - "Oportunidades dado_de_baja se incluyen en la tabla con un badge visual, nunca se excluyen silenciosamente — mismo criterio que la ficha individual de Fase 13"
  - "La validación de homogeneidad (tipoPropiedad + operacion) se ejecuta siempre en el Server Component de /comparar, sin importar si se llegó por el checkbox de Plan 14-02 o por una URL armada a mano — es la defensa real de COMPA-03, el checkbox es solo la capa de UX"

# Metrics
duration: 6min
completed: 2026-08-02
---

# Phase 14 Plan 03: Ruta y Tabla de Comparación Summary

**Ruta `/oportunidades/comparar?ids=...` con validación server-side en cascada (rango 2-5, existencia, homogeneidad de tipo/operación) y `TablaComparacion` con resaltado de mejor valor solo en las 3 filas de dirección inequívoca — cierra la fase 14 (COMPA-01 a COMPA-04).**

## Performance

- **Duration:** ~6 min (Tasks 1-2 automatizados) + checkpoint humano aprobado en la misma sesión
- **Started:** 2026-08-02T20:39:00Z
- **Completed:** 2026-08-02T20:45:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 2 (1 creado, 1 creado como ruta nueva)

## Accomplishments
- `TablaComparacion` (Server Component, sin fetch propio) renderiza columnas=oportunidades, filas=Precio UF / Precio UF/m² / % vs. mediana cohorte / Superficie / Días publicado / Señales / Rentabilidad implícita de zona, con resaltado de mejor valor únicamente en las 3 primeras filas, excluyendo precios inválidos (0 fabricado) del cálculo de "menor", e incluyendo oportunidades `dado_de_baja` con badge visual.
- `/mercado-inmobiliario/oportunidades/comparar/page.tsx` implementa la defensa server-side real de COMPA-03: parsea y deduplica ids, valida formato UUID, valida rango 2-5, hace fetch batched vía `obtenerOportunidadesPorIds`, valida existencia (banner de faltantes), y valida homogeneidad de `tipoPropiedad`/`operacion` ANTES de renderizar la tabla — cualquier fallo en cualquier capa muestra un mensaje explícito con link de vuelta, nunca una tabla parcial ni un crash.
- Rentabilidad implícita de zona calculada en lote por comuna distinta (no por oportunidad), reutilizando el mismo cálculo de capRate que la ficha individual de Fase 13.
- Checkpoint humano end-to-end (Task 3) aprobado en vivo por el usuario tras recorrer los 8 pasos de verificación: selección por checkbox → botón "Comparar (N)" → navegación con ids reales en la URL → tope de 5 deshabilita checkboxes adicionales → tabla con resaltado solo en las 3 filas correctas → recarga F5 idéntica (estado en URL, COMPA-04) → 1 solo id muestra "Selección inválida" → mezcla de tipo/operación vía URL manual muestra "Comparación inválida" (defensa real de COMPA-03 confirmada) → oportunidad `dado_de_baja` incluida con badge.

## Task Commits

Each task was committed atomically:

1. **Task 1: Crear TablaComparacion** - `07a5a06` (feat)
2. **Task 2: Crear /oportunidades/comparar/page.tsx con validación server-side de homogeneidad** - `0d2a10b` (feat)
3. **Task 3: Verificación humana end-to-end (checkpoint:human-verify)** - sin commit propio (gate de aprobación); progreso intermedio registrado en `70e7482` (docs)

**Plan metadata:** (este commit) `docs(14-03): complete ruta y tabla de comparación plan`

## Files Created/Modified
- `components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx` - Tabla comparativa nueva, presentacional, con resaltado de mejor valor limitado a filas de dirección inequívoca
- `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx` - Ruta Server Component con validación server-side en cascada (rango, existencia, homogeneidad) antes de renderizar la tabla

## Decisions Made
Ver `key-decisions` en el frontmatter. La más relevante: la validación de homogeneidad vive en el Server Component de la ruta (no solo en el checkbox de la lista), porque `?ids=` es alcanzable directamente por URL sin pasar por ningún control de UI — es la única forma de que COMPA-03 esté resuelto en sentido fuerte.

## Deviations from Plan

None - plan ejecutado tal como estaba escrito. Verificación automatizada previa al checkpoint (vía curl contra dev server real, con ids reales de la base) confirmó los mismos comportamientos que luego el usuario verificó en vivo en el navegador.

## Issues Encountered
Ninguno. `npx tsc --noEmit` y `npm run build` limpios. El checkpoint humano (Task 3) fue aprobado sin hallazgos — el usuario recorrió los 8 pasos de verificación (incluyendo el caso más importante: mezcla de tipo/operación vía URL manual, sin pasar por checkbox) y confirmó "aprobado" sin desviaciones reportadas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fase 14 (Comparación Lado a Lado) completa: COMPA-01, COMPA-02, COMPA-03 (ambas capas: checkbox de UX en Plan 14-02 + validación server-side real en este plan), y COMPA-04 (estado compartible/recargable en la URL) verificados en vivo.
- Fase 15 (Informe Exportable) puede comenzar sin bloqueadores — no depende de artefactos nuevos de esta fase más allá de `OportunidadDetalle`/`obtenerOportunidadesPorIds` ya provistos por Plan 14-01.

---
*Phase: 14-comparacion-lado-a-lado*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx
- FOUND: app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx
- FOUND: .planning/phases/14-comparacion-lado-a-lado/14-03-SUMMARY.md
- FOUND commit: 07a5a06
- FOUND commit: 0d2a10b
