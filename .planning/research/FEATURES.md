# Feature Research

**Domain:** Cabida comercial / gap analysis de área de influencia — nueva capacidad del módulo Mercado Inmobiliario de PermisoHub (dado un punto, ¿hay demanda real para un nuevo supermercado, minimarket, strip center o power center?)
**Researched:** 2026-08-02
**Confidence:** MEDIUM (metodología del rubro — ESRI Business Analyst, Huff model, retail leakage/surplus, Placer.ai, ICSC — verificada contra documentación oficial y múltiples fuentes independientes que coinciden; la parte más crítica — QUÉ de eso es replicable con datos públicos chilenos y con lo que ya existe en el código — está verificada directamente contra el repo, no supuesta. Confianza general baja a MEDIUM y no HIGH porque la disponibilidad real de datos de gasto/GSE granular en Chile es la pieza con más incertidumbre del documento)

## Contexto verificado del sistema actual

Antes de listar features, esto es lo que el código YA tiene disponible o YA le falta (verificado en `lib/geocoding.ts`, `lib/terrenos-ubicacion.ts`, `lib/mercado-locales-server.ts`, `lib/scrapers/portalinmobiliario.ts`, `lib/scrapers/sii-nomina-sucursales.ts`, `lib/cadenas-sucursales-server.ts`, `lib/terrenos-server.ts`, `supabase/migrations/20260802_propiedades_portafolio_sii.sql`):

**Bloqueador #1, el más importante de todo este documento:** la `Oportunidad` (`mercado_locales`, la entidad de la ficha de detalle donde la founder quiere el tab nuevo) **no tiene coordenadas ni dirección estructurada** — solo `comuna` + `locationText` en texto libre extraído del card de Portalinmobiliario (típicamente un nombre de sector/barrio, ej. "Las Condes", no una dirección con número). Esto ya se documentó como límite conocido en el milestone anterior (v1.6 FEATURES.md: "Lo que NO existe... dirección exacta, coordenadas lat/long"). **Ninguna feature de área de influencia puede empezar sin resolver esto primero** — es la dependencia raíz de todo el documento, no un detalle de implementación.

**Lo que SÍ existe y es directamente reutilizable:**
- `lib/geocoding.ts`: geocoding dirección→lat/lng vía Nominatim (OpenStreetMap), server-side, con cola de throttle de 1.1s/request. Ya en producción para Terrenos. Puede geocodificar `comuna + locationText`, pero como `locationText` suele ser un sector y no una calle+número, el resultado esperado es precisión de **barrio/sector**, no de predio — hay que ser honesto con esa granularidad en la UI, igual que se es honesto hoy con "no hay dirección exacta" en el resto del módulo.
- `lib/terrenos-ubicacion.ts` (`obtenerSenalesUbicacion`): ya consulta Overpass API (OpenStreetMap) por conteo de anchors comerciales (`shop=mall|supermarket|department_store`) en un radio de 1000m y calles arteriales en 300m, alrededor de un lat/lng. Patrón production-ready: throttle defensivo (5s + backoff en 429, porque Overpass público da solo 2 slots/IP), degrada a `null` sin lanzar ante indisponibilidad. **Hoy retorna solo un conteo**, no una lista de competidores con nombre/distancia — habría que extenderlo, no reescribirlo.
- Terrenos (a diferencia de Oportunidad) **sí tiene lat/lng** — nativo en algunas fuentes (PortalTerreno) o geocodificado. Si el análisis de cabida se ofreciera sobre Terrenos en vez de sobre Oportunidad, el bloqueador #1 no existiría.
- `propiedades_portafolio` tiene `rol_sii` (usado hoy para avalúo fiscal/destino SII), que en teoría podría resolverse a geometría de parcela vía el motor de zonificación (`lib/zonificacion-geo.ts`) — pero es otro módulo, no está cableado a esto.
- `lib/scrapers/sii-nomina-sucursales.ts` + `lib/cadenas-sucursales-server.ts`: nómina de sucursales de cadenas conocidas (Walmart/Líder, Alvi, Super10 confirmadas; **Unimarc, la cadena más grande de SMU, NO está identificada** — cobertura parcial documentada explícitamente en el código). Trae `calle, numero, comuna, region` — **sin lat/lng**. Geocodificar cada dirección para usarlas como puntos de competidor sería un batch nuevo (cientos/miles de direcciones a nivel nacional, a 1.1s/request en cola — sesión de horas, no algo on-demand).
- Leaflet ya es dependencia del proyecto (mapas de zonificación), reutilizable para pintar el área de influencia — pero no hay hoy polígonos de comuna ni renderizado de isócronas.
- **No existe hoy** ninguna fuente de población/demografía integrada, ni servicio de isócronas (rutas por red vial) integrado. Overpass `around:` es radio euclidiano ("a vuelo de pájaro"), no isócrona real.
- Vendors pagados de este tipo de dato (ESRI Business Analyst, Nielsen, Placer.ai) **ya fueron vetados por la founder** en sesiones previas (documentado en v1.6 FEATURES.md como anti-feature) — sigue vigente para este milestone, confirmado por el `<project_context>` del pedido.

