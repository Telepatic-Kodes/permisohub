# Pitfalls Research

**Domain:** Agregar "Cabida Comercial" (análisis de demanda/brecha comercial) a PermisoHub — cruzar demografía/consumo público chileno + isócrona computada + competencia existente (parcial) en un veredicto por formato con confianza, dentro de un módulo (Mercado Inmobiliario) con historial reciente y documentado de bugs de fabricación de datos.
**Researched:** 2026-08-02
**Confidence:** MEDIUM-HIGH — los pitfalls de granularidad de fuentes públicas chilenas (INE Censo/REDATAM, EPF/ENGH) están verificados contra fuentes oficiales INE (manual REDATAM, catálogos IHSN de la EPF) — HIGH confidence. Los pitfalls de isócronas-sin-motor-de-ruteo y canibalización/solape de áreas de influencia están verificados contra literatura técnica de geoespacial/retail (Mapular, Population Explorer, GrowthFactor, PassBy) — MEDIUM confidence, patrón ampliamente documentado pero no específico de Chile. Los pitfalls de integración con datos ya existentes en este repo (roster SII incompleto, RUT de Unimarc, patrón de veredicto 3-estados, disciplina "nunca fabricar") están verificados directamente contra `data-sources.yaml`, `PROJECT.md` y el código real (`lib/terrenos-ubicacion.ts`, `lib/cuadros-calculo.ts`, `lib/propiedades-portafolio-server.ts`) — HIGH confidence.

## Critical Pitfalls

### Pitfall 1: Desagregar Censo/EPF a nivel de isócrona cuando la fuente nunca se publicó a esa resolución ("precisión fabricada por interpolación silenciosa")

**What goes wrong:**
El Censo 2017 en formato REDATAM (el producto con detalle sociodemográfico real) llega hasta **zona censal/localidad** — no manzana; existe un dataset separado de manzana/entidad, pero solo con totales básicos (población por edad/sexo, vivienda), sin ingreso ni consumo. La **EPF/ENGH** (la única fuente pública de gasto de consumo) es representativa **solo a nivel de capital regional / Gran Santiago** — ni siquiera a nivel comuna, y explícitamente "no representativa a nivel mensual ni regional" fuera de esas áreas. Ninguna de las dos fuentes fue diseñada para cortarse por un polígono de isócrona arbitrario. La founder ya priorizó precisión de isócrona sobre disponibilidad garantizada de datos (`PROJECT.md` línea 200) — la tentación bajo esa presión es interpolar por área ("la isócrona cubre 40% de la zona censal X, le atribuyo 40% de su población/gasto") o, peor, aplicar directamente un promedio nacional/de capital regional de gasto a la población local como si fuera una medición local. Ambos casos producen un número con apariencia de medición exacta que en realidad es un supuesto de densidad/gasto uniforme no declarado.

**Why it happens:**
La interpolación por área *parece* matemáticamente rigurosa (hay un cálculo real detrás), lo que la hace más peligrosa que un promedio simple — es fácil convencerse de que "ya se hizo el trabajo correcto" cuando en realidad el supuesto de fondo (densidad/gasto uniforme dentro de la zona censal) es exactamente el mismo tipo de generalización indebida que el propio milestone busca evitar ("comuna-level averages... aplicadas evenly within a sub-comuna isochrone"), solo movida un nivel más abajo donde es menos visible.

**How to avoid:**
- Etiquetar toda cifra demográfica derivada de isócrona como "estimado por interpolación de área — no medido a nivel de isócrona", citando la geografía fuente real (zona censal, año) — nunca presentar un conteo de personas dentro de la isócrona como un dato medido.
- Para gasto de consumo: dado que la EPF no es representativa bajo el nivel de capital regional, **no** producir una cifra de gasto CLP específica por isócrona o comuna como si fuera dato — o se omite el nivel de gasto en CLP por isócrona, o se presenta explícitamente como "proxy nacional/macrozona aplicado a la población local, no medición local", siguiendo la misma disciplina ya usada en `TabEstimacion` para datos municipales sintéticos ("ESTIMADA — datos sintéticos, no medidos").
- Decisión de qué nivel geográfico respalda cada tipo de cifra (población vs. estructura etaria vs. gasto) debe tomarse **antes de cerrar Requirements**, no durante implementación — es justo la validación que `PROJECT.md` ya marca como pendiente ("investigación previa a Requirements para validar qué fuentes públicas chilenas realmente permiten ese nivel de granularidad").

