# Feature Research

**Domain:** Reportes profesionales de oportunidades inmobiliarias comerciales (dashboard de detalle, comparación lado a lado, informe exportable) — módulo Mercado Inmobiliario de PermisoHub
**Researched:** 2026-08-02
**Confidence:** MEDIUM-HIGH (estructura de reportes de consultoras verificada por múltiples fuentes independientes que coinciden entre sí; el mapeo a "qué es posible con nuestros datos reales" está verificado directamente contra el código y schema actuales, no supuesto)

## Contexto verificado del sistema actual

Antes de listar features, esto es lo que el código YA tiene disponible (verificado en `lib/mercado-locales-server.ts`, `lib/scrapers/mercado-locales-common.ts`, `lib/scrapers/portalinmobiliario.ts` y las migraciones `supabase/migrations/20260802_*`, `20260803_*`, `20260805_*`):

**Por cada oportunidad (`OportunidadMercadoLocal`):** id, título, url externa (Portalinmobiliario), comuna, precio (monto+moneda), superficie m², precio UF normalizado, precio UF/m² normalizado, `reasonCodes` (`below_p25_ufm2`, `below_p25_uf`, `price_drop_7d`).

**Por cohorte comuna×operación×tipo_propiedad:** banda P25/mediana/P75 en UF y UF/m², tamaño de muestra (`muestra_n`), con fallback honesto a rollup `__TODAS__` cuando la muestra es chica (`MIN_COHORT_SIZE = 15`). Serie diaria desde el 1 ago 2026 (historia real corta).

**Por listing individual:** historial de precio real (`mercado_locales_historial_precio`, trigger en cada cambio de precio) + `primera_vez_visto_el`/`ultima_vez_visto_el` (permite calcular "días publicado" — dato real, hoy sin usar en UI).

**Señales cruzadas honestas ya calculadas a nivel comuna:** expansión de cadenas retail (SII, `obtenerSenalesExpansionPorComuna`) y tendencia de actividad constructiva histórica (INE, `obtenerTendenciasConstruccionPorComuna`).

**Lo que NO existe y no se debe fingir que existe:** dirección exacta, coordenadas lat/long, fotos, planos, rol SII vinculado automáticamente, datos de arriendo Y venta para el mismo activo físico (cada listing es una publicación de un solo tipo de operación), rent roll/arrendatarios, transacciones efectivas cerradas (ya descartado en sesiones previas — sin fuente pública ni vendor aprobado).

**Ya construido y reutilizable (no partir de cero):** librería de charts "Tema Consultora" (`components/mercado-inmobiliario/charts/`: `KpiCard` con sparkline+delta+badge verificado/estimado, `Histograma`, `GaugeArc`, `DesviacionBar`, `DistribucionDonut`, `RankingBarChart`), componente `InformeEjecutivo` (extrae "## Resumen Ejecutivo" de markdown generado por IA + badges de fuentes disponibles/no disponibles, ya usado en Tasación/Due Diligence/Auditor/Predictor), dos patrones de exportación a PDF ya en producción — (a) `lib/informe-pdf.ts`: jsPDF dibujado a mano, pixel-a-pixel, con rasterización de planos (usado para due diligence con láminas anotadas, complejidad alta, pensado para anotar sobre dibujos) y (b) patrón `print-button.tsx` + CSS `print:hidden`/`@media print` (usado en `cadenas-comerciales/[id]/compliance` y `clientes/[id]/informe`: `window.print()` sobre una vista ya estilizada, complejidad baja). Leaflet ya es dependencia del proyecto (`zonificacion-mapa.tsx`), pero solo para geometría de parcela/ROL conocido — no hay polígonos de comuna ni geocoding de listings.

## Cómo reportan los mejores actores (hallazgos de investigación)