## Cómo funcionan las herramientas del rubro (hallazgos de investigación)

**ESRI Business Analyst — trade area + gap analysis.** El flujo estándar: (1) definir un punto, (2) generar anillos de área de influencia (radio o isócrona de tiempo de manejo/caminata), (3) perfilar demografía dentro del área (población, ingreso, gasto por categoría), (4) "Void/Gap Analysis" — comparar clientes/gasto esperado vs. observado por categoría de negocio para detectar huecos. El propio Esri publica que una isócrona de tiempo de manejo es ~2.5x más precisa que un círculo de radio equivalente para estimar catchment retail. MEDIUM-HIGH confianza (doc.esri.com, esri.com oficiales).

**Huff model (modelo de gravedad probabilístico).** `P(i→j) = (Atractivo_j / Distancia_ij^b) / Σ(Atractivo_k / Distancia_ik^b)` — la probabilidad de que un consumidor en el punto i visite la tienda j depende de su tamaño/surtido ("atractivo") relativo a la distancia, comparado contra TODAS las tiendas competidoras. Requiere: atractivo calibrado por tienda (m², surtido, a veces precio) y un parámetro de decaimiento por distancia (`b`) calibrado empíricamente con datos reales de visitas/ventas. MEDIUM-HIGH confianza (ArcGIS Pro docs, fuentes académicas) — pero **el insumo crítico (calibración con datos de venta/visitas reales) no existe públicamente en Chile**, ver más abajo.

**Retail leakage/surplus (gap) analysis — el método "clásico" de EE.UU.** Compara demanda (gasto potencial de los hogares del área, por categoría) contra oferta (ventas reales de los comercios del área, del Economic Census of Retail Trade de EE.UU., desagregado por categoría). El índice va de -100 (superávit total, el área "importa" clientes de afuera) a +100 (fuga total, la demanda local se va a comprar afuera) — un índice positivo/fuga es la señal de "hay espacio". HIGH confianza en que el método existe y es el estándar de consultoras de EE.UU. — **pero depende de un dato de OFERTA (ventas reales por categoría y área) que Chile no publica a nivel comunal/local; no hay equivalente al Economic Census de EE.UU.** Esto es la limitación central de todo este research (ver Anti-Features).

**Placer.ai — trade area por tráfico peatonal/vehicular real.** Usa datos de ubicación de SDKs móviles (panel de dispositivos) para trazar la "True Trade Area" real (de dónde vienen los visitantes de verdad) y "Void Analysis" de qué falta en una zona. Es el estándar más moderno del rubro en EE.UU., pero depende 100% de un panel de datos de movilidad pagado — no hay equivalente público en Chile y es exactamente el tipo de vendor ya vetado por la founder. MEDIUM confianza (sitio propio de Placer.ai, no auditado independientemente).

**ICSC / Robert Gibbs — umbrales de población por formato (reglas de dedo, EE.UU.).** Cifras citadas de forma consistente entre fuentes: local de esquina/minimarket (1.500-3.000 sqft) ≈ 800-1.000 hogares cercanos; centro de conveniencia (10.000-30.000 sqft) ≈ 2.000 hogares en 1-1.5 millas; centro de barrio anclado en supermercado (30.000-100.000 sqft, la definición ICSC de "neighborhood center" es 30.000-125.000 sqft) ≈ 6.000-8.000 hogares en 1-2 millas; power/community center (150.000-600.000 sqft) ≈ 50.000+ personas en 4-6 millas, hasta 150.000+ personas en 10-12 millas para el extremo regional. MEDIUM confianza (coincide entre GIS Geography, ICSC PDFs oficiales, y el análisis independiente de alanworldview.com que además cita explícitamente sus límites: "los umbrales son un punto de partida, no destino — el retail no respeta límites jurisdiccionales, varias cadenas compiten por los mismos hogares, y estos números no se actualizan solos con el crecimiento poblacional"). **Son cifras de EE.UU. — Chile tiene tamaño de hogar distinto (~2.8-3.1 personas/hogar vs. EE.UU.), densidad urbana más alta en ciudades, mayor peso del comercio a pie vs. auto — usar como referencia direccional, nunca como umbral duro sin calibración local, que hoy no existe públicamente para Chile.**

**Isócronas (tiempo de viaje por red vial) vs. radio euclidiano.** El consenso del rubro es usar isócronas (caminata 5/10/15 min, o auto 10-15 min para retail de conveniencia) en vez de círculos, porque un río, una autopista o una topografía irregular hacen que "cerca en línea recta" no sea "cerca en la práctica" — Esri cuantifica esto en ~2.5x más precisión. `openrouteservice` (ORS, open source, sobre datos OSM que tienen cobertura razonable de Chile) ofrece un endpoint de isócronas gratis (500/día, 20/min) y es auto-hospedable sin costo si el volumen crece — MEDIUM-HIGH confianza (documentación oficial de ORS/GIScience). Esto es una integración nueva, no algo que Overpass resuelva (Overpass solo hace radio euclidiano, como ya usa Terrenos hoy).

