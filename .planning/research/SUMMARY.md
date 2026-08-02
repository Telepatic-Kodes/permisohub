# Project Research Summary

**Project:** PermisoHub — milestone v1.6 "Reportes Profesionales de Oportunidades"
**Domain:** Dashboard de detalle por oportunidad de mercado inmobiliario comercial, comparación lado a lado (2-5 oportunidades) e informe exportable estilo consultora (CBRE/JLL/Colliers), sobre datos de scraping ya existentes
**Researched:** 2026-08-02
**Confidence:** HIGH

## Executive Summary

Este milestone no es un producto nuevo — es una extensión de un módulo (Mercado Inmobiliario / Oportunidades) que ya tiene todo el dato subyacente necesario: listings con `id` estable, bandas de mercado por cohorte (P25/mediana/P75 con umbral de muestra mínima), historial de precio por listing, y señales cruzadas honestas (expansión de cadenas, tendencia constructiva). La investigación en las 4 dimensiones (stack, features, arquitectura, pitfalls) converge en una misma conclusión: **no hace falta instalar nada nuevo ni inventar patrones** — el repo ya resolvió, en otros módulos, cada uno de los tres problemas de este milestone (radar/banda de rango con Recharts ya instalado, informe imprimible vía `@media print` + `window.print()`, extracción de lógica de negocio a `lib/*.ts` puro y testeable). La disciplina de "nunca fabricar datos" que ya rige el resto de PermisoHub (auditoría 2026-07-30) se traslada directo a este dominio: cap rate real no existe (solo "rentabilidad implícita de zona", etiquetada como estimado), no hay fotos/pines exactos, y no hay demografía pagada.

El enfoque recomendado es: (1) Server Components de solo-lectura con el patrón ya establecido en 4 de las 9 páginas del módulo (`oportunidades`, `macro`, `cadenas`, `noticias`) — nada de drawers client-side ni conversión a `"use client"` de la página completa; (2) selección de comparación vía querystring (`?ids=uuid1,uuid2`), sin Zustand/Context — cero precedente de estado global en el proyecto y precedente fuerte de estado-en-URL en este mismo módulo; (3) informe exportable como módulo hermano nuevo (`lib/informe-oportunidades-pdf.ts`), no una extensión de `lib/informe-pdf.ts` (ese módulo es Due Diligence con rasterización de planos, dominio distinto, cero reutilización real de lógica).

El riesgo principal no es técnico sino de disciplina de datos: el research de pitfalls identifica 7 formas concretas de que este milestone reintroduzca bugs ya corregidos en otras partes del proyecto — benchmark circular sobre una muestra ya pre-filtrada, mezclar tipo/operación heterogéneos en la misma tabla comparativa, snapshot de informe sin señal de vigencia, romper la disciplina de PDF vectorial con `html2canvas`, coerción de `null` a `0` en rankings, recalcular UF/comparables con una fuente distinta a la que el usuario vio en pantalla, y el bug de timezone (`new Date(iso)` sin `T00:00:00`) que ya ocurrió 5+ veces en este proyecto. Todos son evitables con disciplina de diseño desde la primera fase (Detalle), no con más código — el contrato de datos correcto (incluir `muestra_n`, tipar la homogeneidad de la selección, propagar UF ya calculado) previene la mayoría de ellos estructuralmente.

## Key Findings

### Recommended Stack

Cero instalaciones nuevas. Recharts 3.10.1 (ya en `package.json`, verificado contra `node_modules`) incluye `RadarChart` y soporta bandas de rango vía `Area` con tupla `[min, max]` — cubre tanto el "spider chart" de comparación multi-atributo como la banda P25-P75 del dashboard de detalle. Para el informe exportable, el propio repo ya resolvió "PDF profesional" con un patrón superior a jsPDF pixel-a-pixel: vista HTML + `@media print` + `window.print()` (usado en `clientes/[id]/informe` y `cadenas-comerciales/[id]/compliance`), que imprime los gráficos Recharts como SVG vectorial vivo sin rasterizar. Para la comparación lado a lado, no existe un paquete de industria — se construye con `Table`/`Tabs` de shadcn/ui, ya instalados.

