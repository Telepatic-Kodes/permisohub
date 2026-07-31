# Auditoría de Fidelidad de Datos — PermisoHub

**Fecha:** 2026-07-30 (post-milestone v1.4)
**Método:** 4 auditores paralelos — (1) corpus normativo verificado contra fuentes oficiales vía web, (2) pipeline de zonificación verificado en vivo con curl contra ArcGIS/Nominatim reales + metadata de procedencia, (3) datos municipales y calculadoras contra Art. 130 LGUC / Ley 19.880 / feriados 2026 / UF real, (4) capa técnica de confianza (fallos silenciosos, validación IA, observabilidad).
**Pregunta central:** cuando la app le dice algo a un arquitecto — un artículo, un monto, un plazo, una zona — ¿es verdad, es actual, y está trazado a la fuente?

**Veredicto global:** La arquitectura de confianza es inusualmente disciplinada (flag "por verificar" en citas, disclaimer CIP, estados explícitos de 3 valores, datos sintéticos declarados en páginas de municipios). Pero la auditoría encontró **8 hallazgos críticos** donde la app entrega hoy información incorrecta, obsoleta o no trazable presentada como hecho. Ninguno es difícil de arreglar; varios son cambios de horas.

---

## CRÍTICOS — información incorrecta entregada hoy como hecho

### C1. Calculadora de derechos municipales: porcentajes incorrectos vs. Art. 130 LGUC
**Confirmado independientemente por 2 auditores.** `lib/derechos-municipales.ts` aplica 1.5% plano a todo `TipoObra`. El Art. 130 LGUC real diferencia:

| Tipo | Ley (Art. 130) | App | Error |
|---|---|---|---|
| Obra nueva / ampliación | 1.5% | 1.5% | ✓ |
| Alteración / reparación / obra menor | **1.0%** | 1.5% | +50% |
| Reconstrucción | **1.0%** | 1.5% | +50% |
| Modificación de proyecto | 0.75% | no existe | — |
| Demolición | **0.5% del presupuesto** | $2.000/m² inventado | sin base legal |

Además faltan dos reducciones legales: **revisor independiente −30%** (Art. 116 bis — la app ya modela revisor independiente para plazos pero no para derechos) y **unidades repetidas 10-50%** (Art. 131).
**Fix:** tabla de porcentajes por tipo + parámetro `tieneRevisorIndependiente` + tipo "modificación de proyecto".

### C2. Descuento DFL2 del 50% probablemente sin base legal para derechos
La app aplica un corte duro del 50% a los derechos para viviendas DFL2. La evidencia encontrada indica que el beneficio DFL2 del 50% aplica a **inscripción CBR y contribuciones**, no al derecho municipal del Art. 130. No se encontró fuente que confirme lo que la app hace.
**Fix:** degradar a nota consultiva ("puede aplicar beneficio DFL2, confirmar con la DOM") hasta confirmación legal — no aplicar el descuento al monto calculado.

### C3. Art. 5.1.2 OGUC mal etiquetado en la base de conocimiento
`lib/oguc-knowledge.ts` muestra bajo "5.1.2" un texto sobre requisitos generales de solicitud de permiso. El Art. 5.1.2 real define **obra menor** — exactamente el artículo que `via-tramitacion.ts` cita como base legal de la vía "obra menor". El motor cita bien; el texto que el arquitecto lee al hacer click es de otro artículo.
**Fix:** reescribir la entrada 5.1.2 con el contenido real de obra menor; renumerar el texto de requisitos generales al artículo correcto (confirmar contra OGUC primaria).