**Cannibalization analysis (canibalización entre locales propios).** Método estándar: definir el área de influencia de cada local (existente y propuesto) y calcular el % de superposición geométrica — mayor superposición = mayor riesgo de que el local nuevo le quite clientes al existente en vez de capturar demanda nueva. Es, en esencia, geometría sobre polígonos ya calculados para la feature de área de influencia — no requiere un dato nuevo más allá de tener lat/lng de "los locales propios" también. MEDIUM confianza (Carto, GrowthFactor, Mapular — fuentes de producto, no independientes, pero el método geométrico en sí es simple y verificable).

**Chile — disponibilidad real de los insumos:**
- **Población granular:** INE publica el Censo 2017 a nivel de manzana censal, shapefile + CSV, gratis y descargable (`ine.gob.cl/docs/.../microdatos_manzana.zip`, geoportal.cl, ArcGIS Hub del INE) — HIGH confianza en que existe y es público. Limitación real: es **2017, con 9 años de antigüedad en 2026** — el INE publica proyecciones de población a nivel comuna (más recientes) que sirven para reescalar el total, pero no corrigen la distribución espacial dentro de la comuna (un barrio con mucha construcción nueva post-2017 seguiría "pesando" como en 2017 en el dato de manzana).
- **Gasto por categoría:** la Encuesta de Presupuestos Familiares (EPF, INE) da participación de cada categoría en el gasto del hogar (ej. alimentos y bebidas 21,2%, vivienda 16,0%, transporte 15,0%, según la IX EPF oct-2021/sep-2022) — pero es una encuesta **cada ~5 años, con muestra de 79 comunas (capitales regionales y zonas conurbadas)**, no un dato continuo ni granular por comuna/zona. No hay una cifra de "gasto en supermercado del hogar promedio de la comuna X" lista para usar — hay que **combinar** el share nacional de categoría (EPF) con un proxy de ingreso/nivel socioeconómico por comuna (ej. CASEN) para aproximar capacidad de gasto local. Es una estimación de una estimación, y debe etiquetarse así en la UI, sin excepción.
- **No existe** en Chile un equivalente al Economic Census of Retail Trade de EE.UU. (ventas reales por categoría y área geográfica) — esto significa que el "índice de leakage/surplus real" del método clásico de EE.UU. **no es calculable para Chile con fuentes públicas**. PermisoHub solo puede estimar el lado de la DEMANDA (población × gasto estimado) y debe usar la DENSIDAD/CONTEO de competidores como proxy del lado de la oferta — un enfoque legítimo pero deliberadamente más modesto que el "gap score" que venden ESRI/CoStar, y así debe presentarse.
- **GSE (grupo socioeconómico ABC1/C2/C3/D/E) por zona:** es una práctica común de estudios de mercado en Chile (metodologías tipo Adimark, normalmente basadas en variables censales — hacinamiento, material de vivienda, escolaridad — o directamente compradas a proveedores privados). No hay un dataset público listo para usar; construir un proxy propio desde microdatos del Censo 2017 es viable en teoría pero es trabajo de modelado no trivial, y comprar el dato ya está fuera de alcance (vendor pagado, vetado). Alternativa más barata y honesta: usar solamente ingreso promedio/pobreza por comuna (CASEN, público) como proxy único de poder adquisitivo, sin pretender granularidad de zona/manzana que no se tiene.

## Feature Landscape

### Table Stakes (Users Expect These)

Lo que cualquier herramienta seria de "¿hay espacio para un local acá?" (ESRI, Placer.ai, CoStar, Archistar) SIEMPRE resuelve como paso 1 — sin esto el análisis ni siquiera puede empezar, independiente de qué tan sofisticado sea el resto.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Punto geolocalizado de origen (lat/lng) para la oportunidad analizada | Toda herramienta de trade-area parte de un punto en el mapa — sin esto no hay "radio" ni "isócrona" que dibujar | MEDIA | **Bloqueador de todo lo demás.** `Oportunidad` hoy no tiene lat/lng — geocodificar `comuna + locationText` vía `lib/geocoding.ts` (patrón ya en producción), con fallback honesto a centroide de comuna si no resuelve nada más fino. Etiquetar la precisión real obtenida (sector vs. comuna) — nunca mostrar un pin como si fuera la dirección exacta del local (mismo criterio que ya aplica el resto del módulo con "no hay dirección exacta") |
| Área de influencia por radio simple alrededor del punto | Es el mínimo común denominador de cualquier trade area — hasta ESRI empieza por radios antes de ofrecer isócronas | BAJA (una vez resuelto el punto) | Reutilizar el patrón de `RADIO_ANCHORS_M`/Overpass `around:` ya construido en `lib/terrenos-ubicacion.ts`; empezar sin isócrona (diferir a differentiator) |
| Selector de los 4 formatos objetivo (supermercado / minimarket / strip center / power center) | El usuario necesita elegir qué está evaluando construir — cada formato tiene radio/umbral de referencia distinto | BAJA | Tabla de configuración estática con radios/umbrales de referencia por formato (ver umbrales ICSC/Gibbs arriba) — UI simple, sin dato nuevo por consultar |
| Población estimada dentro del área de influencia | Es el primer número que muestra cualquier reporte de ESRI/CoStar/Placer.ai — "¿cuánta gente vive acá?" | MEDIA-ALTA | Requiere cargar el dataset de Censo 2017 manzana (nuevo asset, no existe hoy) e intersectarlo con el área — con disclaimer explícito de antigüedad del dato (2017) |
| Conteo de competidores existentes dentro del área, por formato aproximado y distancia | Toda herramienta de gap analysis muestra "qué hay ya ahí" antes de opinar si falta algo | MEDIA | Extender `obtenerSenalesUbicacion()` (Overpass, ya existe) de "solo conteo" a "lista con nombre/tag/distancia" — los tags `shop=mall|supermarket|department_store` ya están cubiertos; falta `shop=convenience` (proxy de minimarket) y una heurística para strip/power center (agrupación de anchors, no un tag único en OSM) |
| Verdict de 3 estados con nivel de confianza (nunca binario "sí/no hay espacio") | Es la disciplina ya establecida en el resto de PermisoHub (nunca fabricar certeza que no existe) — y honestamente también es lo correcto dado que Chile no tiene el dato de "oferta real" que EE.UU. sí tiene | BAJA-MEDIA | Lógica de decisión sobre las señales de arriba (ej. "evidencia de espacio" / "mercado parece cubierto" / "evidencia insuficiente para concluir"), con confianza degradada explícitamente cuando falta población, competidores, o ambos |
| Sección de metodología/fuentes citadas (fecha del censo, fecha de scraping de competidores, radio usado, disclaimer de qué NO se pudo verificar) | Mismo estándar que el resto de PermisoHub ("nunca fabricar o esconder datos", cada claim con fuente y fecha de frescura) — y es literalmente lo que distingue esta feature de un score de caja negra | BAJA | Texto/template nuevo, mismo patrón que `MetodologiaInforme` ya construido en v1.6 |