**Core technologies:**
- Recharts 3.10.1 (`RadarChart`, `ComposedChart`/`Area` con banda de rango) — ya instalado, verificado en `node_modules`, cero riesgo de versión
- Vista HTML + `@media print` (React 19.2.4 / Next 16 App Router) — patrón ya validado en producción en 2 informes distintos del proyecto, mejor fidelidad visual que jsPDF+html2canvas
- shadcn/ui `Table` + `Tabs` (ya instalados) — no existe paquete npm estándar para "comparar propiedades lado a lado"; el patrón de industria (CoStar/Crexi/LoopNet) es tabla, no radar
- `jspdf`/`pdfkit`/`html2canvas` (ya instalados, transitivos) — reservados para el caso extendido futuro (PDF descargable real sin usuario presente), no para el caso base de este milestone

### Expected Features

Estructura verificada contra CBRE/JLL/Colliers (Offering Memorandum institucional) y CoStar/LoopNet/Crexi (plataformas de datos): ninguno de estos actores usa radar chart como comparación principal de activos comerciales — el formato universal es tabla (columnas=propiedades, filas=atributos). En Chile, ninguna consultora grande publica fichas de activo individual con datos reales de listings activos — es exactamente el gap que este módulo llena.

**Must have (table stakes) — todo con datos que ya existen:**
- Dashboard de detalle: header (precio, UF/m², comuna, tipo, operación, link al aviso original)
- Posicionamiento vs. cohorte (P25/mediana/P75) — reusar `GaugeArc`/`DesviacionBar`
- Historial de precio del listing + "días publicado" (dato existente, hoy sin usar en UI — quick win)
- Reason codes explicados en detalle + señales cruzadas (SII/INE) también en la ficha
- Comparables sugeridos automáticamente (misma comuna/tipo)
- Comparación: tabla lado a lado (2-4 propiedades), mejor valor resaltado por fila
- Informe exportable: portada, cuerpo, sección de metodología/fuentes (fecha scraping, UF usada, muestra_n, disclaimer "solo publicaciones activas")

**Should have (competitive):**
- Resumen ejecutivo narrativo generado por IA (patrón `InformeEjecutivo` ya existente) — agregar tras validar el MVP
- Rentabilidad implícita de zona ("cap rate" aproximado, etiquetado explícitamente como estimado de zona, nunca del activo)
- Personalización "preparado por/para" en el PDF

**Defer (v2+):**
- Mapa de posicionamiento a nivel comuna — bloqueado por dependencia externa no resuelta (GeoJSON de comunas RM no existe hoy en el proyecto)
- Radar chart complementario — nunca reemplazo de la tabla, solo si hay señal de que la tabla sola no basta
- Demografía pública por comuna (INE/CASEN)
- **Explícitamente rechazado, no solo diferido:** cap rate/NOI real por activo, fotos/pines exactos, rent roll, Walk Score, score único de "mejor oportunidad" (contradice la disciplina de "nunca fabricar interpretación no fundamentada"), boilerplate legal de OM institucional EE.UU.

### Architecture Approach

Server Components de solo-lectura sobre datos ya existentes, sin nueva escritura a Supabase ni migración de schema. La premisa del brief original ("oportunidades no son entidades persistentes con id estable") es incorrecta — `mercado_locales_listings.id` es un `uuid PRIMARY KEY` real, ya devuelto sin transformar por `obtenerOportunidadesMercadoLocales()`. El único prerequisito real es extraer el scoring (`reasonCodes`) que hoy vive inline en el loop de esa función a una función pura `evaluarOportunidad()`, para que lista/detalle/comparación calculen resultados idénticos.

