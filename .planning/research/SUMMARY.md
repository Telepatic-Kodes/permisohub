# Project Research Summary

**Project:** PermisoHub v1.7 "Cabida Comercial"
**Domain:** Geospatial retail market-sizing (trade-area / gap analysis) — determinar si hay demanda real para un nuevo supermercado, minimarket, strip center o power center en una `Oportunidad`, cruzando isócrona + demografía/consumo público chileno + competencia existente
**Researched:** 2026-08-02
**Confidence:** MEDIUM

## Executive Summary

Cabida Comercial es una versión "hecha con datos públicos y sin vendors pagados" de lo que ESRI Business Analyst, Placer.ai o CoStar venden como trade-area/gap analysis: punto de origen → área de influencia (idealmente isócrona) → demografía y gasto dentro del área → competencia existente → veredicto de 3 estados con confianza. El código de PermisoHub ya tiene tres de los cuatro bloques necesarios construidos para otros propósitos (`lib/geocoding.ts`, el patrón cache-through de `zonificacion/lookup`, y `obtenerSenalesUbicacion()` de Overpass en `lib/terrenos-ubicacion.ts`), y el enfoque recomendado converge: reutilizarlos como plantilla, construir un motor nuevo y desacoplado `(lat, lng, formato) → análisis` (nunca acoplado a `oportunidadId`), cachear con estado explícito por campo, y nunca presentar una cifra derivada con más precisión de la que su fuente tiene.

Dos bloqueadores duros y una tensión de granularidad, verificados de forma independiente por al menos dos de los cuatro researchers, deben resolverse en Requirements antes de fijar el roadmap:

**Bloqueador 1 — la `Oportunidad` no tiene punto geolocalizado.** `mercado_locales_listings` no tiene columna `direccion`, `lat` ni `lng` — solo `comuna` y `atributos_raw->>'locationText'` (texto de sector, ej. "Providencia, Metropolitana"). Geocodificar eso previsiblemente resuelve a un centroide de comuna/sector, no a la ubicación real del local, lo que contradice la razón dada por la founder para preferir isócrona sobre nivel-comuna. Es "la dependencia raíz de todo el milestone" — nada más puede empezar sin esto, y su precisión real debe medirse con ~20 casos reales antes de prometer "isócrona" como nivel de precisión en la UI.

**Bloqueador 2 — strip_center y power_center no tienen fuente pública automatizable.** `supermercado`/`minimarket` mapean a tags OSM estándar ya probados en este repo. `strip_center`/`power_center` son categorías chilenas sin tag equivalente en OSM. La única pista pública (conteo de la Cámara Chilena de Centros Comerciales) es una cifra de marketing sin direcciones ni API. No es "falta investigar más" — es una decisión de alcance sin resolver: heurística por clusters `landuse=retail`, seed list curado a mano, o declarar esos dos formatos "sin datos suficientes". Si el motor cae en "0 competidores" por falta de tag, eso NO es "verificado: no hay competencia" — sería un falso positivo silencioso en la peor categoría posible.

**La tensión de granularidad (población vs. gasto) es real y no se resuelve, se declara.** La población del Censo 2017 alcanza precisión de manzana censal (intersectable con cualquier isócrona vía PostGIS). El gasto (EPF/ENGH) es representativo únicamente a nivel Gran Santiago/capitales regionales/total capitales regionales — nunca comuna, nunca isócrona. No son la misma capa con distinta precisión; son escalas categóricamente distintas. El payload de análisis debe llevar precisión por sub-métrica (población: manzana/isócrona; gasto: proxy macro-zona uniforme), nunca una confianza única para "demografía y consumo" en conjunto. Esto es una característica estructural de las fuentes públicas chilenas que Requirements debe aceptar y diseñar alrededor, no un gap a cerrar con más research.

## Key Findings

### Recommended Stack