### Differentiators (Competitive Advantage)

No obligatorios para el lanzamiento del tab, pero es donde PermisoHub puede acercarse al nivel de ESRI/Placer.ai sin comprar lo que ellos compran — combinando fuentes públicas de forma honesta.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Isócrona real (caminata/auto) en vez de radio euclidiano | Esri mide ~2.5x más precisión vs. círculo — un río o una autopista cambian totalmente qué población "realmente" puede llegar caminando | MEDIA-ALTA | Integración nueva con `openrouteservice` (gratis hasta 500/día, auto-hospedable si escala) — cobertura OSM de Chile es razonable pero no verificada calle por calle; degradar con gracia a radio si el servicio falla (mismo criterio que Overpass hoy) |
| Capacidad de gasto estimada por categoría (población × ingreso/GSE proxy comunal × share EPF) | Es el paso que separa "cuánta gente hay" de "cuánto podrían gastar en supermercado/retail" — el corazón de un gap analysis real | MEDIA-ALTA | **Debe etiquetarse explícitamente "estimado agregado, no medido localmente"** (mismo criterio que ya aplica `AvaluoFiscalCard`/"rentabilidad implícita de zona" en v1.6) — combina 2 fuentes públicas de granularidad distinta (EPF nacional/79 comunas + CASEN comunal), nunca presentar como gasto medido |
| Gap score honesto (demanda estimada vs. densidad de oferta existente) | Da una señal resumida sin pretender ser el índice de leakage/surplus real de EE.UU. (que Chile no puede calcular por falta de dato de ventas reales) | MEDIA | Etiquetar explícitamente como proxy de densidad, no como índice de fuga de ventas real — mismo espíritu que el resto del gap analysis: nunca fingir precisión que el dato no sustenta |
| Riesgo de canibalización entre formatos objetivo y otras oportunidades/propiedades del propio usuario (cartera) dentro del área | Responde una pregunta que un inversionista con varios activos SÍ se hace y que ninguna herramienta genérica (ESRI) responde para SU cartera específica | MEDIA-ALTA | Requiere lat/lng también de `propiedades_portafolio`/`terrenos` propios del usuario — mismo problema de geocoding que el bloqueador #1, mismo patrón de solución |
| Roster de competidores con nombre de cadena real (cruzando OSM + nómina SII geocodificada) | Va más allá de "hay un supermercado ahí" — dice "es un Líder Express", que es información accionable para evaluar competencia directa vs. cadena que uno mismo representa | ALTA | Geocodificar la nómina SII completa es un batch nacional pesado (Nominatim, cola de 1.1s/request, miles de direcciones) — hacerlo on-demand por comuna consultada (no batch nacional completo) reduce el costo, pero la cobertura SII ya es conocida como incompleta (falta Unimarc) |
| Mapa visual del área de influencia con pines de competidores | Todo reporte de ESRI/CoStar/Placer.ai tiene un mapa como pieza central, no solo tablas | MEDIA | Leaflet ya es dependencia — falta renderizar el polígono de área de influencia (círculo o isócrona) y los pines de competidores sobre el mapa existente |
| Motor desacoplado ("cabida por dirección/comuna libre", no solo desde una Oportunidad) | Es la visión explícita del founder a futuro — cualquier dirección o comuna, no solo las oportunidades ya scrapeadas | MEDIA (si se diseña bien desde el día 1) / ALTA (si se acopla fuerte a `Oportunidad` primero) | Decisión de arquitectura crítica: el "motor de cabida" (punto → área de influencia → población → competidores → verdict) debe ser una función pura sobre `(lat, lng, formato)`, no sobre `oportunidadId` — el tab de Oportunidad es solo un consumidor de esa función, igual que el modo standalone futuro sería otro |