**Warning signs:**
Cualquier número demográfico o de gasto en la UI sin una nota de nivel geográfico/año visible; cualquier función que multiplique un promedio EPF por población de isócrona sin un flag `esProxy`/`esEstimado` acompañante.

**Phase to address:**
Antes de cerrar Requirements (decisión de fuentes y granularidad por tipo de dato) — luego verificado en la fase de modelo de datos (el schema debe tener el campo de vintage/nivel-geográfico desde la primera migración).

---

### Pitfall 2: Caída silenciosa de isócrona real a círculo de radio fijo, sin señalar la degradación

**What goes wrong:**
Sin presupuesto para un motor de ruteo pago (Google/Mapbox Isochrone API, TravelTime), la opción realista es red vial vía OSM/Overpass o una librería de cálculo local — ambas con puntos de falla reales (Overpass ya tiene rate-limit documentado de solo 2 slots/IP en este mismo repo, ver `lib/terrenos-ubicacion.ts`). El fallback natural y razonable ante un fallo es dibujar un círculo de radio equivalente — pero un buffer circular ignora calles, ríos, autopistas, cerros y condominios cerrados: la evidencia técnica documenta hasta **80% de error** en el área de captura real (ej. 14 destinos dentro del buffer euclidiano vs. solo 5 realmente alcanzables por calle), y un radio de caminata de 15 minutos sobre una red pensada para autos "no alcanza casi nada" en la práctica. Si ese fallback no queda marcado, el conteo de competencia y la demografía calculados sobre un círculo reciben la misma confianza visual que un caso con isócrona real, degradando todo el veredicto sin evidencia visible para quien lo lee.

**Why it happens:**
El patrón ya existe en este mismo repo para otro propósito (`OverpassUnavailableError` distingue "servicio caído" de "resultado real" para no contaminar `ubicacion_status`) — pero es fácil que el código nuevo de isócrona no herede esa disciplina y en su lugar solo tenga un `catch` genérico que retorna una geometría sin un estado que la acompañe.

**How to avoid:**
- El tipo de retorno de la isócrona debe incluir desde el diseño inicial un campo como `metodo: 'red_vial' | 'circulo_equivalente'` — nunca solo el polígono.
- Todo consumidor (demografía, competencia, veredicto) debe leer ese campo y **degradar la confianza automáticamente** cuando es `circulo_equivalente` (tope de confianza MEDIA aunque el resto del cálculo sea sólido).
- La UI debe mostrar un aviso explícito ("radio aproximado — no se pudo calcular la ruta real") con el mismo tratamiento visual (amber) que ya usa la advertencia de staleness de zonificación.

**Warning signs:**
Cualquier `catch` en el código de isócrona que retorne una geometría sin un campo de estado/método acompañante; cualquier uso de `turf.circle()` sin un flag visible al llamador.

**Phase to address:**
Fase del motor de isócrona (la primera que se construya) — el tipo de retorno con el flag de degradación debe existir antes de que cualquier consumidor (demografía, competencia) se construya encima; agregarlo después implica tocar todos los consumidores retroactivamente.

---

### Pitfall 3: Roster de competencia incompleto interpretado como "no hay competencia" (falso negativo con etiqueta positiva)