**Consultoras institucionales (CBRE, JLL, Colliers, Cushman & Wakefield) — "Offering Memorandum" / informe de oportunidad individual.** Estructura consistente entre fuentes: portada de marca → resumen ejecutivo / "Investment Highlights" (bullets, no prosa larga) → descripción de la propiedad (fotos, site plan, aérea) → resumen financiero (rent roll, cap rate, NOI, proyección de flujo) → overview de ubicación (mapa, demografía de área de influencia, conteos de tráfico para retail) → overview de mercado/submercado comparable → comparables de venta/arriendo → contacto del corredor + disclaimer legal. (MEDIUM confianza — verificado contra múltiples guías de "cómo se arma un OM" e imagen de un OM real de CBRE; no se pudo extraer texto completo del PDF binario de CBRE, así que la estructura exacta interna se corrobora por 3+ fuentes independientes que coinciden, no por lectura directa de un documento).

**Plataformas de datos (CoStar, LoopNet, Crexi) — ficha de propiedad + comps.** Ficha individual: fotos/video, atributos físicos, historial de venta/arriendo previo, estado (activo/vendido), comparables sugeridos automáticamente con cap rate/precio/tamaño, mapa. Comparación: **tabla** de comparables lado a lado (columnas = propiedades, filas = atributos) es el formato dominante — ni CoStar ni Crexi ni LoopNet usan radar/spider chart para comparar activos comerciales; ese patrón aparece solo en herramientas de consumo residencial con "scoring" ponderado por el comprador (ej. comparadores de casas para familias), no en CRE profesional. Exportan comps a PDF con foto+mapa+tabla (Crexi: "print-friendly PDF" desde comps guardados).

**Chile (CBRE Chile, Colliers Chile):** mismo lenguaje de "rentabilidad"/cap rate se usa localmente (6-8% anual "sólido" para comercial, más alto que residencial), pero los reportes públicos de mercado chilenos son casi siempre agregados por submercado (ej. "0,47 UF/m² arriendo oficina Clase A"), no fichas de activo individual — el activo individual con foto+comps es un producto de corretaje privado (Propital, TocToc), no de las consultoras grandes en Chile. Confirma que el "gap" que PermisoHub llena (ficha honesta de UNA oportunidad de mercado, sin fabricar comps de transacciones cerradas) no tiene competidor directo chileno haciendo lo mismo con datos reales de publicaciones activas.

**Conclusión clave para el cap rate/NOI:** un cap rate real requiere ingreso (arriendo) y valor (venta) del MISMO activo — un listing scrapeado es arriendo O venta, nunca ambos. Cualquier "cap rate" mostrado por oportunidad solo puede ser una **rentabilidad implícita de zona** (mediana UF/m² venta ÷ mediana UF/m² arriendo de la misma comuna×tipo), y debe etiquetarse explícitamente como estimado de zona, no del activo — igual disciplina que ya aplica `AvaluoFiscalCard` ("No es dato de mercado").

## Feature Landscape

### Table Stakes (Users Expect These)