**Major components:**
1. `lib/mercado-locales-server.ts` (modificado) — `evaluarOportunidad()` extraída + `obtenerOportunidadPorId()` + `obtenerOportunidadesPorIds()` (fetch en lote, patrón ya usado en `compararPortafolioConMercado`)
2. `app/.../oportunidades/[id]/page.tsx` (nuevo, Server Component) — ficha de detalle, sigue el mismo folder-convention `[id]` usado en 7 lugares del proyecto
3. `app/.../oportunidades/comparar/page.tsx` (nuevo, Server Component) — lee `?ids=uuid1,uuid2,uuid3` de la URL, sin store global
4. `lib/informe-oportunidades-pdf.ts` (nuevo, módulo hermano de `informe-pdf.ts`) — sin `pdfjs-dist`, mismas convenciones de bajo nivel (dynamic import de jsPDF, `"use client"` caller)
5. `components/mercado-inmobiliario/selector-comparacion.tsx` (nuevo, client island) — checkbox + botón flotante, construye la URL de comparación

**Build order:** refactor de scoring primero (todo lo demás depende de él) → extraer `REASON_LABEL` compartido (paralelo) → `obtenerOportunidadPorId` → página de detalle → selector de comparación (paralelo) → `obtenerOportunidadesPorIds` → página de comparación → informe PDF (último, porque su forma de datos depende de qué terminen mostrando detalle/comparación).

### Critical Pitfalls

1. **Benchmark circular** — calcular "vs. mercado" sobre la propia lista de oportunidades (ya pre-filtrada a "barato") o sin aplicar el umbral `MIN_COHORT_SIZE=15` es estadísticamente vacío. Evitar: leer siempre `mercado_locales_stats_diarias` con `muestra_n`, declarar el universo de comparación (comuna vs. citywide) explícitamente.
2. **Mezclar tipo/operación en la comparación** — nada en el tipo actual impide comparar arriendo vs. venta o local vs. oficina en la misma tabla, produciendo columnas sin sentido económico. Evitar: tipar el estado de selección como `{operacion, tipoPropiedad, ids}`, deshabilitar (no solo advertir) selección heterogénea.
3. **Informe como snapshot invisible** — mismo patrón A8 ya corregido en zonificación; un PDF compartido semanas después sin fecha de última verificación por fila induce decisiones sobre datos obsoletos. Evitar: timestamp de generación Y de última verificación por fila, visibles en el cuerpo del documento.
4. **Romper la disciplina de PDF vectorial con `html2canvas`** — el proyecto tiene 2 generadores de PDF en producción, ninguno rasteriza gráficos; snapshotear Recharts reintroduce problemas de resolución y corte de página ya evitados. Evitar: redibujar con primitivas vectoriales (reusar `binarValores()` de `histograma.tsx`), nunca `html2canvas` como default.
5. **`null` coercionado a `0` en rankings** — `precioUfM2Normalizado` puede ser `null` (superficie faltante); un `?? 0` pone la propiedad sin dato primera en el ranking como si fuera gratis. Evitar: `null` siempre al final o en sección separada, celda explícita "sin dato".
6. **Recalcular UF/comparables en vez de propagar lo ya visto** — refetch de UF en el momento de exportar, o narrativa IA que re-deriva comparables (patrón de Tasación, incorrecto aquí porque sí existen comparables reales). Evitar: propagar UF/valores ya calculados desde el caller; si hay narrativa IA, pasarle `muestra_n`/percentiles reales como contexto.
7. **Bug de timezone reintroducido** — `new Date(iso)` sin `T00:00:00` en campos `date`-only nuevos (ya ocurrió 5+ veces en el proyecto). Evitar: extraer `formatFechaCorta` a un helper compartido antes del primer componente nuevo.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Refactor de scoring + Dashboard de detalle
**Rationale:** Todo lo demás (comparación, informe) depende de tener `evaluarOportunidad()` extraída como fuente única de verdad, y de tener el contrato de datos correcto (`muestra_n`, universo de comparación, fecha de última verificación) desde el inicio — parchear esto después en Comparación/Informe es más caro que sentarlo bien aquí.
**Delivers:** `evaluarOportunidad()` pura y testeada, `obtenerOportunidadPorId()`, ruta `/oportunidades/[id]` con header, posicionamiento vs. cohorte (con `muestra_n` declarado), historial de precio, días publicado, señales cruzadas, comparables sugeridos.
**Addresses:** Todos los table stakes de FEATURES.md que aplican a una sola oportunidad.
**Avoids:** Pitfall 1 (benchmark circular), sienta el precedente para Pitfall 7 (helper de fecha compartido) y Pitfall 6 (contrato de propagación de UF).