**What goes wrong:**
`data-sources.yaml` ya documenta la brecha real: la nómina SII cubre bien Falabella/Cencosud/Walmart, cubre **parcialmente** SMU (Alvi + Super10) y **Unimarc — la marca líder del segmento minimarket/supermercado de descuento, la mayoría de las ~300 tiendas de SMU — no tiene RUT resuelto**, por decisión explícita de la founder de no seguir invirtiendo tiempo en buscarlo. Si el motor de cabida traduce `competidoresEnRadio.length === 0` directamente en "cabida: sí" para el formato minimarket/supermercado, el veredicto quedará sistemáticamente sesgado hacia falsos positivos justo en el formato donde el dato es más débil — el peor lugar posible para ese sesgo, porque un usuario de negocio confía más en un "sí, hay demanda" que en un "no". Es el mismo tipo de error que el patrón #5 de la auditoría de seguridad ya documentado para este repo (fallback de IA que retorna un resultado plausible en vez de un error honesto): ausencia de evidencia sobre Unimarc no es evidencia de ausencia.

**Why it happens:**
Es la implementación más simple y "obvia" del cruce (contar filas de competencia dentro del polígono) — nada en el dato en sí mismo indica que falta una marca completa; esa información vive solo en `data-sources.yaml`/memoria del equipo, no en la tabla de competidores.

**How to avoid:**
- Mantener un registro explícito, legible por el motor, de "cobertura conocida" por cadena/formato (extensión natural de `CADENAS_RUT_CONOCIDOS`).
- El motor de veredicto debe ser consciente del formato: para minimarket/supermercado, dado que Unimarc está fuera del roster, **topear la confianza en BAJA** y mostrar una línea de disclosure explícita ("Unimarc no está en el roster de competencia — cobertura de minimarket/supermercado de descuento es parcial") independientemente de cuántos otros competidores se encontraron.
- Nunca dejar que "0 competidores encontrados" por sí solo dispare un "sí"; exigir corroboración con al menos una señal independiente (ej. conteo de anchors OSM de `lib/terrenos-ubicacion.ts`) antes de alcanzar confianza ALTA.

**Warning signs:**
Cualquier código que mapee `count === 0` directo a un veredicto positivo sin pasar antes por un gate de cobertura/confianza.

**Phase to address:**
Fase de diseño del veredicto/scoring — el campo de "cobertura conocida" por formato debe ser parte del modelo de datos desde el día 1; también debe decidirse explícitamente en Requirements si "minimarket" entra al v1.7 como formato de confianza reducida por defecto.

---

### Pitfall 4: Doble conteo de población cuando se solapan isócronas de sucursales de la misma cadena (auto-canibalización invisible)

**What goes wrong:**
Al evaluar "¿hay demanda para una nueva sucursal aquí?", la población/gasto potencial de la isócrona no es exclusiva de la nueva tienda si sucursales existentes de la **misma cadena** (u otras) ya sirven parte de esa misma área. La literatura de trade-area analysis documenta esto como cannibalización: el solape de áreas de influencia no es visible en un mapa simple y sin datos de origen real de clientes (que PermisoHub no tiene, presupuesto cero) solo se puede aproximar geométricamente. El riesgo concreto es doble: (a) si se **suman** poblaciones de isócronas de distintas sucursales sin unir geométricamente los polígonos primero, se cuenta dos veces a la gente que vive en el área común; (b) si se presenta la demanda de la isócrona nueva sin mencionar que hay sucursales de la misma cadena a poca distancia, el veredicto implica que toda esa demanda está disponible para el sitio nuevo, ignorando la canibalización.

**Why it happens:**
Es fácil tratar cada isócrona como un cálculo aislado (una consulta por ubicación) sin pensar en el caso de dos consultas relacionadas (dos sucursales cercanas de la misma cadena, o comparación de varias oportunidades a la vez) — el bug no aparece en el caso de una sola ubicación aislada, solo cuando se agregan o comparan varias.

**How to avoid:**
- Unir (no sumar) geometrías de isócronas antes de calcular población/demanda agregada cuando se combinan varias ubicaciones.
- Listar explícitamente sucursales de la **misma cadena** dentro de la isócrona (ya disponible vía nómina SII) con una nota tipo "N sucursales de la misma cadena dentro de X min — la demanda mostrada no descuenta canibalización, es indicativa", en vez de presentar el número como si ya la descontara.