### C4. Datos de zonificación estructuralmente obsoletos, sin ninguna señal al usuario
Verificado en vivo contra los servicios reales:
- Las 3 capas OCUC (Las Condes/Providencia/Vitacura): `dataLastEditDate` real = **2020-03-09**. La "fecha de referencia 2026-04-30" del servicio es un republish técnico, no actualización de contenido. Las Condes tuvo Modificación N°10 (D.O. nov-2022) y N°11 (2021-2024) — posteriores al contenido.
- Ñuñoa (capa agregada PrcCuencaMaipo): el propio publicador declara contenido **"actualizado hasta diciembre 2014"**. Ñuñoa tuvo Modificación N°18 y Enmienda N°1 (vigente dic-2024). **La app puede mostrar una zona derogada hace una década.**
- La columna `fuente_actualizada_el` fue diseñada exactamente para esto y **nunca se pobló** (hardcodeada a `null` en el lookup route con comentario "later pass if needed").
**Fix:** poblar `fuente_actualizada_el` desde `editingInfo.dataLastEditDate` (no `lastEditDate`) y mostrarla prominente en la ZonificacionCard, con advertencia fuerte para Ñuñoa. Evaluar si Ñuñoa debería salir de cobertura hasta tener fuente actual.

### C5. Link "Ver decreto de zona" de Las Condes: muerto (HTTP 410) y genérico
El `fuenteUrl` devuelve 410 Gone, y **las 67 zonas de Las Condes citan la misma URL** — no es por-zona pese a que la UI lo presenta como decreto específico de la zona. Rompe directamente el modelo de "verbatim + cita" del pipeline.
**Fix:** eliminar o reemplazar; mientras no haya link real por zona, usar el mismo tratamiento "sin link directo" de las otras comunas.

### C6. El mojibake llega crudo al motor de IA de compatibilidad
Barrido completo en vivo: el mojibake afecta **87-99% de los uperm/uproh** de Providencia y Vitacura (no "un subconjunto de Las Condes" como se creía). `fixMojibakeArcGIS()` revierte correctamente el 100% de los 237 casos muestreados donde se aplica — pero `app/api/proyectos/[id]/compatibilidad/route.ts` pasa el texto **sin reparar** a `verificarCompatibilidadUso()`. La IA clasifica compatibilidad razonando sobre "EdificaciÃ³n... pÃºblico" mientras el humano ve el texto limpio.
**Fix:** una línea — aplicar `fixMojibakeArcGIS` en la ruta de compatibilidad antes del prompt (y en `seccionZonaProyecto` de due-diligence ya está, verificar también los prompts del copiloto que ya lo tienen).

### C7. Copiloto usa avalúo fiscal SII como presupuesto de obra
`app/api/ai/copiloto/route.ts:216`: `presupuesto = avaluo_fiscal_clp ?? superficie * 800.000 ?? 50.000.000`. El avalúo fiscal de una propiedad existente no es el presupuesto de la obra propuesta (Art. 126 LGUC exige tabla de costos unitarios MINVU, actualizada trimestralmente — no existe en el código). El $800.000/m² no tiene fuente ni fecha. El resultado se muestra como "Derechos calculados" sin advertencia.
**Fix:** pedir presupuesto real al usuario o incorporar la tabla MINVU de costos unitarios (con trimestre citado); mientras tanto, etiquetar el monto como "estimación proxy" explícitamente.

### C8. Cero observabilidad de errores — la causa raíz de los fallos silenciosos
No existe Sentry ni equivalente. Todo es `console.error` en logs de Vercel que nadie lee — el mecanismo exacto por el cual el bug SII (42703) corrió 3 semanas en producción sin detección. Y quedan hoy al menos 2 instancias vivas del mismo patrón: el `after()` de SII en `app/api/proyectos/route.ts:150` tiene un catch vacío con comentario "silent failure intentional" (sin siquiera log), y `daily-check` no tiene try/catch de nivel superior — si una query lanza, todo lo que sigue (alertas de plazos, scraper DOM, WhatsApp) no corre ese día, invisiblemente.
**Fix:** Sentry (o equivalente) en crons + after() blocks + `apiError()`. Es el fix de mayor apalancamiento de toda la auditoría: cubre todos los demás fallos silenciosos de una vez.

---

## ALTOS