### Phase 2: Comparación lado a lado
**Rationale:** Reutiliza exactamente los mismos widgets/datos resueltos en la Fase 1 por listing — construirla antes duplicaría esa lógica. El pitfall de mezclar tipo/operación es específico de esta fase y debe prevenirse en el diseño del estado, no descubrirse después.
**Delivers:** `SelectorComparacion` (client island, querystring `?ids=`), `obtenerOportunidadesPorIds()` (fetch en lote), ruta `/oportunidades/comparar`, tabla con mejor valor resaltado por fila, tope de 2-5 ítems.
**Uses:** shadcn/ui `Table`/`Tabs`, patrón de estado-en-URL ya establecido en el módulo.
**Implements:** Estado de selección tipado `{operacion, tipoPropiedad, ids}` para prevenir estructuralmente la Pitfall 2.

### Phase 3: Informe exportable
**Rationale:** No es una feature de datos nueva — es una vista de impresión de lo que Detalle y Comparación ya muestran en pantalla. Construirla al final evita rehacer el módulo PDF si cambia la forma de los datos en fases anteriores.
**Delivers:** `lib/informe-oportunidades-pdf.ts` (o vista `@media print` según decisión final de stack), portada + cuerpo + sección de metodología/fuentes, fecha de generación y de última verificación por fila, botón de exportar en detalle y comparación.
**Addresses:** Sección de metodología, layout de impresión, personalización "preparado por/para" (opcional).
**Avoids:** Pitfall 3 (snapshot invisible), Pitfall 4 (romper disciplina vectorial con html2canvas).

### Phase Ordering Rationale

- El orden Detalle → Comparación → Informe sigue exactamente la cadena de dependencias documentada en ARCHITECTURE.md (Feature Dependencies): Comparación requiere Detalle, Informe requiere ambas.
- Extraer `evaluarOportunidad()` y el helper de fecha compartido en la Fase 1 (aunque parezca trabajo extra temprano) es lo que evita que Comparación e Informe reintroduzcan bugs ya corregidos en el resto del proyecto (timezone, benchmark circular) — es más barato sentar el contrato correcto una vez que corregirlo en 3 lugares después.
- La decisión de arquitectura del informe (vectorial vs. `html2canvas`, o vista `@media print` vs. jsPDF) debe tomarse explícitamente al inicio de la Fase 3, no ajustarse después de ver que se ve mal impreso — STACK.md y PITFALLS.md coinciden en que la vista `@media print` es la opción de menor riesgo para el caso base.

### Research Flags

Phases likely needing deeper research during planning:
- **Ninguna con research adicional obligatorio** — las 4 dimensiones de research ya verificaron el código real del proyecto (no solo training data) para las 3 fases propuestas.
- Nota de decisión pendiente (no bloqueante): confirmar en planning si el informe exportable usa el patrón `@media print` (recomendado, cero dependencias nuevas) o si se justifica activar `jspdf`+`html2canvas` para generar un `.pdf` real sin usuario presente (caso extendido, no requerido por el MVP).