**Warning signs:**
Cualquier `sum()` sobre poblaciones derivadas de múltiples isócronas sin un paso previo de unión/deduplicación geométrica; cualquier lista de competencia que no distinga visualmente sucursales de la misma marca de competidores reales.

**Phase to address:**
Fase de agregación demográfica (cuando se combinan más de una isócrona), verificado de nuevo en la fase de veredicto (el texto de disclosure debe efectivamente renderizarse, no solo existir en el cálculo).

---

### Pitfall 5: Formato de competidor inferido solo por nombre de marca, presentado como clasificación objetiva

**What goes wrong:**
La nómina SII trae razón social + dirección, no metros cuadrados de sala de venta ni formato real de tienda. No existe siquiera un estándar único públicamente verificable en Chile para el corte minimarket/supermercado/hipermercado (las referencias sectoriales encontradas son dispersas: ~3.000 m² / ~6.000 m² como cortes de industria, no una norma oficial única). Si el motor clasifica "Walmart Express = minimarket" por una tabla hardcodeada marca→formato (extensión natural de `CADENAS_RUT_CONOCIDOS`), sin dato real de superficie por local, el resultado se presenta como un hecho geoespacial verificado cuando en realidad es una heurística de nomenclatura. Una sucursal atípica (Express grande, local que cambió de formato) queda mal clasificada silenciosamente, contaminando justo la unidad central del veredicto pedido: "señal de cabida **por formato**".

**Why it happens:**
Es la ruta de menor esfuerzo: reusar el patrón ya aceptado de marca→dato fijo (igual que RUT→razón social) sin verificar que aquí el dato que se está fijando (formato/tamaño) es mucho menos estable por marca que el RUT.

**How to avoid:**
- Documentar la tabla marca→formato explícitamente como heurística, con un campo `formatoInferido: boolean`/`formatoFuente` visible junto a cada competidor en el dato y en la UI ("formato inferido por marca, no verificado por superficie real").
- Si se cruza contra tags de OSM (`shop=supermarket`, `shop=convenience`) vía Overpass, tratar el acuerdo/desacuerdo entre la heurística SII y el tag OSM como señal de confianza adicional, no elegir uno silenciosamente cuando difieren.

**Warning signs:**
Un objeto de competidor con campo `formato` pero sin `formatoFuente`/`formatoInferido` acompañante.

**Phase to address:**
Fase de modelo de datos de competencia — el campo de procedencia debe existir en la primera migración, no agregarse después de que la UI ya muestre el formato como un hecho.

---

### Pitfall 6: El veredicto interno de 3 estados + confianza se colapsa a un binario "sí/no" a nivel de UI/copy

**What goes wrong:**
El proyecto ya tiene una disciplina explícita y consistente en todo el código (`veredicto: 'sin_limite'|...` en `cuadros-calculo.ts`, `'sin_dato'` en `propiedades-portafolio-server.ts`, compatibilidad de uso IA de 3 estados) y el propio milestone lo reafirma: "Señal de cabida por formato — nunca binaria sin evidencia, con nivel de confianza". El riesgo no está en el cálculo (que naturalmente produce 3 estados + confianza) sino en el momento de escribir el copy/UI: bajo presión de "solo dime si construyo aquí", es fácil que un headline, un badge de color, o un resumen ejecutivo generado por IA termine diciendo "Hay demanda" sin la calificación de confianza en la misma oración — exactamente el tipo de error que no aparece en revisión de lógica (el cálculo interno sigue siendo correcto) sino en revisión de copy, que normalmente no se audita con el mismo rigor.

**Why it happens:**
La compresión ocurre en un lugar distinto al del cálculo — pasa en el componente de presentación o en el prompt del resumen ejecutivo IA, no en `lib/`, por lo que un code-reviewer enfocado en lógica de negocio puede no detectarlo.