| # | Hallazgo | Detalle | Fix |
|---|---|---|---|
| A1 | **Procedencia de datos de zonificación sobrestimada + conflicto de licencia** | Las capas son un espejo académico (OCUC/PUC) con disclaimer explícito "verifique vigencia antes de reutilizar", licencia **CC BY-NC 4.0 (no comercial)** — usada dentro de un SaaS pago. Ñuñoa es de una cuenta personal. La UI dice "Fuente: capa oficial {municipio}". | Corregir el texto de fuente; **consultar abogado por la licencia NC** (riesgo no técnico, para Estefanía) |
| A2 | Guard anti-citas-inventadas (`flagUnverifiedCita`) solo cubre 3 de ~13 superficies IA | 6 rutas emiten `articulo` de la IA sin pasar por el flag: compliance-check, pre-revision, extract-observations, predict-observations, copiloto OGUC | Wirear el flag en las 6 rutas |
| A3 | Tabla de feriados muere silenciosamente en 2028 | `FERIADOS_CHILE` cubre 2024-2027; años fuera → array vacío → todos los días cuentan como hábiles, sin error. Plazos legales incorrectos sin aviso | Guard runtime si el año no existe + extender a 2029+ + recordatorio anual |
| A4 | Fallback UF $38.000 vs. UF real jul-2026 ≈ $40.845 (7% bajo) | 4 copias del valor sin constante compartida; el copiloto no propaga `fallback:true` (la calculadora sí lo muestra) | Constante única con fecha + propagar flag al copiloto |
| A5 | `next@16.2.9` → 6 CVEs high (SSRF, DoS, cache confusion) | Fix en 16.2.12, mismo minor | `npm install next@16.2.12` |
| A6 | Stats municipales sintéticas alimentan la IA sin declararlo | Declaradas en páginas de municipios ✓, pero `buildEstimacionPrompt`/`buildObservacionesPrompt` las inyectan como hechos y `TabEstimacion` muestra el plazo sin caveat | Caveat en prompt + disclosure en TabEstimacion + clamp del rango IA (ej. plazoBase × [0.5, 2]) |
| A7 | Rate limiter se apaga silenciosamente sin Upstash | `checkRateLimit` → no-op sin las env vars (ausentes en `.env.local`); las 3 rutas públicas quedan abiertas sin señal | Verificar vars en Vercel prod + warn log cuando cae a no-op |
| A8 | Drift snapshot `zona_*` vs. caché compartida en la misma tarjeta | Otro proyecto con las mismas coordenadas puede reescribir la caché; la card muestra texto del snapshot congelado junto al polígono vivo de la caché; due-diligence/compatibilidad leen el snapshot | Indicador "puede estar desactualizado" cuando `cache.consultado_el > proyecto.zona_consultada_el` |
| A9 | Mismatch de comuna solo va a console.warn | Geocode vs. solicitada, y campo COMUNA de ArcGIS vs. solicitada — el arquitecto nunca lo ve | Superficie visible en la card cuando hay mismatch |
| A10 | Ley 21.718 incompleta | Falta el tramo de 60 días para proyectos grandes (carga ≥1.000 personas); el mecanismo de silencio negativo → reclamo SEREMI no se explica | Agregar tramo + texto explicativo |

## MEDIOS

- **M1** — LGUC Art. 18: el plazo trienal (terminaciones) corre desde la inscripción CBR del comprador, no desde recepción definitiva como dice la entrada (ya lleva tag `[VERIFICAR]`, pero es un error probable confirmado, no solo duda).
- **M2** — Fecha "vigente desde 25.04.2026" repetida en 4 entradas para 2 decretos distintos (D.S. N°2 y N°10) publicados en fechas distintas; posible confusión de año en D.S. N°10 (¿2025 o 2026?). Confirmar contra Diario Oficial.
- **M3** — Código de zona no es clave única: Vitacura `E-Ae4` = 21 polígonos con 3 regímenes de usos distintos; el fallback manual resuelve por código con `resultRecordCount=1` → elección arbitraria. Duplicados similares en Providencia. Desambiguar por sector.
- **M4** — Contradicción en datos fuente: Providencia `UpEC/EC3+AL` lista "Residencial" en permitidos Y prohibidos simultáneamente — pasa verbatim sin flag de anomalía.
- **M5** — Cero validación Zod en ~10 rutas IA (patrón universal: regex + `JSON.parse` + cast `as`). Zod ya es dependencia.
- **M6** — Cadena de prompt injection vía PDFs subidos: extracción IA etapa-1 → prompt de síntesis etapa-2 → consumida por cuadro-sugerido/asesor etapa-3, sin sanitización. El guard de citas no protege el framing narrativo/severidad.
- **M7** — Checklist del copiloto se genera una vez y nunca se regenera cuando llegan datos async (zona, SII).
- **M8** — SII scraping frágil: campos que fallan al parsear devuelven null/0 indistinguible de "la propiedad tiene 0 m²"; sin sanity checks de rango.
- **M9** — `MINIMOS_UF` por comuna sin fuente ni fecha.
- **M10** — Rasante 70°/2.75 en `cuadros-calculo.ts`: consenso profesional fuerte pero sin confirmación contra la tabla primaria del Art. 2.6.3 (alimenta cálculo determinista).
- **M11** — CSP con `unsafe-inline` + `unsafe-eval` en script-src.
- **M12** — Throttle de Nominatim (1 req/s) es variable de módulo — no se sostiene entre instancias serverless concurrentes.