Lo que un reporte serio de oportunidad SIEMPRE tiene, según CBRE/JLL/Colliers/CoStar/LoopNet — sin esto el producto se siente incompleto frente a la comparación que la propia founder pidió.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dashboard de detalle: header con precio, UF/m², comuna, tipo, operación, link al aviso original | Toda ficha CoStar/LoopNet/Crexi tiene esto como bloque superior | BAJA | 100% con datos ya existentes en `OportunidadMercadoLocal` |
| Posicionamiento vs cohorte (dónde cae este precio vs P25/mediana/P75 de su comuna×tipo) | Es el corazón de cualquier "comp analysis" — CoStar lo llama "vs submarket" | BAJA | Reutilizar `GaugeArc` o `DesviacionBar` (ya construidos), datos ya existen en `obtenerBandasMercadoLocales` |
| Gráfico de historial de precio de ESE listing | CoStar/LoopNet muestran "price history" por ficha individual | BAJA-MEDIA | Dato real en `mercado_locales_historial_precio`; degradar con gracia si <2 puntos (mismo patrón que `KpiCard.sparkline`) — historia acumulada aún corta (desde 1 ago 2026) |
| "Días publicado" / tiempo en mercado | Métrica clásica de CoStar/LoopNet ("days on market") | BAJA | `ultima_vez_visto_el - primera_vez_visto_el` ya está en la tabla, solo falta calcularlo/mostrarlo — quick win no explotado hoy |
| Explicación de por qué es "oportunidad" (reason codes con contexto ampliado) | Ya existe en lista, pero un OM siempre explica el "por qué" en detalle, no solo un badge | BAJA | Ya existe la lógica, solo expandir la presentación en la vista de detalle |
| Señales cruzadas honestas (expansión SII, tendencia INE) en la ficha de detalle | Ya se muestran en la lista — un informe de detalle no puede tener MENOS contexto que la lista | BAJA | Funciones ya existen (`obtenerSenalesExpansionPorComuna`, `obtenerTendenciasConstruccionPorComuna`), solo llamarlas también en detalle |
| Listado de "oportunidades comparables" dentro de la misma comuna/tipo | CoStar/LoopNet siempre sugieren comparables automáticos en la ficha | MEDIA | Reusar `obtenerOportunidadesMercadoLocales` filtrando por comuna+tipo, excluyendo el activo actual |
| Comparación: tabla lado a lado (columnas=propiedades, filas=atributos) | Es el formato universal de CoStar/Crexi/LoopNet/Houzez para comps — no radar chart | BAJA-MEDIA | Todo el dato ya existe por listing; el trabajo es de UI (selección de 2-4 IDs + tabla) |
| Resaltar el mejor valor por fila en la tabla comparativa | Todo comp-grid profesional (CoStar, Crexi) marca visualmente el mejor número por fila | BAJA | Solo lógica de comparación en frontend, sin dato nuevo |
| Límite de 2-4 propiedades en comparación | Houzez/LoopNet imponen este límite para que la tabla siga siendo legible | BAJA | Decisión de UX, no de datos |
| Informe exportable: portada con nombre de oportunidad/comparación, fecha de generación, filtros usados | Todo OM tiene portada — es lo primero que un cliente/inversionista ve | BAJA | Reutilizar patrón `print-button.tsx` + CSS `@media print` (ya en producción en `cadenas-comerciales/compliance` y `clientes/[id]/informe`) |
| Sección de metodología/fuentes con fecha de scraping, UF usada, tamaño de muestra de la cohorte, disclaimer de "solo publicaciones activas, no transacciones cerradas" | Todo informe serio de CBRE/JLL/Colliers cita metodología — y es exactamente la disciplina "nunca fabricar" que ya rige el resto de PermisoHub | BAJA | Texto/template nuevo; los datos a citar (fecha, UF, muestra_n) ya existen |
| Layout optimizado para impresión (oculta nav/controles interactivos, saltos de página, tamaño A4) | Estándar de cualquier informe exportable — sin esto el PDF se ve "cortado a mano" | BAJA | Copiar patrón exacto de `print-button.tsx` (`print:hidden`) |

### Differentiators (Competitive Advantage)