**How to avoid:**
- Forzar a nivel de tipos que el veredicto y la confianza se rendericen **juntos** en todo punto de la UI mediante un único componente compartido (ej. `<VeredictoCabidaBadge veredicto confianza fuentes />`), nunca un string suelto interpolado en un headline — mismo patrón que el badge "Estimado"/"Dato verificado" que `TabEstimacion` y Reportes de Mercado ya usan.
- Si el feature usa un resumen ejecutivo IA (`streamConContexto`, como Oportunidades v1.6), el prompt debe prohibir explícitamente afirmar "sí hay cabida" sin el calificador de confianza en la misma oración, verificado con un test de regresión sobre un fixture de confianza baja.

**Warning signs:**
Cualquier string hardcodeado tipo `'Hay demanda'`/`'Sí, hay cabida'` no acompañado inmediatamente del render de confianza.

**Phase to address:**
Fase de veredicto/UI — y verificado explícitamente en la práctica ya establecida de "code-review pass por módulo" antes de dar por cerrado el milestone (mismo patrón que las auditorías Jun–Ago 2026 de este repo).

---

### Pitfall 7: Mezclar vintages censales (Censo 2017 detallado vs. Censo 2024 solo totales) sin declarar la mezcla

**What goes wrong:**
El Censo 2024 ya publicó totales de personas/hogares/viviendas por comuna (marzo 2026), pero a la fecha de esta investigación no hay evidencia de que haya publicado el detalle equivalente al REDATAM 2017 a nivel de zona censal (el calendario 2026 cubre migración, vivienda y características poblacionales por comuna, no necesariamente el paquete geo-detallado). Si el motor escala una estructura etaria/de hogares 2017 (más antigua, con detalle de zona censal) usando el total poblacional 2024 (más fresco, solo comunal) sin declarar la combinación, el número final aparenta ser "el dato censal actual" pero es en realidad un híbrido de dos vintages — cada pieza es correcta por separado, pero la unión no está documentada. Es análogo (aunque distinto) a los bugs de unión silenciosa ya encontrados en este repo (mojibake, timezone): cada componente pasa su propia verificación, el problema aparece solo en el cruce.

**Why it happens:**
Es tentador usar "el dato más nuevo disponible" para cada variable individualmente sin notar que las variables provienen de publicaciones con cobertura geográfica distinta.

**How to avoid:**
- Cada cifra demográfica debe llevar su propio campo `censoAño`/`fuenteVintage` visible en la UI (mismo patrón que `fuente_actualizada_el` en zonificación).
- Si el motor combina vintages, esa combinación debe declararse explícitamente en el texto ("estructura etaria Censo 2017, escalada a población total Censo 2024") en vez de presentarse como una sola fuente homogénea.
- Decidir en Requirements qué vintage es canónico por tipo de dato, evitando mezclas ad-hoc salvo que estén justificadas y declaradas.

**Warning signs:**
Cualquier cifra demográfica en la UI sin año/fuente visible.