Sin vendors pagados, apoyado en servicios/extensiones gratuitas ya compatibles con el proyecto: **openrouteservice (ORS)** para isócronas reales (2.500 req/día gratis, GeoJSON nativo, mismo ecosistema OSM que Nominatim/Overpass), **PostGIS** (extensión gratuita de Supabase) para intersección isócrona↔manzana server-side, **@turf/turf 7.3.5** solo para validación/display client-side. Competencia vía batch/scheduled Overpass u `osmium-tool` sobre Geofabrik Chile, nunca en vivo en el hot path del usuario.

**Core technologies:**
- **openrouteservice API pública** — isócronas walking/driving, free tier apto para uso comercial, polígonos GeoJSON reales (no círculos)
- **PostGIS (Supabase)** — almacenar geometría censal/POIs y ejecutar `ST_Intersects` en SQL, ya incluido gratis
- **Batch Overpass/osmium sobre extract Geofabrik Chile** — ingesta periódica de POIs retail hacia Supabase
- **INE ArcGIS FeatureServer (censo 2017 manzana)** — mismo patrón ya usado para zonificación MINVU/OCUC, capa `MANZANA_IND_C17` con `TOTAL_PERS`/`TOTAL_VIVI`

Hallazgo clave para la tensión de granularidad: nunca usar EPF como si tuviera resolución espacial — único uso legítimo es multiplicador citywide/macro-zona sobre la población que sí resuelve la isócrona.

### Expected Features

El bloqueador del punto geolocalizado domina toda la matriz de priorización: nada más puede ser P1 sin resolverlo primero.

**Must have (table stakes, v1):**
- Punto geolocalizado de la oportunidad (geocoding + fallback a centroide de comuna, precisión etiquetada honestamente) — **el bloqueador**
- Área de influencia por radio simple + selector de los 4 formatos con umbrales citados como "regla EE.UU., no calibrada para Chile"
- Población estimada (Censo 2017 manzana), con disclaimer de antigüedad (2017)
- Conteo de competidores por formato + distancia (extender `obtenerSenalesUbicacion()` de conteo a lista)
- Verdict de 3 estados + confianza + sección de metodología/fuentes — nunca binario

**Should have (differentiators, v1.x):**
- Isócrona real (openrouteservice) reemplazando el radio simple (~2.5x más precisión vs. círculo)
- Capacidad de gasto estimada (EPF+CASEN), etiquetada siempre como "estimado agregado, no medido localmente"
- Gap score honesto de densidad de oferta vs. demanda (nunca índice de leakage/surplus real, que Chile no puede calcular)
- Mapa visual (Leaflet) con pines de competidores
- Roster de competidores con nombre de cadena real (SII geocodificado por comuna)

**Defer / anti-features:**
- Huff model calibrado, leakage/surplus real, foot traffic tipo Placer.ai, GSE preciso vía vendor pagado, score único 0-100, proyección de ventas $/mes, isócrona con tráfico en tiempo real — todos requieren un insumo que Chile no publica o reintroducen un vendor ya vetado
- Canibalización vs. cartera propia y modo standalone — fuera del v1, pero la arquitectura debe soportarlos desde el día 1 para ser aditivos, no un refactor

### Architecture Approach

Tres de los cuatro bloques ya existen en el código, en subsistemas distintos y sin conectar: geocoding (`lib/geocoding.ts`, reusar sin modificar), el patrón "geocode → cache-through → llamada externa → upsert → `force`" (`zonificacion/lookup`, clonar la forma no el código), y Overpass con throttle de producción (`lib/terrenos-ubicacion.ts`, extender de conteo a lista). El cuarto bloque —isócrona real + demografía/consumo granular— es nuevo. Recomendación central: subsistema paralelo y desacoplado, no extensión de zonificación — nueva tabla de caché con estado explícito por campo (isócrona/demografía/competencia, no un status único), único punto de entrada `obtenerAnalisisCabidaComercial(ubicacion, opts)` que nunca acepta `oportunidadId` directamente, fetch bajo demanda desde el tab (nunca eager en el `Promise.all` de la página de detalle).

