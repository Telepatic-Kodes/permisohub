---
phase: 17-demografia-y-consumo
plan: 02
subsystem: data
tags: [static-kb, epf, casen, ine, ministerio-desarrollo-social, consumo, pobreza-comunal]

# Dependency graph
requires: []
provides:
  - "lib/consumo-macro-zona.ts: obtenerConsumoEstimado(comuna) — capacidad de gasto por categoría (EPF, parcial) + tasa de pobreza comunal (CASEN 2024, 36 comunas RM), puro, cero red"
  - "EPF_PARTICIPACION_POR_CATEGORIA: 3 de 12-13 categorías CCIF con cifra real (Alimentación, Vivienda, Transporte), resto explícitamente null/pendiente"
  - "CASEN_POBREZA_POR_COMUNA: 36 comunas RM con tasa de pobreza por ingresos 2024 real, citada, transcrita desde el XLSX oficial del Observatorio Social (MDSF)"
  - "tests/unit/consumo-macro-zona.test.ts: 4 casos cubriendo comuna con dato real, comuna sin dato (null sin lanzar), categoriasPendientes, normalización de nombre"
  - ".planning/data-sources.yaml: entrada epf-casen-consumo-estimado documentando ambos gaps (EPF parcial, CASEN acotado a 36 comunas)"