**Phase to address:**
Antes de cerrar Requirements (selección de fuente) + fase de modelo de datos (el schema necesita el campo de vintage).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Buffer circular (Turf) en vez de motor de ruteo real | Cero costo, cero infraestructura, rápido | Hasta 80% de error en área de captura real (evidencia citada); sesga sistemáticamente competencia y demografía | Solo como fallback **declarado** (Pitfall 2), nunca como método primario silencioso |
| Promedio EPF nacional/macrozona aplicado a toda comuna/isócrona | Única fuente pública de gasto disponible sin pagar | Número que parece medido pero es un promedio no representativo a ese nivel geográfico, reetiquetado | Solo etiquetado explícitamente "proxy nacional", nunca como "gasto local medido" |
| Clasificar formato de competidor por nombre de marca (tabla hardcodeada) | Rápido, reusa `CADENAS_RUT_CONOCIDOS` ya existente | Sucursales atípicas mal clasificadas silenciosamente, sesga el conteo "por formato" (unidad central del veredicto) | Como heurística declarada con flag de baja confianza; nunca como dato duro |
| Cachear isócrona indefinidamente sin versionar por parámetros (radio, modo) | Evita recalcular algo costoso/rate-limited | Dos consultas del mismo lugar en momentos distintos, con parámetros distintos, devuelven resultados inconsistentes sin que el usuario lo note | TTL corto + parámetros incluidos en la clave de caché; nunca caché sin versión de parámetros |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Overpass API (OSM) — ya usado en `lib/terrenos-ubicacion.ts` con throttle de 5s/req y solo 2 slots/IP | Asumir que ese mismo throttle (pensado para un solo llamador) alcanza cuando Cabida Comercial agrega un segundo consumidor (conteo de anchors dentro de la isócrona) compitiendo por el mismo recurso compartido | Centralizar el rate-limiter de Overpass en un solo módulo compartido antes de agregar un segundo llamador, no duplicar `lastRequestAt` por archivo |
| SII nómina de sucursales — `freshness_sla_days: 45`, actualización mensual | Tratar el snapshot de competidores como "en vivo" en el veredicto, sin mostrar la fecha del último scrape — un local cerrado hace 2 meses sigue contando como competencia activa | Propagar la fecha de último scraper (mismo patrón `fuente_actualizada_el`) y mostrarla junto al conteo de competencia |
| Nominatim/geocoding — mismo proveedor OSM sin SLA, ya usado por zonificación/terrenos | Re-geocodificar la dirección de la oportunidad para el centro de la isócrona en vez de reusar la lat/lng ya persistida y validada, arriesgando drift de coordenadas entre módulos (ya fue un hallazgo real: A8/A9 de la auditoría 2026-07-30) | Reusar coordenadas ya resueltas del proyecto/oportunidad, no volver a geocodificar |
| INE ArcGIS — mismo publicador de `ine-permisos-edificacion` (ya integrado y verificado en vivo), pero Censo es un producto distinto | Asumir por analogía que el Censo se expone con la misma facilidad/licencia solo porque es el mismo publicador ("cuenta publicaciones_geodatos") | Repetir el mismo protocolo de verificación en vivo (curl real, no solo documentación) que se usó para `ine-permisos-edificacion`, no asumir |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Isócrona calculada on-demand (Overpass/red vial) en cada vista del tab | Latencia alta, 429 sostenido en picos de uso concurrente | Cachear isócrona por (lat/lng redondeado, radio, modo) con TTL, misma disciplina que `zonificacion_cache` | Con solo 2 vistas/minuto concurrentes contra el mismo recurso gratuito compartido (ya documentado: 2 slots/IP en Overpass) |
| Demografía + competencia + isócrona cargadas síncronamente en el fetch inicial de la ficha de oportunidad | La página de detalle se vuelve lenta apenas se agrega el tab Cabida Comercial, incluso para usuarios que no lo abren | Cargar el tab bajo demanda (al hacer clic), siguiendo el patrón ya usado para otros tabs pesados de la ficha | Cualquier volumen — es un problema de diseño, no de escala |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exponer ubicación/conteo exacto de sucursales de una cadena específica vía un endpoint público sin autenticación | Scraping trivial del análisis competitivo por terceros, o uso indebido para vigilancia comercial de un competidor puntual sin contexto | Mismo gate de auth/RLS workspace-scoped que el resto de Mercado Inmobiliario; no exponer un endpoint "standalone por dirección" público antes de que el milestone futuro mencionado en `PROJECT.md` lo decida explícitamente |
| Aceptar parámetros de radio/modo de isócrona sin validar rango en el servidor | Un radio absurdo dispara un query Overpass/DB masivo — DoS accidental sobre un recurso compartido con cuota ya ajustada | Clamp server-side de radio/tiempo máximo, misma disciplina que ya existe en timeouts de otros scrapers |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Mapa con isócrona y competidores sin leyenda de qué representa cada color/ícono ni fecha de los datos | El usuario interpreta el mapa como "verdad actual" sin poder juzgar antigüedad ni confianza | Leyenda + fecha de fuente siempre visible, igual que zonificación ya hace con `fuente_actualizada_el` |
| Confianza mostrada como número aislado (ej. "62%") sin explicar qué la baja | El usuario no sabe si confiar, ni qué falta para que suba | Desglosar la confianza en sus componentes (cobertura de competencia, calidad de isócrona, vintage del dato demográfico), igual que otros scores compuestos de la app (Auditor, Predictor) |
| Botón "recalcular con radio en auto" sin dejar claro que auto ≠ caminata y cambia completamente el área/resultado | El usuario compara dos corridas con modos de transporte distintos creyendo que es la misma métrica | Modo de transporte siempre visible junto al resultado, no solo en el selector de entrada |

