---
phase: 16-ubicacion-e-isocrona-motor-desacoplado
plan: 01
subsystem: data
tags: [gated-plan, external-api-blocker, openrouteservice, heigit, isochrones, blocked]

# Dependency graph
requires: []
provides: []
affects: [16-04, 16-05, 17-03, 17-04, 18-07, 19-03, 19-04]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - ".env.local.example (ya committeado en intento previo, commit c50cc6f — sin cambios en este intento)"

key-decisions:
  - "Plan detenido antes de Task 2/3: la API real de ORS (ambos dominios, ambos estilos de header) sigue devolviendo 403 'Access to this API has been disallowed' pese a tener ORS_API_KEY configurada — no se escribió scripts/verify-ors-isochrone.mjs, lib/isocrona-server.ts ni su test, para no fabricar un Zod schema sin haber visto un payload 200 real"
  - "La hipótesis de 'delay de propagación de key recién creada' (registrada en el intento anterior) queda descartada o al menos no resuelta por el mero paso del tiempo — han transcurrido horas desde la creación de la key (00:10) y sigue en 403 a las ~09:xx"

# Metrics
duration: 8min
completed: 2026-08-03
---

# Phase 16 Plan 01: ORS_API_KEY + lib/isocrona-server.ts Summary

**BLOQUEADO — reverificación en vivo confirma que openrouteservice/HeiGIT sigue devolviendo 403 "Access to this API has been disallowed" en ambos dominios (api.openrouteservice.org y api.heigit.org) y con ambos estilos de header (raw y Bearer), pese a tener `ORS_API_KEY` configurada; no se fabricó ningún código (script de diagnóstico, módulo, schema, test) sobre una API que nunca respondió 200.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-03T09:02:00Z (aprox., continuación de un intento previo interrumpido por error de infraestructura)
- **Completed:** 2026-08-03T09:10:00Z
- **Tasks:** Task 1 completo en un intento previo a este (cuenta ORS creada, `ORS_API_KEY` en `.env.local`, placeholder en `.env.local.example` committeado en `c50cc6f`). Task 2 y Task 3 NO ejecutadas — bloqueadas por el resultado de la reverificación en vivo de este intento.
- **Files modified:** 0 en este intento (el único cambio de código de la cadena de intentos, `.env.local.example`, ya estaba committeado antes de que este agente arrancara)

## Estado: Plan BLOQUEADO por 403 persistente de ORS/HeiGIT

Este es el segundo intento de ejecutar 16-01. El intento anterior fue interrumpido por un error de infraestructura (conexión cerrada a mitad de respuesta) justo después de confirmar el mismo 403 y hacer el commit de documentación `c50cc6f` — nunca llegó a escribir su SUMMARY.md. Este intento retoma desde ahí: no repite el edit de `.env.local.example` (ya committeado), reverifica ORS en vivo, y documenta el cierre.

### Task 1 (completada en intento previo a este): cuenta ORS y `ORS_API_KEY`

Según `.planning/STATE.md` (Current Position, entrada previa a este intento): cuenta HeiGIT creada el 2026-08-03 ~00:10, `ORS_API_KEY` seteada en `.env.local`, "Basic Key" activa con cupo 500/500 en Isochrones V2 según el dashboard del proveedor. `.env.local.example` actualizado con el placeholder de la sección ORS (commit `c50cc6f`, ya en el historial de git antes de que este agente comenzara).

### Reverificación en vivo (equivalente a Task 2, sin crear el script del plan)

Se ejecutó una llamada real POST a la API de isócronas con la coordenada de Providencia (`[-70.6144, -33.4263]`, 15 min caminando) contra tres combinaciones, todas con resultado idéntico:

| URL | Header | Status | Body |
|---|---|---|---|
| `api.openrouteservice.org/v2/isochrones/foot-walking` | `Authorization: <raw key>` | 403 | `{"error":"Access to this API has been disallowed"}` |
| `api.heigit.org/openrouteservice/v2/isochrones/foot-walking` | `Authorization: <raw key>` | 403 | `{"error":"Access to this API has been disallowed"}` |
| `api.heigit.org/openrouteservice/v2/isochrones/foot-walking` | `Authorization: Bearer <key>` | 403 | `{"error":"Access to this API has been disallowed"}` |

Resultado idéntico al documentado en el intento anterior (commit `b6deec9`) — mismo mensaje de error exacto, en ambos dominios, con ambos estilos de header. La hipótesis de "delay de propagación" (la key fue creada ~00:10, esta reverificación corrió ~09:xx, horas después) no explica el 403 persistente: si fuera propagación, ya debería haberse resuelto.

**Acción tomada, según el diseño del plan ante un prerequisito no satisfecho (mismo patrón que 17-03/19-03):** DETENER la ejecución acá. NO se creó `scripts/verify-ors-isochrone.mjs` (el plan lo describe como insumo de Task 3, y su único propósito — capturar un payload 200 real — no se puede cumplir mientras la API rechace todas las llamadas). NO se creó `lib/isocrona-server.ts` ni su Zod schema. NO se creó `tests/unit/isocrona-server.test.ts`. Escribir cualquiera de estos ahora repetiría exactamente el anti-patrón que este plan existe para evitar: un Zod schema asumido de memoria/documentación en vez de derivado de un payload real observado (ver objetivo del plan, referencia a `ArcGISQueryResponseSchema`).