**Major components:**
1. `lib/cabida-comercial-server.ts` — orquestación server-only: resolvers de ubicación + 3 llamadas cache-through + `evaluarCabidaPorFormato()` pura
2. `cabida_comercial_cache` (nueva tabla) — keyed por `(lat_r, lng_r, modo, minutos)`, con status independiente por campo
3. `app/api/cabida-comercial/analisis/route.ts` — endpoint genérico por ubicación, acepta oportunidad/dirección/lat-lng
4. `cabida-comercial-tab.tsx` — 5º tab en ficha de Oportunidad, fetch on-demand siguiendo el patrón `ResumenTab`

### Critical Pitfalls

1. **Desagregar Censo/EPF a nivel de isócrona sin declararlo** — nunca presentar gasto CLP por isócrona como medido; decisión de granularidad por tipo de dato antes de cerrar Requirements.
2. **Caída silenciosa de isócrona real a círculo sin señalar la degradación** — hasta 80% de error documentado; el tipo de retorno debe incluir `metodo: 'red_vial'|'circulo_equivalente'` desde el diseño inicial.
3. **Roster incompleto (Unimarc sin RUT) interpretado como "no hay competencia"** — peor sesgo posible justo en minimarket/supermercado; nunca dejar que `count === 0` dispare confianza ALTA sin gate de cobertura.
4. **Doble conteo de población por solape de isócronas de la misma cadena** — unir (nunca sumar) geometrías antes de agregar demanda.
5. **Formato de competidor inferido por nombre de marca presentado como hecho** — sin estándar público m²→formato en Chile; todo competidor necesita `formatoFuente`/`formatoInferido`.
6. **Veredicto de 3 estados colapsado a binario en copy/UI** — forzar a nivel de tipos que veredicto y confianza se rendericen siempre juntos.
7. **Mezclar vintages censales (2017 vs 2024) sin declarar la mezcla** — cada cifra lleva `censoAño`/`fuenteVintage` visible.

## Implications for Roadmap

### Phase 0 (pre-roadmap): Spike de validación de datos — sin UI, sin persistencia
**Rationale:** Checkpoint de curso-corrección — si la precisión de geocoding o la granularidad espacial de INE resulta peor de lo esperado, Requirements debe revisar "isócrona, no comuna" antes de construir nada encima.
**Delivers:** Precisión real de geocodificar `locationText` de ~20 oportunidades reales; confirmación de que la capa ArcGIS de manzana censal soporta consultas por polígono; confirmación de que Overpass retorna POIs usables para supermercado/minimarket.
**Avoids:** Comprometer "isócrona" como promesa de precisión sin haberlo verificado.

### Phase 1: Resolución de ubicación + motor de isócrona (con degradación explícita)
**Rationale:** Dependencia raíz — nada más puede construirse sin esto.
**Delivers:** Resolvers `desdeOportunidad`/`desdeDireccion`, cliente ORS con `metodo: 'red_vial'|'circulo_equivalente'` desde el día 1, `UbicacionCabida` con flag `precision: 'exacta'|'aproximada'`.
**Addresses:** "Punto geolocalizado de origen" y "Área de influencia por radio simple" (Table Stakes).
**Avoids:** Pitfall 2 (círculo silencioso) — el campo de degradación debe existir antes de construir consumidores.

### Phase 2: Demografía (población intersectada) + declaración explícita de granularidad
**Rationale:** Dato de mayor confianza (manzana censal), puede construirse independiente de competencia; aquí se fija cómo se expone la asimetría población-vs-gasto en el modelo de datos.
**Delivers:** Tabla `census_manzana` + PostGIS, intersección isócrona↔manzana, cada cifra con `censoAño`/nivel geográfico/fuente desde el schema.
**Uses:** PostGIS (`ST_Intersects`), INE ArcGIS FeatureServer.
**Avoids:** Pitfall 1 (desagregación fabricada) y Pitfall 7 (mezcla de vintages).