## "Looks Done But Isn't" Checklist

- [ ] **Veredicto de cabida:** ¿la confianza se muestra junto al veredicto en TODOS los puntos donde aparece (tab, resumen ejecutivo IA, comparación, informe exportable)? — verificar que no se "pierde" en el informe imprimible, como ya pasó con otros KPIs en módulos previos.
- [ ] **Isócrona:** ¿el caso "cayó a círculo equivalente" se probó y se muestra en un caso real, no solo en el happy path de red vial disponible?
- [ ] **Competencia por formato:** ¿el conteo indica explícitamente qué cadenas quedan fuera del roster conocido (Unimarc) para ese formato?
- [ ] **Demografía:** ¿cada cifra tiene año/fuente/nivel geográfico visible, o se muestra "solo el número"?
- [ ] **Solape de isócronas:** ¿se probó con un caso real de dos sucursales cercanas de la misma cadena (ej. dos locales a <1 km) para confirmar que la población no se duplica?
- [ ] **Prompt del resumen ejecutivo IA (si aplica):** ¿existe al menos un test que confirme que un caso de confianza BAJA no genera una afirmación sin calificar ("sí hay cabida")?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| 1 — Desagregación fabricada de Censo/EPF | MEDIUM | Auditar todas las cifras demográficas mostradas; agregar retroactivamente el flag de vintage/nivel-geográfico; re-etiquetar UI sin rehacer el cálculo si la interpolación de área en sí era razonable y solo faltaba declararla |
| 2 — Círculo silencioso | LOW | Agregar el campo `metodo` al tipo de retorno existente + backfill del warning en UI; no requiere recalcular datos guardados si la isócrona se puede reconstruir |
| 3 — Roster incompleto leído como negativo | LOW | Agregar cap de confianza por formato con roster gap conocido; cambio de lógica de scoring, no requiere nueva fuente de datos |
| 6 — Binario en UI/copy | LOW-MEDIUM | Reemplazar strings hardcodeadas por el componente compartido de veredicto+confianza; agregar test de regresión sobre el prompt IA |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1 — Desagregación fabricada Censo/EPF | Antes de Requirements (selección de fuente/granularidad por tipo de dato) + fase de modelo de datos | Toda cifra demográfica en la UI tiene año/fuente/nivel geográfico visible; ninguna cifra de gasto CLP por isócrona sin flag de proxy |
| 2 — Círculo silencioso | Fase del motor de isócrona (primera que se construya) | Existe un caso de prueba real donde Overpass/routing falla y la UI muestra el aviso de degradación |
| 3 — Roster incompleto como negativo | Fase de diseño del veredicto/scoring + decisión explícita en Requirements | Un caso de prueba con 0 competidores en formato minimarket produce confianza BAJA, no un "sí" limpio |
| 4 — Doble conteo por solape de isócronas | Fase de agregación demográfica + fase de veredicto | Caso de prueba con dos ubicaciones de la misma cadena cercanas no duplica población agregada |
| 5 — Formato inferido sin dato real | Fase de modelo de datos de competencia | Todo competidor con `formato` tiene `formatoFuente`/`formatoInferido` acompañante |
| 6 — Binario en UI/copy | Fase de veredicto/UI + code-review pass del módulo | Grep de strings de veredicto hardcodeadas sin confianza da cero resultados; test de prompt IA pasa |
| 7 — Mezcla de vintages censales | Antes de Requirements (selección de fuente) + fase de modelo de datos | Toda cifra demográfica tiene `censoAño` visible; combinaciones de vintage están declaradas en texto cuando existen |