Elevan la percepción de calidad — no son obligatorios, pero son donde PermisoHub puede verse "a la altura" de una consultora sin fingir datos que no tiene.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Resumen ejecutivo narrativo generado por IA (estilo "Investment Highlights" de un OM, en bullets) | Es literalmente el bloque que un cliente lee primero en un informe CBRE/JLL — hoy la lista solo tiene badges | MEDIA | Reutilizar el patrón `InformeEjecutivo` + prompts existentes (`lib/reportes-mercado-prompts.ts`) como plantilla; requiere prompt nuevo pero la arquitectura (extracción de "## Resumen Ejecutivo" + badges de fuentes) ya existe |
| Rentabilidad implícita de zona (UF/m² venta ÷ UF/m² arriendo de la misma cohorte) como "cap rate" aproximado | Acerca el lenguaje al de CBRE/Colliers Chile ("rentabilidad 6-8% sólida para comercial") sin inventar NOI de un activo específico | MEDIA | Cálculo simple sobre bandas ya existentes — **debe** etiquetarse "estimado de zona, no del activo" (mismo criterio que `AvaluoFiscalCard`); solo disponible si existen bandas de AMBAS operaciones para la comuna×tipo |
| Mapa de posicionamiento a nivel comuna (ej. destacar la comuna dentro de un mapa de la región, coloreado por banda de precio) | Da contexto espacial sin fabricar una ubicación exacta que no se tiene | MEDIA-ALTA | Leaflet ya es dependencia, pero requiere conseguir/cargar polígonos de comuna (no existen hoy en el proyecto) — verificar disponibilidad de un GeoJSON de comunas RM antes de comprometer esto a un plan |
| Personalización del informe ("Preparado por ___ para ___") antes de exportar | Los OM de CBRE/JLL siempre llevan a quién va dirigido — ayuda al caso de uso explícito de la founder ("compartir con cliente/inversionista") | BAJA | Solo un pequeño formulario efímero antes de generar el PDF, sin persistencia nueva |
| Radar/spider chart pequeño como complemento visual (NO reemplazo) de la tabla comparativa — ej. 4 ejes: precio relativo, superficie, posición vs P25, señales cruzadas | Un "vistazo" visual adicional; ningún actor de CRE profesional lo usa como comparación principal, pero como complemento no contradice el estándar | MEDIA | Nice-to-have explícito — nunca debe sustituir la tabla (ver anti-feature de "score único") |
| Gráfico de tendencia de la banda P25/mediana/P75 de la comuna en el tiempo (no solo el precio de un listing) | CBRE/JLL siempre incluyen "market overview" con tendencia de submercado, no solo del activo | MEDIA | Reusar `obtenerHistorialMedianaUfM2` (ya existe) — mismo límite de historia corta (desde 1 ago 2026), degradar con gracia igual que hoy |

### Anti-Features (Commonly Requested, Often Problematic)