### Phase 3: Competencia por formato (con decisión de alcance para strip/power center ya resuelta)
**Rationale:** Depende del área de influencia, no de demografía — puede correr en paralelo a Phase 2. Requiere que Requirements ya haya decidido cómo tratar strip_center/power_center.
**Delivers:** Extensión de `obtenerSenalesUbicacion()` a lista de POIs para supermercado/minimarket, registro de "cobertura conocida" por cadena/formato, resolución explícita para strip/power center.
**Avoids:** Pitfall 3 (roster incompleto → falso positivo) y Pitfall 5 (formato inferido presentado como hecho).

### Phase 4: Veredicto de 3 estados + metodología citada + tab UI
**Rationale:** Capa de síntesis, cierra solo una vez que demografía y competencia (con flags de confianza) existen.
**Delivers:** `evaluarCabidaPorFormato()` pura, componente compartido de veredicto+confianza, sección de metodología/fuentes, tab on-demand (patrón `ResumenTab`).
**Avoids:** Pitfall 6 (colapso a binario) y fetch eager en `Promise.all`.

### Phase 5 (v1.x, post-validación): Capacidad de gasto, gap score, mapa visual
**Rationale:** FEATURES.md los marca explícitamente "Add After Validation" — dependen de que v1 (radio+población+competencia+veredicto) ya esté validado por la founder.
**Delivers:** Capacidad de gasto (EPF+CASEN, siempre etiquetada como proxy), gap score de densidad, mapa Leaflet con isócrona+pines.

### Phase Ordering Rationale

- Replica el "Recommended Build Order (risk-first)" de ARCHITECTURE.md: spike barato primero, luego construir en orden de dependencia (ubicación → demografía/competencia en paralelo → síntesis → pulido).
- Demografía y competencia son fases hermanas (2 y 3): ambas dependen solo de Phase 1, no entre sí.
- Gasto/GSE y mapa quedan después del veredicto v1 porque son diferenciadores post-validación, no bloqueadores del "¿hay indicios de espacio?" honesto que es el objetivo mínimo.
- Isócrona real vs. radio simple puede fasearse dentro de Phase 1 según el spike: si el radio simple valida con la founder, la isócrona real puede diferirse — pero el tipo de retorno con flag de degradación debe existir desde el principio.

### Research Flags

Needs research (`/gsd:research-phase` durante planning):
- **Phase 1:** verificación en vivo de cobertura de red vial de ORS específicamente en Chile — MEDIUM confidence, no verificado con requests reales.
- **Phase 2:** consulta espacial por polígono contra el FeatureServer censal de INE no verificada en vivo (a diferencia de `groupByFieldsForStatistics` por comuna, que sí lo está).
- **Phase 3 (strip/power center):** sin fuente pública confirmada — cualquier heurística necesita investigación específica antes de comprometerse.

Standard patterns (skip research-phase):
- **Phase 1 (geocoding, resolvers):** reutiliza `lib/geocoding.ts` sin cambios y el patrón exacto de `zonificacion/lookup` — HIGH confidence.
- **Phase 3 (competencia OSM):** extiende patrón Overpass ya en producción — HIGH confidence.
- **Phase 4 (veredicto + tab UI):** replica disciplinas y componentes ya establecidos en el proyecto — HIGH confidence.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Isochrone tooling y endpoints INE verificados en vivo; granularidad EPF/CASEN verificada contra metodología oficial; algunos detalles de campo de capas ArcGIS zona/distrito no consultados en vivo todavía |
| Features | MEDIUM | Metodología del rubro verificada contra fuentes oficiales/múltiples independientes; disponibilidad real de gasto/GSE granular en Chile es la de mayor incertidumbre |
| Architecture | HIGH en superficie de integración (verificada contra código real); MEDIUM-LOW en disponibilidad de datos externos para 2 de 4 formatos objetivo |
| Pitfalls | MEDIUM-HIGH | Granularidad de fuentes públicas chilenas verificada contra fuentes oficiales (HIGH); isócronas/canibalización verificados contra literatura técnica general no específica de Chile (MEDIUM); integración con datos ya existentes en el repo verificada directo contra código (HIGH) |