## Lo que SÍ está bien (verificado)

- idNorma 8201 (OGUC) y 13560 (LGUC) correctos; DDU 109/328/484 y DDU-ESP 084-07 reales y bien atribuidas.
- Ley 21.718: 30/15 días hábiles correcto; silencio negativo correctamente caracterizado; prórroga D.S. N°2 (30 meses) es un decreto real y vigente.
- Días hábiles: exclusión de sábado/domingo/feriados correcta per Ley 19.880 Art. 25; feriados 2026 completos y correctos (incluye corrimiento a lunes de Pueblos Indígenas).
- UF desde mindicador.cl con caché 24h — buena arquitectura; la calculadora SÍ muestra "UF referencial" en fallback.
- Los 4 field-maps de ArcGIS siguen válidos; los 4 cross-checks de comuna en direcciones reales pasaron; `fixMojibakeArcGIS` revierte el 100% de los casos donde se aplica.
- `flagUnverifiedCita`/"Sin fundamento verificado" bien diseñado donde está aplicado; `resolverRefNormativa` de due-diligence correcto.
- BYPASS_AUTH estructuralmente imposible en producción (invariante de build de Next.js).
- Sin secretos en el repo; `.gitignore` correcto.
- `zonificacion-server.ts` es el patrón a seguir: estado explícito en toda rama, incluido catch.

## Plan de acción propuesto (orden sugerido)

**Sprint 1 — "para de decir cosas falsas" — ✅ COMPLETADO 2026-07-30 (mismo día de la auditoría):**
1. ✅ C1+C2: tabla Art. 130 real por tipo (1.5/1.0/0.75/0.5%) + revisor independiente −30% + DFL2 degradado a nota consultiva — commits 817f68c, 21543bd, con 18 tests unitarios nuevos (tests/unit/derechos-municipales.test.ts)
2. ✅ C3: entrada 5.1.2 OGUC reescrita como obra menor real (fuentes secundarias, tag [VERIFICAR TEXTO OFICIAL]); texto desplazado eliminado (duplicado en 5.1.6/prórroga, o pertenecía a Art. 118 LGUC) — commit 5b1936f. Bonus: generate-communication ya no instruye a la IA a citar 5.1.2 para plazos (ahora Art. 118 LGUC) — commit babf31d
3. ✅ C5: campo `url` removido del fieldMap de Las Condes — commit b234724. DB limpiada vía Supabase MCP: 3 filas de zonificacion_cache + proyectos con el link 410 → NULL (verificado 0 remanentes)
4. ✅ C6: `fixMojibakeArcGIS` aplicado en compatibilidad/route.ts; verificado que due-diligence y copiloto ya lo tenían — commit 008dccb
5. ✅ A5: next 16.2.9 → 16.2.12 — 9 advisories directas de next → 0; `next build --webpack` compila las 221 rutas — commit 878e582
6. ✅ A4: `lib/uf.ts` con `UF_FALLBACK_CLP = 40800` (fechada y sourced), las 6 copias de 38000 reemplazadas, `ufFallback` propagado al copiloto con caveat visible en TabEstimacion y banner en patentes — commits 68057b2, 354e2d0