Cosas que estos actores SÍ hacen pero que no aplican a datos reales disponibles en Chile/PermisoHub, o que estos mismos actores evitan a propósito por buena razón.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Cap rate / NOI real por activo | "Se ve como un reporte institucional de verdad" | Requiere ingreso Y valor del MISMO activo físico — un listing scrapeado es arriendo O venta, nunca ambos; fabricarlo sería inventar un dato de transacción que no existe | Rentabilidad implícita de ZONA, etiquetada explícitamente como estimado agregado (ver differentiator arriba) |
| Fotos, planos, video tour en la ficha de detalle | Todo OM y toda ficha CoStar/LoopNet tienen fotos | El scraper actual (`portalinmobiliario.ts`) no captura imágenes, solo `headline`+`locationText`; agregarlo es un scraper nuevo, no una feature de reporte | Link directo al aviso original (ya existe) — el usuario ve fotos ahí, sin fingir que están "dentro" de PermisoHub |
| Pin exacto en un mapa (dirección/lat-long precisos) | Toda ficha CoStar/LoopNet muestra el pin exacto de la propiedad | No hay dirección ni coordenadas en el dataset — solo comuna + texto libre de ubicación; poner un pin "aproximado" sería fabricar precisión que no existe | Mapa a nivel comuna (differentiator arriba), nunca un pin sobre la propiedad específica |
| Rent roll / información de arrendatarios existentes | Estándar en OM retail institucional (Cenco Malls, Mallplaza manejan esto para SUS activos) | Los listings son publicaciones de terceros en portales — no hay acceso a contratos de arriendo vigentes de esas propiedades | No aplica al contexto: esto es para el dueño evaluando SU propio activo, no para quien busca oportunidades de mercado |
| Demografía de área de influencia (drive-time rings, ingreso, población) vía vendor pagado (ESRI/Nielsen) | Retail OMs de CBRE/JLL/Colliers siempre la incluyen | Vendor pagado ya vetado por la founder en sesiones previas; sin fuente pública chilena equivalente hoy integrada | Fuera de alcance de este milestone — si se quiere a futuro, evaluar INE/CASEN por comuna (público, pero agregado, no un anillo de radio preciso) |
| Walk Score / conteo de tráfico vehicular | Común en OM retail de EE.UU. (CBRE/JLL) | Walk Score es un servicio propietario sin cobertura en Chile; conteos de tráfico no son un dato público accesible por comuna/calle hoy | No incluir — sería o fabricado o inaccesible honestamente |
| Score/ranking automático de "mejor oportunidad" entre las comparadas | Se ve como una IA "inteligente" tomando la decisión por el usuario | Un score ponderado único esconde criterios subjetivos (qué pesa más: precio, ubicación, señales) como si fuera objetivo — contradice la disciplina de "nunca fabricar interpretación no fundamentada" que ya rige el resto del producto, y el usuario (arquitecto/administrador) es quien debe juzgar, no un algoritmo opaco | Tabla comparativa con el mejor valor resaltado POR FILA (el usuario decide qué fila importa más), nunca un ganador único |
| Proyección de flujo de caja multi-año / IRR / cap rate de salida | Estándar en modelos de adquisición de fondos institucionales (CBRE/JLL Capital Markets) | Requiere supuestos de crecimiento de renta, cap rate de salida, plazo de tenencia — todos inventados sin un modelo de inversión real del cliente | No aplica al público objetivo (arquitectos/administradores PYME evaluando arriendo/compra de UN local, no fondos modelando adquisiciones) |
| PDF con boilerplate legal extenso (confidencialidad, "esto no es una oferta...") al estilo OM institucional para fondos | Se ve "profesional" y "serio" | Ese lenguaje responde a normativa de valores de EE.UU. para levantamiento de capital — no aplica a un informe de mercado para un arquitecto/administrador chileno | Una nota de fuentes/metodología honesta y corta (ya es el estándar del resto de PermisoHub) es suficiente rigor sin la afectación legal innecesaria |
| jsPDF dibujado a mano pixel-a-pixel (reutilizar `lib/informe-pdf.ts` tal cual) para el informe de oportunidades | Ya existe ese código en el proyecto, "reutilizarlo" parece eficiente | Esa maquinaria fue diseñada para rasterizar y anotar LÁMINAS DE PLANOS — no hay planos que anotar en oportunidades de mercado; usarla sería sobre-ingeniería para un caso mucho más simple | Patrón `print-button.tsx` + CSS de impresión (ya en producción, mucho más barato) |

## Feature Dependencies

```
Dashboard de detalle de oportunidad
    ├──requires──> Datos ya existentes (OportunidadMercadoLocal + bandas + historial de precio)
    ├──requires──> Componentes de charts ya construidos (KpiCard, GaugeArc, DesviacionBar)
    └──enhances──> Resumen ejecutivo narrativo IA (usa los mismos datos como "fuentes")

Comparación lado a lado (2-4 oportunidades)
    ├──requires──> Dashboard de detalle (misma data por fila, ya trabajada en la fase anterior)
    └──requires──> UI de selección ("agregar a comparar" en la lista de /oportunidades)

Informe exportable (PDF/imprimible)
    ├──requires──> Dashboard de detalle (para exportar UNA oportunidad)
    ├──requires──> Comparación lado a lado (para exportar la comparación)
    ├──requires──> Sección de metodología/fuentes (texto nuevo, sin dependencia de dato adicional)
    └──enhances──> Personalización "preparado por/para" (opcional, no bloquea el PDF base)

Mapa de posicionamiento a nivel comuna ──requires──> Conseguir GeoJSON de comunas RM (NO existe hoy en el proyecto)

Rentabilidad implícita de zona ("cap rate" aproximado) ──requires──> Bandas de AMBAS operaciones (arriendo Y venta) para la misma comuna×tipo — puede no estar disponible en comunas con poca cobertura

Radar chart complementario ──enhances──> Comparación lado a lado (nunca la reemplaza)
Score único de "mejor oportunidad" ──conflicts──> Tabla comparativa con mejor valor resaltado por fila (elegir uno, no ambos — ver anti-feature)
```