### Anti-Features (Commonly Requested, Often Problematic)

Cosas que ESRI/Placer.ai/Huff SÍ hacen, pero que en el contexto de PermisoHub (datos públicos chilenos, sin vendors pagados, disciplina de "nunca fabricar") son o inaccesibles o activamente engañosas si se simulan.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Huff model completo (probabilidad de captura de mercado calibrada) | "Se ve como lo que hace ESRI Business Analyst de verdad" | Requiere calibrar un "atractivo" por tienda y un parámetro de decaimiento por distancia (`b`) con datos reales de visitas/ventas — Chile no tiene esa fuente pública; inventar los pesos sería fabricar una probabilidad con apariencia científica sobre un supuesto no verificado, exactamente lo que el producto se prohíbe hacer | Conteo + distancia + formato por competidor (ya en Table Stakes), que el usuario interpreta él mismo — sin fusionar en una probabilidad de mercado inventada |
| Índice de leakage/surplus real (ventas reales del área vs. potencial) | Es el estándar de las consultoras de EE.UU. y "se ve más riguroso" | No existe en Chile un equivalente al Economic Census of Retail Trade (ventas reales por categoría y comuna) — el índice sería, en la práctica, un número calculado sin el 50% de sus insumos reales | Gap score basado en densidad de oferta (competidores/población), etiquetado explícitamente como proxy y no como índice de ventas |
| Foot traffic real (tipo Placer.ai, panel de dispositivos móviles) | Es el estándar más moderno del rubro en EE.UU. | Vendor pagado, ya vetado explícitamente por la founder; sin equivalente público chileno | Proxy de flujo vehicular vía cercanía a avenida principal (ya existe el patrón en `lib/terrenos-ubicacion.ts` para terrenos) |
| GSE (grupo socioeconómico) preciso por manzana vía dataset comercial (Adimark/Ipsos/similar) | Da granularidad fina de poder adquisitivo, estándar en estudios de retail chilenos privados | Es un vendor pagado — mismo veto que ESRI/Nielsen — y construir un proxy propio desde microdatos censales es trabajo de modelado no trivial, fuera de alcance de este milestone | Ingreso/pobreza promedio por comuna vía CASEN (público), como único proxy de poder adquisitivo — más modesto pero honesto sobre su granularidad real |
| Score único 0-100 de "viabilidad del local" | Se ve como una recomendación de IA clara y accionable | Esconde criterios subjetivos (cuánto pesa población vs. competencia vs. gasto) como si fuera objetivo — mismo anti-feature ya documentado y descartado en v1.6 (mercado inmobiliario) por la misma razón: el usuario debe juzgar, no un número opaco | Verdict de 3 estados + confianza (Table Stakes arriba), con cada señal mostrada por separado para que el usuario pondere |
| Proyección de ventas/facturación esperada del futuro local ($/mes) | Es la pregunta de negocio final que el inversionista realmente quiere responder | Requiere un modelo de captura de mercado (Huff) + ticket promedio real por formato — ninguno de los dos insumos está disponible con fuentes públicas chilenas; sería inventar una cifra financiera con apariencia de precisión | Mostrar demanda estimada y densidad de oferta por separado (Differentiators arriba) — el usuario infiere la oportunidad, PermisoHub no inventa el número final |
| Isócrona con tráfico en tiempo real (hora punta vs. valle) | Se ve más "inteligente" que una isócrona estática | Modelar congestión en vivo requiere servicios pagados (Google/TomTom Traffic); ni Overpass ni openrouteservice gratuito lo ofrecen con la fidelidad necesaria | Isócrona estática de referencia (velocidad promedio de la vía), etiquetada explícitamente como tal, no como "tiempo real" |

## Feature Dependencies