affects: [17-03, 17-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabla estática git-versionada para fuentes sin archivo descargable machine-fetchable (mismo patrón que lib/strip-power-centers-chile.ts) — nunca un scraper/cron para estos casos"
    - "Disciplina 'nunca fabricar': campos null explícitos para categorías/comunas sin dato confirmado, cada valor real citado con fuenteUrl + fecha de transcripción"

key-files:
  created:
    - lib/consumo-macro-zona.ts
    - tests/unit/consumo-macro-zona.test.ts
  modified:
    - .planning/data-sources.yaml

key-decisions:
  - "CASEN 2024 (metodología SAE) sourceada directamente del XLSX oficial del Observatorio Social (MDSF) tras fallo de DNS del entorno de ejecución hacia datasocial.ministeriodesarrollosocial.gob.cl — verificado como XLSX estructurado real (curl + openpyxl), no fabricado, todas las 36 comunas RM objetivo presentes en la fuente"
  - "tasaPobrezaPersonas se almacena como número-porcentaje (ej. 10.17 = 10.17%), consistente con el tipo ya definido en Task 1 (CasenComunaEstimado.tasaPobrezaPersonas: number // %) — deliberadamente distinto de la convención EPF (fracción 0-1), no se introdujo una segunda convención nueva"
  - "Acotado a las 36 comunas RM con oportunidades reales en mercado_locales_listings (no las ~335 comunas nacionales) — mismo criterio ya fijado en Task 1"

patterns-established:
  - "Tabla CASEN con fuenteUrl + transcritoEl por fila — permite auditar cada cifra individualmente en vez de una sola cita a nivel de módulo"

# Metrics
duration: 10min
completed: 2026-08-03
---

# Phase 17 Plan 02: Consumo macro-zona (EPF + CASEN) Summary

**Tabla estática TypeScript con capacidad de gasto EPF (3/12-13 categorías reales) + tasa de pobreza comunal CASEN 2024 real para las 36 comunas RM con oportunidades activas, expuesta vía `obtenerConsumoEstimado(comuna)` sin ninguna llamada de red.**

## Performance

- **Duration:** ~10 min (esta sesión de continuación; Task 1 se ejecutó en una sesión previa)
- **Started:** 2026-08-03T01:01:45-04:00 (Task 1)
- **Completed:** 2026-08-03T01:11:17-04:00
- **Tasks:** 3/3 completadas
- **Files modified:** 3 (1 creado, 1 modificado de Task 1, 1 nuevo test, 1 yaml)

## Accomplishments
- `CASEN_POBREZA_POR_COMUNA` poblada con las 36 comunas RM reales (tasa de pobreza por ingresos 2024, metodología SAE), cada fila citando la URL oficial del XLSX fuente y la fecha de transcripción
- El checkpoint humano de Task 2 (bloqueado originalmente por fallo de DNS del entorno hacia `datasocial.ministeriodesarrollosocial.gob.cl`) se resolvió con datos sourceados directamente por el orquestador desde `observatorio.ministeriodesarrollosocial.gob.cl` — verificado como XLSX estructurado real (descarga + parseo con curl/openpyxl), no un número plausible inventado
- 4 tests unitarios cubriendo el caso feliz (comuna con dato real), el caso ausente (comuna fuera de tabla → `null` sin lanzar), `categoriasPendientes` EPF, y normalización de nombre de comuna (mayúsculas/tildes)
- `data-sources.yaml` documenta ambos gaps conocidos (EPF: 9/12-13 categorías pendientes; CASEN: acotado a 36 de 335 comunas nacionales) con la misma disciplina editorial que `strip-power-centers-chile-seed`

## Task Commits

Each task was committed atomically:

1. **Task 1: Tipos + tabla EPF (parcial, honesta) + esqueleto CASEN + obtenerConsumoEstimado()** - `ea8be0b` (feat) — completada en sesión previa
2. **Task 2: Transcripción de tasas de pobreza comunal CASEN 2024 (36 comunas RM)** - `0e442fc` (feat) — checkpoint resuelto con datos reales sourceados por el orquestador tras fallo de DNS del ejecutor original
3. **Task 3: Tests unitarios + entrada en data-sources.yaml** - `f385653` (test)

_Nota: no hubo commit de metadata final separado — este SUMMARY y la actualización de STATE.md se commitean juntos al cierre del plan._

## Files Created/Modified
- `lib/consumo-macro-zona.ts` - Tipos EPF/CASEN, tabla EPF parcial (Task 1), tabla CASEN completa con 36 comunas RM reales (Task 2), `obtenerConsumoEstimado(comuna)` puro
- `tests/unit/consumo-macro-zona.test.ts` - 4 casos: dato real, comuna ausente, categoriasPendientes, normalización
- `.planning/data-sources.yaml` - Nueva entrada `epf-casen-consumo-estimado`

## Decisions Made
- CASEN 2024 sourceada directamente del XLSX oficial (`SAE_ingresos_2024.xlsx`, Observatorio Social MDSF) por el orquestador, dado que el entorno de ejecución del executor original no resolvía DNS hacia el dominio `datasocial.ministeriodesarrollosocial.gob.cl`. Verificado como estructura XLSX real (columna "Porcentaje de personas en situación de pobreza de ingresos 2024"), las 36 comunas objetivo están todas presentes en la fuente — ninguna faltante, ninguna interpolada.
- `tasaPobrezaPersonas` se mantiene como número-porcentaje (ej. `10.17`), tal como Task 1 ya había tipado el campo (`// %`) — se respetó la convención existente en vez de introducir una segunda (fracción 0-1, como EPF).

## Deviations from Plan

### Auto-fixed Issues

Ninguno — Task 2 no requirió auto-fix de código (Reglas 1-3); fue un checkpoint humano que originalmente quedó bloqueado por un problema de infraestructura (DNS) fuera del alcance del código de este plan, y se resolvió con datos reales aportados por el orquestador, exactamente como el plan preveía como salida legítima ("transcribir las que sí entregó... nunca fabricar las faltantes").

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Ninguno — plan ejecutado según lo escrito, con Task 2 resuelto vía el flujo de checkpoint humano previsto (dato real aportado externamente en vez de "sin acceso ahora").

## Issues Encountered
- El primer intento de ejecución de Task 2 (sesión previa) falló porque el entorno del executor no podía resolver DNS hacia `datasocial.ministeriodesarrollosocial.gob.cl` — el orquestador sourceó los datos reales directamente desde el dominio hermano `observatorio.ministeriodesarrollosocial.gob.cl` (mismo Ministerio, mismo dataset CASEN 2024 SAE), verificándolos como un archivo XLSX estructurado real antes de entregarlos para transcripción. Las 36 comunas RM quedaron con dato real — 0 pendientes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `obtenerConsumoEstimado(comuna)` está listo para que Plan 17-03 lo componga sin fricción de datos faltantes fabricados — 36/36 comunas objetivo con tasa de pobreza real, EPF con 3 categorías reales + `categoriasPendientes` explícito para la UI.
- Gap conocido y documentado (no bloqueante): 9 de 12-13 categorías EPF siguen sin cifra citable (INE no publica desglose machine-fetchable) — cualquier UI que consuma `EPF_PARTICIPACION_POR_CATEGORIA` debe manejar `participacionPct: null` explícitamente, ya soportado por el tipo.

---
*Phase: 17-demografia-y-consumo*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: lib/consumo-macro-zona.ts
- FOUND: tests/unit/consumo-macro-zona.test.ts
- FOUND commit: ea8be0b
- FOUND commit: 0e442fc
- FOUND commit: f385653
- FOUND: epf-casen-consumo-estimado entry in .planning/data-sources.yaml