### Dependency Notes

- **Comparación lado a lado requiere Dashboard de detalle:** la tabla comparativa reutiliza exactamente los mismos widgets/datos ya resueltos por listing en la fase de detalle (posicionamiento vs cohorte, historial de precio, señales cruzadas) — construir el detalle primero evita duplicar esa lógica al armar la comparación.
- **Informe exportable requiere ambas fases anteriores:** el PDF no es una feature nueva de datos, es una vista de impresión de lo que el detalle y la comparación ya muestran en pantalla — por eso su complejidad marcada es BAJA si se hace con el patrón `print-button.tsx`.
- **Mapa de comuna requiere conseguir un asset nuevo (GeoJSON):** a diferencia de todo lo demás en este documento, esto NO se resuelve solo con código — es una dependencia externa que debe verificarse (¿existe un GeoJSON público de comunas RM usable?) antes de comprometerlo a una fase del roadmap.
- **Rentabilidad implícita de zona depende de cobertura de datos real:** en comunas donde el scraper no tiene suficiente muestra de AMBAS operaciones (arriendo y venta), esta feature debe degradar con gracia (ocultarse), igual que ya hace `KpiCard` sin sparkline cuando no hay historial.
- **Radar chart complementario vs. Score único:** son direcciones opuestas — un radar de 4 ejes es una lectura visual auxiliar que el usuario interpreta él mismo; un score único es una conclusión que el sistema le entrega ya masticada. Elegir el radar (si se hace) y descartar explícitamente el score.

## MVP Definition

### Launch With (v1)

Mínimo para que las "3 cosas concretas" que pidió la founder se sientan completas y a la altura de la comparación (CBRE/JLL/Colliers + CoStar/LoopNet), sin fabricar nada nuevo.

- [ ] Dashboard de detalle por oportunidad: header, posicionamiento vs cohorte (P25/mediana/P75), historial de precio del listing, días publicado, reason codes explicados, señales cruzadas (SII/INE), comparables sugeridos de la misma comuna/tipo — todo con datos que ya existen
- [ ] Comparación lado a lado (2-4 oportunidades) en formato tabla, con el mejor valor resaltado por fila
- [ ] Informe exportable (PDF/vista imprimible) tanto de una oportunidad individual como de una comparación, con portada, cuerpo y sección de metodología/fuentes (fecha de scraping, UF usada, tamaño de muestra, disclaimer "solo publicaciones activas") — usando el patrón `print-button.tsx`, no jsPDF pixel-a-pixel

### Add After Validation (v1.x)

- [ ] Resumen ejecutivo narrativo generado por IA (estilo "Investment Highlights") — agregar una vez que la founder valide que el formato de dashboard/tabla/PDF base ya convence
- [ ] Rentabilidad implícita de zona ("cap rate" aproximado, etiquetado como estimado) — agregar cuando haya cobertura suficiente de ambas operaciones en más comunas
- [ ] Personalización "preparado por/para" en el PDF — trigger: primer cliente real pidiendo compartir el informe con un tercero

### Future Consideration (v2+)