```
Punto geolocalizado de origen (lat/lng)
    └──requires──> Geocoding comuna+locationText (lib/geocoding.ts, ya existe) + fallback a centroide de comuna

Área de influencia (radio simple)
    └──requires──> Punto geolocalizado de origen
    └──enhances──> (isócrona real) reemplaza el radio una vez integrada, sin bloquear el lanzamiento

Población dentro del área de influencia
    └──requires──> Área de influencia
    └──requires──> Dataset Censo 2017 manzana (nuevo asset, no existe hoy en el proyecto)

Capacidad de gasto por categoría
    └──requires──> Población dentro del área de influencia
    └──requires──> Ingreso/pobreza comunal (CASEN, nuevo dataset)
    └──requires──> Share de categoría EPF (nuevo dataset, agregado nacional cada ~5 años)

Conteo de competidores por formato + distancia
    └──requires──> Área de influencia
    └──enhances──(base)──> obtenerSenalesUbicacion() ya existente (lib/terrenos-ubicacion.ts) — extender de conteo a lista
    └──enhances──(opcional, más caro)──> Nómina SII geocodificada por comuna (roster con nombre de cadena real)

Gap score (proxy de densidad, honesto)
    └──requires──> Capacidad de gasto por categoría
    └──requires──> Conteo de competidores por formato + distancia
    └──conflicts──> Huff model / índice de leakage real (no hay datos de venta/tráfico para calibrar — elegir el proxy honesto, no el modelo que no se puede alimentar con datos reales)

Riesgo de canibalización (cartera propia)
    └──requires──> Área de influencia
    └──requires──> lat/lng de otras oportunidades/propiedades del mismo usuario (mismo gap de geocoding que el bloqueador #1)

Verdict de 3 estados + confianza
    └──requires──> Gap score (proxy)
    └──requires──> Conteo de competidores
    └──requires──> Sección de metodología/fuentes (siempre acompaña el verdict, sin excepción)

Motor de cabida desacoplado (para modo standalone futuro)
    └──enhances──> Tab de Cabida Comercial en Oportunidad (mismo motor, distinto punto de entrada — decisión de arquitectura, no una feature de datos)

Score único de viabilidad ──conflicts──> Verdict de 3 estados + señales separadas (elegir uno — ver anti-feature)
```

### Dependency Notes

- **Todo depende del punto geolocalizado, y el punto geolocalizado hoy no existe para `Oportunidad`:** esta es la dependencia raíz de todo el milestone. Antes de decidir cómo se ve el "gap score" o el "verdict", hay que decidir y validar cómo se resuelve `comuna + locationText → lat/lng` con una precisión honesta — probablemente la primera fase del roadmap de este milestone, no una tarea intercalada.
- **Población y capacidad de gasto son datasets nuevos, no cálculos sobre datos existentes:** a diferencia de casi todo lo que se construyó en v1.6 (que reutilizaba datos ya en la base), Censo 2017 manzana y CASEN/EPF son assets externos que hay que conseguir, cargar y mantener — verificar tamaño/formato de los archivos y decidir dónde viven (¿tabla propia? ¿archivo estático servido?) antes de comprometer esto a una fase.
- **Gap score real (leakage/surplus) vs. proxy de densidad son caminos distintos, no una simplificación del mismo camino:** el método clásico de EE.UU. necesita un dato de OFERTA REAL (ventas) que Chile no tiene público; el proxy de densidad es un método genuinamente distinto (más simple, pero honesto sobre serlo) — no presentar el proxy con el lenguaje del método real ("índice de fuga de ventas") porque implicaría una precisión que no tiene.
- **Canibalización contra cartera propia hereda el mismo gap de geocoding que el bloqueador #1**, aplicado ahora a `propiedades_portafolio`/`terrenos` del usuario — si el punto de origen de la oportunidad ya se resolvió, este es el mismo patrón aplicado una segunda vez, no una feature nueva desde cero.
- **El motor desacoplado no es una feature adicional, es una decisión de diseño de la fase 1:** construir el "cálculo de cabida" como función de `(lat, lng, formato)` en vez de `(oportunidadId)` cuesta prácticamente lo mismo si se hace desde el inicio, y evita un refactor caro cuando llegue el modo standalone que el founder ya pidió a futuro.

## MVP Definition

### Launch With (v1)

Mínimo para que el tab "Cabida Comercial" en la ficha de Oportunidad responda honestamente "¿hay indicios de espacio acá?" sin fabricar nada que Chile no tiene.

- [ ] Resolución del punto geolocalizado de la oportunidad (geocoding `comuna+locationText` + fallback a centroide de comuna, con la precisión real etiquetada en la UI) — bloqueador de todo lo demás
- [ ] Área de influencia por radio simple, con presets configurables por formato (no isócrona todavía)
- [ ] Selector de los 4 formatos objetivo (supermercado/minimarket/strip center/power center) con umbrales de referencia citados como "regla de dedo de EE.UU., no calibrada para Chile"
- [ ] Población estimada dentro del área (Censo 2017 manzana), con disclaimer de antigüedad del dato
- [ ] Conteo de competidores por formato aproximado + distancia (extender `obtenerSenalesUbicacion`)
- [ ] Verdict de 3 estados + nivel de confianza + sección de metodología/fuentes (fecha censo, fecha de scraping, radio usado, qué no se pudo verificar)

### Add After Validation (v1.x)

- [ ] Capacidad de gasto estimada por categoría (EPF + CASEN) — agregar una vez conseguidos y validados ambos datasets
- [ ] Gap score honesto (demanda vs. densidad de oferta) — depende de la capacidad de gasto de arriba
- [ ] Mapa visual (Leaflet) del área de influencia con pines de competidores — trigger: founder/usuarios piden ver el área, no solo leerla en números
- [ ] Roster de competidores con nombre de cadena (SII geocodificado por comuna, no batch nacional completo) — trigger: el conteo simple se siente insuficiente para decidir

### Future Consideration (v2+)