### Task 3: NO ejecutada

Condicionada explícitamente en el plan a tener un payload 200 real de Task 2. Como Task 2 no produjo uno, Task 3 no se tocó.

## Task Commits

Ninguno en este intento — no hubo cambios de código que commitear (la reverificación se hizo con un comando inline de diagnóstico, no persistido como archivo). El único artefacto de esta ejecución es este SUMMARY (commiteado junto con la actualización de STATE.md).

## Files Created/Modified

Ninguno en este intento. `.env.local.example` fue modificado y committeado (`c50cc6f`) en el intento anterior a este, antes de que este agente comenzara.

## Decisions Made

- Respetar el gate de "sin payload 200 real, no hay schema" al pie de la letra — ni siquiera crear el script de diagnóstico desechable, porque su único propósito (Task 2) es capturar ese payload, y no hay nada que capturar mientras ORS devuelva 403 en el 100% de los intentos.
- Descartar (o al menos dejar de asumir sin evidencia) la hipótesis de "delay de propagación" registrada en el intento anterior — han pasado varias horas y el error es idéntico byte a byte. Se recomienda al usuario revisar el dashboard de HeiGIT directamente (¿la key sigue "activa"? ¿hay un paso de verificación de email/dominio pendiente? ¿el "Basic Key" realmente incluye el servicio Isochrones o solo Directions?) o contactar soporte de HeiGIT, en vez de reintentar sin cambios.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito ante este resultado: se reverificó ORS en vivo (equivalente funcional de Task 2, sin persistir el script porque no hay payload 200 que justifique escribir el resto de Task 2/3), se confirmó el mismo bloqueo que el intento anterior, y se detuvo la ejecución en el punto exacto que el plan prescribe (Task 2's `<verify>` no se cumple → no continuar a Task 3).

## Issues Encountered

- Intento anterior a este fue interrumpido por un error de infraestructura del agente (conexión API cerrada a mitad de respuesta) justo después de confirmar el 403 y hacer el commit `c50cc6f` — no llegó a escribir SUMMARY.md ni a actualizar STATE.md. Este intento no repite el trabajo ya committeado, solo reverifica y cierra.
- ORS/HeiGIT sigue devolviendo 403 "Access to this API has been disallowed" — mismo bloqueo ya documentado en el intento anterior, ahora confirmado persistente (no resuelto por el paso del tiempo).

## User Setup Required

**Bloqueante — acción externa requerida antes de poder reintentar este plan con éxito.** Revisar directamente en el dashboard de HeiGIT (openrouteservice.org/dev, o el nuevo portal de HeiGIT si migró) por qué una "Basic Key" con cupo 500/500 en Isochrones V2 sigue siendo rechazada con 403 en ambos dominios (`api.openrouteservice.org` legacy y `api.heigit.org` nuevo) y con ambos estilos de header (raw y `Bearer`). Posibles causas a descartar manualmente: verificación de email pendiente en la cuenta, key con scope limitado a otro servicio (Directions en vez de Isochrones), o un paso de activación adicional del lado de HeiGIT no documentado en el flujo de signup estándar. No reintentar `/gsd:execute-phase 16` hasta confirmar un HTTP 200 real (por ejemplo con un `curl` manual) — reintentar sin ese cambio solo va a reproducir el mismo 403.

## Next Phase Readiness

- Este plan (16-01) queda pendiente de re-ejecución. Es el único bloqueante restante para Phase 16 completa (16-04, 16-05) y, transitivamente, para 17-03/17-04, 18-07 y 19-03/19-04 — todos gateados por diseño sobre artefactos que 16-04 debe producir (`lib/cabida-comercial-server.ts`).
- Ningún código fue tocado por este plan hasta ahora, así que no hay riesgo de deuda técnica o mocks a limpiar — cuando ORS responda 200, Task 2 y Task 3 pueden ejecutarse desde cero exactamente como están escritas en `16-01-PLAN.md`.
- Recomendación: no relanzar el ejecutor de este plan hasta tener confirmación manual (fuera de esta sesión) de un 200 real contra la API de ORS/HeiGIT.

## Self-Check: PASSED

- `.env.local.example` con la sección ORS: presente (commit `c50cc6f`, verificado con `git log --oneline -- .env.local.example`).
- `scripts/verify-ors-isochrone.mjs`: MISSING — por diseño, no se creó (ver justificación arriba).
- `lib/isocrona-server.ts`: MISSING — por diseño, no se creó.
- `tests/unit/isocrona-server.test.ts`: MISSING — por diseño, no se creó.
- Reverificación en vivo de ORS: ejecutada en esta sesión, 403 confirmado en 3/3 combinaciones probadas (ver tabla arriba).

---
*Phase: 16-ubicacion-e-isocrona-motor-desacoplado*
*Completed: 2026-08-03*