- [ ] Mapa de posicionamiento a nivel comuna — diferir hasta confirmar una fuente de polígonos de comuna utilizable (dependencia externa no resuelta hoy)
- [ ] Radar chart complementario en la comparación — diferir hasta tener señal de que la tabla sola no es suficiente para la founder/usuarios
- [ ] Demografía por comuna vía fuente pública (INE/CASEN) como capa adicional de contexto — diferir, fuera del pedido explícito de este milestone y requiere investigación propia de fuentes

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dashboard de detalle (posicionamiento, historial, señales, comparables) | HIGH | LOW-MEDIUM | P1 |
| Comparación lado a lado (tabla, 2-4, mejor valor resaltado) | HIGH | LOW-MEDIUM | P1 |
| Informe exportable (PDF vía patrón print) con metodología/fuentes | HIGH | LOW | P1 |
| Días publicado / tiempo en mercado | MEDIUM | LOW | P1 (quick win, ya son datos existentes sin usar) |
| Resumen ejecutivo narrativo IA | HIGH | MEDIUM | P2 |
| Rentabilidad implícita de zona (cap rate aproximado) | MEDIUM | MEDIUM | P2 |
| Personalización "preparado por/para" en PDF | MEDIUM | LOW | P2 |
| Mapa a nivel comuna | MEDIUM | MEDIUM-HIGH | P3 |
| Radar chart complementario | LOW-MEDIUM | MEDIUM | P3 |
| Demografía pública por comuna | LOW (fuera de pedido) | HIGH | P3 |

**Priority key:**
- P1: Must have para este milestone
- P2: Debería agregarse apenas el P1 esté validado por la founder
- P3: Nice to have, evaluar en un milestone futuro

## Competitor Feature Analysis

| Feature | CBRE / JLL / Colliers (OM institucional) | CoStar / LoopNet / Crexi (plataforma de datos) | Nuestro enfoque |
|---------|-------------------------------------------|--------------------------------------------------|-------------------|
| Resumen ejecutivo | Narrativa larga + "Investment Highlights" en bullets | Poco/nada de narrativa, todo dato tabular | Bullets breves generados por IA (patrón `InformeEjecutivo` ya existente), sin inflar prosa |
| Cap rate / NOI | Real, por activo, con rent roll | Real, por activo, con historial de transacción | Estimado de ZONA (venta÷arriendo de la cohorte), etiquetado como tal — nunca fabricado por activo |
| Fotos/planos | Alta calidad, profesionales | Fotos + video + floor plans | Ninguna (no capturadas) — link directo al aviso original |
| Mapa | Aérea + mapa de puntos de interés | Pin exacto + comparables geolocalizados | Comuna-level en v2+ (sin GeoJSON hoy) — sin pin exacto (sin dato de dirección/coordenadas) |
| Comparables | Ventas/arriendos "cerrados" curados por el corredor | Comparables automáticos por algoritmo propio | Comparables automáticos por comuna+tipo+operación, siempre desde publicaciones activas reales, nunca transacciones cerradas (no existe esa fuente en Chile) |
| Formato de comparación | Tabla en el cuerpo del informe | Tabla (comp grid) | Tabla, con mejor valor resaltado por fila — sin radar como reemplazo |
| Metodología/fuentes | Disclaimer legal extenso (normativa de valores EE.UU.) | Nota de fuente de datos, más corta | Nota corta de fuentes (fecha scraping, UF, muestra_n, "solo publicaciones activas") — mismo rigor sin boilerplate legal ajeno al contexto |
| Formato de exportación | PDF diseñado en InDesign, pesado | PDF "print-friendly" desde la propia plataforma | PDF vía `window.print()` sobre vista ya estilizada (patrón `print-button.tsx`) — barato de mantener, consistente con lo ya construido |
| Score/ranking automático | No — el corredor arma la narrativa, no un algoritmo | No — CoStar/Crexi muestran datos, el analista decide | No — explícitamente evitado (ver anti-features) |

## Sources