- [ ] Isócrona real (openrouteservice) reemplazando el radio simple — diferir hasta validar que el radio simple no es suficiente y confirmar cobertura OSM de las comunas relevantes
- [ ] Riesgo de canibalización contra cartera propia — diferir hasta tener lat/lng resuelto también para `propiedades_portafolio`/`terrenos`
- [ ] Modo standalone por dirección/comuna libre (sin pasar por una Oportunidad) — la arquitectura debe soportarlo desde el día 1 (motor desacoplado), pero la UI/entry-point standalone en sí se difiere hasta que el tab en Oportunidad esté validado
- [ ] GSE proxy propio desde variables censales — diferir indefinidamente salvo que el ingreso/pobreza comunal (CASEN) resulte claramente insuficiente para los usuarios

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Punto geolocalizado de origen (geocoding + fallback comuna) | HIGH | MEDIA | P1 (bloqueador) |
| Área de influencia por radio + selector de formato | HIGH | BAJA | P1 |
| Población en área de influencia (Censo 2017 manzana) | HIGH | MEDIA-ALTA | P1 |
| Conteo de competidores por formato + distancia | HIGH | MEDIA | P1 |
| Verdict de 3 estados + confianza + metodología | HIGH | BAJA-MEDIA | P1 |
| Capacidad de gasto por categoría (EPF+CASEN) | MEDIUM-HIGH | MEDIA-ALTA | P2 |
| Gap score honesto (densidad) | MEDIUM-HIGH | MEDIA | P2 |
| Mapa visual con pines de competidores | MEDIUM | MEDIA | P2 |
| Roster de competidores con nombre de cadena (SII geocodificado) | MEDIUM | ALTA | P2-P3 |
| Isócrona real (openrouteservice) | MEDIUM | MEDIA-ALTA | P3 |
| Riesgo de canibalización vs. cartera propia | MEDIUM | MEDIA-ALTA | P3 |
| Modo standalone por dirección libre | MEDIUM (visión a futuro del founder) | MEDIA (si se diseña bien desde P1) | P3 |
| GSE proxy propio desde censo | LOW (fuera de pedido explícito) | ALTA | P3/descartado |

**Priority key:**
- P1: Must have para este milestone (tab de Cabida Comercial funcional y honesto)
- P2: Debería agregarse apenas el P1 esté validado por la founder
- P3: Nice to have, evaluar en un milestone futuro

## Competitor Feature Analysis

| Feature | ESRI Business Analyst / CoStar (institucional, pagado) | Placer.ai (foot traffic, pagado) | Nuestro enfoque |
|---------|----------------------------------------------------------|-----------------------------------|-------------------|
| Área de influencia | Radio e isócrona de tiempo de manejo, ambos nativos | "True Trade Area" real desde datos de movilidad | Radio simple en v1 (reutiliza patrón Overpass de Terrenos), isócrona (openrouteservice) diferida a v2+ |
| Población/demografía | Censos + proyecciones propias, actualización frecuente | Igual, más datos psicográficos propietarios | Censo 2017 manzana (público, gratis), con disclaimer explícito de antigüedad |
| Gasto por categoría | Modelos propietarios de gasto por hogar, granulares | No es su foco central | Combinación EPF (nacional, share por categoría) + CASEN (comunal, ingreso/pobreza) — etiquetado como estimado agregado |
| Oferta/competencia | Base de datos propia de ubicaciones + a veces ventas reales por categoría (leakage index real) | Ubicaciones reales vía su propio panel | OSM (Overpass, ya integrado) + SII nómina (parcial, sin lat/lng nativo) — solo densidad/conteo, nunca ventas reales (no existe esa fuente pública en Chile) |
| Gap score | Índice de leakage/surplus real (ventas reales vs. potencial) | Void analysis basado en tráfico real | Gap score proxy basado en densidad de oferta vs. demanda estimada — etiquetado explícitamente como proxy, no como el índice real |
| Modelo de captura de mercado | Huff model calibrado con datos propios | Modelo propio sobre datos de tráfico real | Ninguno — conteo/distancia por competidor, sin fusionar en una probabilidad (ver anti-features) |
| Verdict/output | Reportes con múltiples scores y rankings de sitios | Reportes con recomendación de sitios "ideales" | Verdict de 3 estados + confianza + metodología citada — nunca un score único ni un ranking (misma disciplina que el resto de PermisoHub) |
| Costo del dato subyacente | Licencia anual alta (vendor pagado) | Licencia alta (vendor pagado) | 100% fuentes públicas (INE, CASEN, OSM, SII) — más modesto en precisión, pero verificable y sin costo recurrente de vendor |

## Sources