**Overall confidence:** MEDIUM — la superficie de integración y la disponibilidad de datos de población están sólidamente verificadas; la disponibilidad de datos de consumo granular y de competencia para strip/power center son gaps genuinos que requieren una decisión de producto/alcance, no más búsqueda.

### Gaps to Address

- **Precisión real de geocoding de `Oportunidad`:** no probado contra datos reales — correr el spike de ~20 `locationText` antes de fijar el roadmap definitivo.
- **Consulta espacial por polígono contra el FeatureServer censal de INE:** encontrada por búsqueda web, no verificada con un request real que intersecte un polígono de isócrona.
- **strip_center/power_center — sin fuente automatizable confirmada:** el gap más severo — puede no ser automatizable con datos públicos dentro del alcance de v1.7; Requirements debe decidir explícitamente entre heurística, seed list, o declarar el formato no soportado en v1.
- **Gasto de consumo por debajo del nivel Gran Santiago/capital regional:** no existe y no va a aparecer con más research — característica estructural de la EPF, debe asumirse como dato de entrada fijo.
- **Cobertura de red vial de openrouteservice en Chile:** free tier confirmado, calidad/cobertura real del ruteo (un-way, condominios cerrados) no verificada calle por calle.

## Sources

### Primary (HIGH confidence)
- Código del proyecto: `lib/geocoding.ts`, `lib/terrenos-ubicacion.ts`, `lib/zonificacion*.ts`, `app/api/zonificacion/lookup/route.ts`, `lib/mercado-locales-server.ts`, `lib/scrapers/portalinmobiliario.ts`, `lib/scrapers/sii-nomina-sucursales.ts`, `lib/cadenas-sucursales-server.ts`, migraciones Supabase relevantes
- `.planning/data-sources.yaml`, `.planning/PROJECT.md`, `.planning/AUDIT-FIDELIDAD-DATOS-2026-07-30.md`
- `supabase.com/docs/guides/database/extensions/postgis`
- `services3.arcgis.com/.../SHAPES_CENSO_2017/FeatureServer` — consultado en vivo
- INE — metodología VIII/IX EPF (representatividad limitada a Gran Santiago/capitales regionales)
- Esri (esri.com, doc.esri.com) — trade area, Huff model, void/gap analysis, precisión isócrona vs. círculo

### Secondary (MEDIUM confidence)
- `openrouteservice.org` — free tier, endpoints — no verificado en vivo contra cobertura chilena específica
- Population Explorer, Mapular, GrowthFactor, PassBy, Stadia Maps — literatura técnica no específica de Chile
- `.planning/RESEARCH-MERCADO-CENTROS-COMERCIALES.md` — cifra de marketing sin API/direcciones
- ICSC / Robert Gibbs — umbrales de población por formato, cifras de EE.UU. sin calibración chilena

### Tertiary (LOW confidence)
- `pistack.xyz` — comparación OSRM/Valhalla/GraphHopper, blog único
- Búsqueda de estándar de clasificación de formato de supermercado en Chile — sin norma oficial única encontrada

---
*Research completed: 2026-08-02*
*Ready for roadmap: yes — con la condición explícita de que Requirements resuelva el Bloqueador 1 (geocoding de Oportunidad), el Bloqueador 2 (alcance de strip/power center) y declare el diseño de granularidad población-vs-gasto antes de que el roadmap fije fases de datos.*