Phases with standard patterns (skip research-phase):
- **Fase 1 (Detalle):** Patrón Server Component + client chart islands ya usado en 4/9 páginas del módulo — sin patrones nuevos que investigar.
- **Fase 2 (Comparación):** Estado-en-URL ya tiene 2 precedentes directos en este mismo módulo (`oportunidades/page.tsx`, `reportes/page.tsx`).
- **Fase 3 (Informe):** Patrón `print-button.tsx` + `@media print` ya en producción en 2 informes distintos del proyecto.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verificado directamente contra `node_modules` real y `package.json`/`package-lock.json`, no solo training data; ninguna instalación nueva requerida |
| Features | MEDIUM-HIGH | Estructura de reportes de consultoras (CBRE/JLL/Colliers) corroborada por 3+ fuentes independientes que coinciden (no se pudo leer el texto interno de un OM real en PDF binario); el mapeo a "qué es posible con datos reales" está verificado directo contra código/schema del proyecto |
| Architecture | HIGH | Las 3 decisiones de integración clave verificadas contra el schema real, la función de query real y el módulo de PDF real — no asumidas desde el brief del milestone |
| Pitfalls | MEDIUM-HIGH | Los pitfalls de integración con el sistema real (muestra chica, tipos heterogéneos, snapshot vs. vivo, timezone) verificados directo contra código y auditoría propia del proyecto (HIGH); los pitfalls genéricos de export Recharts→PDF verificados con fuentes externas de comunidad (MEDIUM, patrón ampliamente documentado pero no específico de esta stack exacta) |

**Overall confidence:** HIGH

### Gaps to Address

- **Mapa de posicionamiento a nivel comuna (v2+):** requiere confirmar disponibilidad de un GeoJSON público usable de comunas RM — dependencia externa no resuelta, verificar antes de comprometer esta feature a cualquier fase futura.
- **Rentabilidad implícita de zona ("cap rate" aproximado):** solo disponible cuando existan bandas de ambas operaciones (arriendo y venta) para la misma comuna×tipo — validar cobertura real de datos antes de prometer esta feature en un timeline específico.
- **Decisión de arquitectura del informe (vista `@media print` vs. jsPDF+html2canvas):** research recomienda la primera, pero es una decisión de producto (¿se necesita un `.pdf` real sin usuario presente, ej. adjunto de email automático?) que debe confirmarse con la founder antes de la Fase 3.

## Sources

### Primary (HIGH confidence)
- Código y schema del proyecto (fuente primaria directa): `lib/mercado-locales-server.ts`, `lib/scrapers/mercado-locales-common.ts`, `lib/scrapers/portalinmobiliario.ts`, `lib/informe-pdf.ts`, `lib/informe-charts.ts`, `lib/propiedades-portafolio-server.ts`, `lib/tasacion-prompts.ts`, `supabase/migrations/20260802_mercado_locales_listings.sql` y migraciones relacionadas, `app/(dashboard)/mercado-inmobiliario/*`, `components/mercado-inmobiliario/charts/*`, `app/api/cadenas/[id]/reporte/route.ts`, `app/api/propiedades-portafolio/[id]/route.ts`, `node_modules/recharts`, `node_modules/html2canvas`, `node_modules/jspdf`, `package.json`/`package-lock.json`
- `.planning/AUDIT-FIDELIDAD-DATOS-2026-07-30.md` — precedente directo de los pitfalls 1, 3 y 6 (hallazgos A8/A9/A6/C4)
- `.planning/data-sources.yaml` — SLAs de frescura por fuente

### Secondary (MEDIUM confidence)
- CBRE, InvestNext, FNRP, SharpLaunch, BTS Brands — estructura de Offering Memorandum institucional (múltiples fuentes coincidentes)
- CoStar, LoopNet, Crexi, Reonomy, Altus Group, Houzez — patrones de ficha de propiedad y comparación tabular en plataformas de datos CRE
- CBRE Chile, Colliers Chile, bmi.cl, Coldwell Banker Chile — lenguaje y benchmarks de cap rate en el mercado chileno
- shadcn.io (Radar Multiple), Recharts Area API docs — patrones de implementación de gráficos
- GitHub issues html2canvas #3009/#1757, recharts #464 — problemas conocidos de exportar gráficos Recharts vía rasterización

### Tertiary (LOW confidence)
- Ninguna fuente marcada como LOW — la búsqueda de un paquete npm de "comparación de propiedades" no arrojó resultados, reportado honestamente como ausencia de evidencia en STACK.md, no como certeza.

---
*Research completed: 2026-08-02*
*Ready for roadmap: yes*