- Esri — ArcGIS Business Analyst overview: https://www.esri.com/en-us/arcgis/products/arcgis-business-analyst/overview
- Esri Learn — Identify retail gaps with void analysis: https://learn.arcgis.com/en/projects/identify-retail-gaps-with-void-analysis/
- Esri — Analyze Market Area Gap (Business Analyst Tools), ArcGIS Pro docs: https://doc.esri.com/en/arcgis-pro/latest/tool-reference/business-analyst/analyze-market-area-gap.html
- Esri — Retail Store Location Analysis / Site Suitability: https://www.esri.com/en-us/industries/retail/strategies/site-suitability
- Esri ArcGIS Blog — Got five minutes? Get to know trade areas in Business Analyst: https://www.esri.com/arcgis-blog/products/bus-analyst/mapping/five-minutes-trade-areas
- ArcGIS Pro docs — How Huff Model works: https://pro.arcgis.com/en/pro-app/3.5/tool-reference/business-analyst/understanding-huff-model.htm
- ArcMap docs — How Original Huff Model works: https://desktop.arcgis.com/en/arcmap/latest/tools/business-analyst-toolbox/how-original-huff-model-works.htm
- GIS Geography — Huff Gravity Model: Store Customer Predictions: https://gisgeography.com/huff-gravity-model/
- City of Wildwood — Retail Leakage and Surplus Analysis (ejemplo de informe): https://www.cityofwildwood.com/783/Retail-Trade-Area-Analysis-PDF
- N. David Milder (DANTH, Inc.) — Retail Leakage/Gap Analyses Should Be Treated With Great Caution: https://www.ndavidmilder.com/2016/09/retail-leakageleakage-analyses-should-be-treated-with-great-caution-by-analysts-and-end-users-analytical-issues
- Wikipedia — Leakage (retail): https://en.wikipedia.org/wiki/Leakage_(retail)
- Placer.ai — The Complete Guide to Trade Area Analysis: https://www.placer.ai/guides/trade-area-analysis
- Placer.ai — CRE Foot Traffic Analytics: https://www.placer.ai/solutions/cre
- ICSC — Shopping Center Definitions / U.S. Shopping Center Definition Standard (GLA por tipo): https://www.icsc.com/uploads/t07-subpage/US-Shopping-Center-Definition-Standard.pdf
- Wikipedia — Neighborhood shopping center: https://en.wikipedia.org/wiki/Neighborhood_shopping_center
- Wikipedia — Power center (retail): https://en.wikipedia.org/wiki/Power_center_(retail)
- alanworldview.com — How Much Retail Can Your Community Actually Support? (umbrales Robert Gibbs + crítica del método): https://www.alanworldview.com/p/how-much-retail-can-your-community
- Archistar — Running a Feasibility Study: https://www.archistar.ai/blog/running-a-feasibility-study-how-to-find-the-optimum-financial-outcome-for-your-property-development/
- GrowthFactor — 3-Mile Radius vs. Drive-Time Polygon: https://www.growthfactor.ai/resources/blog/radius-vs-drive-time-trade-area
- GrowthFactor — Cannibalization Analysis: Protect Retail Revenue: https://www.growthfactor.ai/resources/blog/cannibalization-analysis-retail
- Carto Academy — Store cannibalization tutorial: https://academy.carto.com/advanced-spatial-analytics/spatial-analytics-for-bigquery/step-by-step-tutorials/store-cannibalization-quantifying-the-effect-of-opening-new-stores-on-your-existing-network
- openrouteservice — sitio oficial y docs de Isochrones Endpoint: https://openrouteservice.org/ , https://giscience.github.io/openrouteservice/api-reference/endpoints/isochrones/
- INE — Geodatos Abiertos (portal): https://www.ine.gob.cl/herramientas/portal-de-mapas/geodatos-abiertos
- INE — Microdatos Censo 2017: Manzana (descarga shapefile): https://www.ine.gob.cl/docs/default-source/geodatos-abiertos/cartografia/censo-2017/siedu/shp/microdatos_manzana.zip
- INE — Manual de Usuario Base de Datos Censo de Población y Vivienda 2017 (Redatam): https://redatam-ine.ine.cl/manuales/Manual-Usuario.pdf
- INE — X Encuesta de Presupuestos Familiares (EPF), página oficial: https://www.ine.gob.cl/epf
- INE — Síntesis de Resultados IX EPF (oct-2021/sep-2022): https://www.ine.gob.cl/docs/default-source/encuesta-de-presupuestos-familiares/publicaciones-y-anuarios/ix-epf-(octubre-2021---septiembre-2022)/sintesis-de-resultados-ix-epf.pdf
- INE — Nota de prensa IX EPF (gasto promedio hogar $1,4M, 21,2% alimentación): https://www.ine.gob.cl/sala-de-prensa/prensa/general/noticia/2023/10/26/hogares-en-chile-gastan-m%C3%A1s-de-1-4-millones-de-pesos-en-promedio-al-mes-el-21-2-de-ese-monto-es-para-alimentaci%C3%B3n
- Código y schema del proyecto (fuente primaria, HIGH confianza): `lib/geocoding.ts`, `lib/terrenos-ubicacion.ts`, `lib/mercado-locales-server.ts`, `lib/scrapers/portalinmobiliario.ts`, `lib/scrapers/sii-nomina-sucursales.ts`, `lib/cadenas-sucursales-server.ts`, `lib/terrenos-server.ts`, `supabase/migrations/20260802_propiedades_portafolio_sii.sql`
- `.planning/research/FEATURES.md` de milestone v1.6 (mismo repo, contexto de lo ya construido y de las decisiones de "nunca fabricar" ya vigentes)

---
*Feature research for: Cabida Comercial — módulo Mercado Inmobiliario (PermisoHub)*
*Researched: 2026-08-02*