## Sources

- `data-sources.yaml` (PermisoHub) — cobertura real y limitaciones documentadas de `sii-nomina-sucursales` (Unimarc sin RUT resuelto, "vigente" ≠ tienda abierta) y `ine-permisos-edificacion`.
- `.planning/PROJECT.md` (PermisoHub) — definición del milestone v1.7 Cabida Comercial, decisión de alcance de la founder (isócrona vs. comuna) y disciplina de veredicto no-binario.
- `.planning/AUDIT-FIDELIDAD-DATOS-2026-07-30.md` (PermisoHub) — patrones reales de fabricación/degradación silenciosa ya encontrados y corregidos en este repo (fallback plausible de IA, staleness sin señal, drift snapshot vs. caché).
- Memoria de auditoría de seguridad PermisoHub (Jun–Ago 2026) — patrón recurrente #5 "AI fabrication on parse failure", base directa del Pitfall 3.
- `lib/terrenos-ubicacion.ts` (PermisoHub) — patrón ya establecido de `OverpassUnavailableError` y throttle de Overpass, referencia directa para Pitfall 2 e Integration Gotchas.
- INE — [Manual de usuario Censo 2017 REDATAM](https://redatam-ine.ine.cl/manuales/Manual-Usuario.pdf); [Microdatos Censo 2017: Manzana](https://geoine-ine-chile.opendata.arcgis.com/datasets/54e0c40680054efaabeb9d53b09e1e7a_0) — nivel de detalle real publicado (zona-localidad en REDATAM principal; manzana solo con totales básicos).
- IHSN/INE — catálogos y presentación de resultados VIII EPF ([catalog.ihsn.org](https://catalog.ihsn.org/index.php/catalog/7650), [presentación director nacional VIII EPF](https://www.ine.gob.cl/docs/default-source/encuesta-de-presupuestos-familiares/publicaciones-y-anuarios/viii-epf---(julio-2016---junio-2017)/presentacion-del-director-nacional-sobre-resultados-viii-epf.pdf)) — representatividad de la EPF limitada a capitales regionales/Gran Santiago, no representativa a nivel comunal ni mensual.
- INE — [Censo 2024, primeros resultados y cronograma de publicación](https://www.ine.gob.cl/sala-de-prensa/prensa/general/noticia/2025/03/27/primeros-resultados-del-censo-2024-18.480.432-personas-fueron-censadas-en-chile-manteni%C3%A9ndose-la-tendencia-de-envejecimiento-de-la-poblaci%C3%B3n), [cronograma de resultados](https://censo2024.ine.gob.cl/cronograma-de-resultados/) — base del Pitfall 7 (mezcla de vintages).
- Population Explorer — [Using Isochrones for Catchments: Beyond Simple Buffers](https://www.populationexplorer.com/knowledge-base/using-isochrones) — evidencia del error de hasta 80% de buffers circulares vs. isócronas de red vial.
- Stadia Maps / Radar / Mapular — guías técnicas de isócronas y mode mismatch (caminata vs. auto) en redes viales.
- GrowthFactor / PassBy / Felt — cannibalization analysis en retail (overlap de trade areas, dependencia de datos de origen de clientes que este proyecto no tiene).
- Búsqueda de clasificación de formatos de supermercado en Chile — sin estándar público único (ACHS/INE) encontrado; solo referencias sectoriales dispersas de corte por m² — base del Pitfall 5.

---
*Pitfalls research for: Cabida Comercial (v1.7) — PermisoHub*
*Researched: 2026-08-02*