Verificación final del sprint: `tsc --noEmit` limpio, `vitest run` 95/95 (7 archivos, incl. 18 tests nuevos de derechos y 14 de via-tramitacion sin cambios), eslint limpio en todos los archivos tocados.

**Sprint 2 — "di lo que no sabes" — ✅ COMPLETADO 2026-07-30:**
7. ✅ C4: `fuente_actualizada_el` se puebla en cada cache-miss desde `editingInfo.dataLastEditDate` (verificado en vivo: 2020-03-09 exacto); backfill de las 6 filas existentes hecho vía SQL; card muestra fecha de actualización de fuente + advertencia amber para datos >3 años + advertencia específica Ñuñoa (contenido 2014, Mod. N°18/Enmienda N°1 2024 NO reflejadas). Ñuñoa se mantiene en cobertura con advertencia (decisión: warning > removal)
8. ✅ A1: texto de fuente ahora dice "Observatorio de Ciudades UC (espejo de datos MINVU) — verificar vigencia" / "Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)" — la palabra "oficial" eliminada. **Pendiente para Estefanía: consulta legal por licencia CC BY-NC 4.0**
9. ✅ A6: prompts del copiloto declaran los datos como "ESTIMADA (datos sintéticos, no medidos)"; clamp servidor del rango IA (plazoBase × [0.4, 2.5]); fallbacks derivados de plazoBase (antes 30/90 mágicos); disclosure visible en TabEstimacion y TabObservaciones — commit 5c08df0
10. ✅ A9: `comunaFuente` extraído del `raw` jsonb de la caché (sin migración), expuesto en ambas rutas, advertencia amber en la card cuando difiere del municipio del proyecto
11. ✅ A3: guard runtime (`feriadosIncompletos` + console.warn una vez por año) con aviso en la PlazoLey21718Card; tabla extendida 2028-2029 con derivación comentada por fecha (solsticios "por confirmar en D.O.") — commit 8e18c21
12. ✅ A10: tramo 60 días hábiles (carga ocupación ≥1.000 personas, confirmado vía DLA Piper; RI reduce a la mitad ambos tramos → 60/30) como param opcional retrocompatible; texto de silencio negativo → reclamo SEREMI MINVU en estado VENCIDO — commit f9f9e5e

Verificación final Sprint 2: `tsc` limpio, **106/106 tests** (8 archivos, +11 tests nuevos de dias-habiles), eslint limpio.

**Hallazgo nuevo del Sprint 2 (follow-up, no corregido):** las fechas de Iglesias Evangélicas 2024-2027 en `FERIADOS_CHILE` lucen sospechosas (27-oct hardcodeado sin aplicar la regla de viernes movible) — verificar contra D.O. de cada año.

**Sprint 3 — "entérate cuando falle" (2-3 días):**
13. C8: Sentry en crons/after/apiError
14. A2: flag de citas en las 6 rutas restantes
15. A7: Upstash en prod + warn
16. M5: Zod en outputs IA (progresivo)

**Backlog:** M1-M12 restantes + verificación primaria pendiente (D.S. 2026, rasante 2.6.3, DDUs no muestreadas, Arts. 4.2.1/4.5.1/5.8.1).

## Límites de esta auditoría (honestidad)

- Art. 130 triangulado desde 2 fuentes secundarias coincidentes (bcn.cl timeout) — confianza alta, no primaria.
- DFL2: evidencia fuerte en contra del descuento, pero sin fuente que lo descarte categóricamente → abogado.
- Sin verificación pixel-a-pixel de un polígono contra plano municipal (la obsolescencia se probó estructuralmente por fechas de modificaciones documentadas, que es concluyente por sí sola).
- Tabla MINVU de costos unitarios: existencia y propósito confirmados, valores actuales no extraíbles (PDFs binarios).
- ~10 DDUs y 3 artículos OGUC del corpus sin muestrear individualmente.

---
*Auditoría ejecutada por 4 agentes paralelos con verificación en vivo (curl a servicios reales, web search a fuentes oficiales). Los hallazgos citan archivo:línea y son reproducibles.*