- CBRE — Offering Memorandum (PDF de ejemplo, oficina): https://www.cbre.com/resources/fileassets/US-SMPL-72241/a2ccf4c5/262d7aa4-6ef1-47ea-9e66-9303397aad67.pdf (MEDIUM confianza — metadata/estructura de archivo confirmada, texto interno no extraíble como binario; estructura corroborada por fuentes secundarias abajo)
- InvestNext — What is a Commercial Real Estate Offering Memorandum: https://www.investnext.com/blog/what-is-a-commercial-real-estate-offering-memorandum/
- FNRP — What is an Offering Memorandum in Commercial Real Estate: https://fnrpusa.com/blog/om-commercial-real-estate/
- SharpLaunch — How to Create an Offering Memorandum that Wins Over Investors: https://www.sharplaunch.com/blog/how-to-create-an-offering-memorandum
- BTS Brands — Commercial Real Estate Offering Memorandums: https://btsbrands.com/offering-memorandums/
- CoStar — Sale Comps: https://www.costar.com/products/sales-comps
- CoStar — Property Records: https://www.costar.com/products/property-records
- CoStar Real Estate Manager — Market Data & Analytics: https://costarmanager.com/market-data-analytics
- FasterCapital — Viewing Property Listings on LoopNet: https://fastercapital.com/topics/viewing-property-listings-on-loopnet.html
- Crexi Help Center — Printing Comps & Property Records: https://learn.crexi.com/printing-comps-property-records-crexi-help-center
- Reonomy — Commercial Real Estate Database Guide: https://www.reonomy.com/resources/commercial-real-estate-database/
- Reonomy — What Commercial Real Estate Comps Are & How to Use Them: https://www.reonomy.com/resources/real-estate-comps/
- Altus Group — Comparative Market Analysis in Commercial Real Estate: https://www.altusgroup.com/insights/commercial-real-estate-comparative-analysis/
- Houzez — Property Comparison Tool: https://houzez.co/features/compare-properties/
- Medium/Archilyse — Comparison Tables in Property Search: https://medium.com/archilyse/comparison-tables-in-property-search-da78f258e6c4
- CBRE Chile — Figures Santiago Oficinas 4T 2025 (PDF): https://mediaassets.cbre.com/-/media/project/cbre/dotcom/americas/chile-emerald/insights/2025/figures-santiago-oficinas-q4-2025.pdf
- Colliers Chile — Reporte Residencial 1T 2026: https://www.colliers.com/es-cl/investigacion/reporte-residencial-1t-2026
- Colliers Chile — ¿Qué traerá este 2026 para el rubro inmobiliario?: https://www.colliers.com/es-cl/articulos/santiago/2026-proyecciones
- bmi.cl — Cap rate inmobiliario: qué es y cómo se calcula en Chile: https://bmi.cl/cap-rate-inmobiliario-chile/
- Coldwell Banker Chile — Cómo calcular el cap rate o rentabilidad de tu propiedad: https://carreras.coldwellbanker.cl/blog/blog-1/como-calcular-el-cap-rate-o-rentabilidad-de-tu-propiedad-213
- Código y schema del proyecto (fuente primaria, HIGH confianza): `lib/mercado-locales-server.ts`, `lib/scrapers/mercado-locales-common.ts`, `lib/scrapers/portalinmobiliario.ts`, `supabase/migrations/20260802_mercado_locales_listings.sql`, `supabase/migrations/20260803_mercado_locales_historial_precio_moneda_fix.sql`, `components/mercado-inmobiliario/charts/*`, `components/mercado-inmobiliario/informe-ejecutivo.tsx`, `components/mercado-inmobiliario/avaluo-fiscal-card.tsx`, `lib/informe-pdf.ts`, `app/(dashboard)/cadenas-comerciales/[id]/compliance/print-button.tsx`, `package.json` (leaflet, jspdf, pdfkit ya instalados)

---
*Feature research for: Reportes profesionales de oportunidades inmobiliarias comerciales (PermisoHub — Mercado Inmobiliario)*
*Researched: 2026-08-02*
