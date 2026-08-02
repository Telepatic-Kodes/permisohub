# Pitfalls Research

**Domain:** Agregar dashboard de detalle, comparación lado a lado, e informe exportable sobre datos de scraping ya existentes (`mercado_locales_listings` / `oportunidades`) en un módulo PermisoHub con historial reciente de bugs de fabricación de datos, timezone y comparaciones no normalizadas
**Researched:** 2026-08-02
**Confidence:** MEDIUM-HIGH — los pitfalls de integración con el sistema real (P25/muestra chica, tipos/operaciones heterogéneas, snapshot vs. vivo, timezone) están verificados directamente contra el código actual (`lib/mercado-locales-server.ts`, `lib/informe-pdf.ts`, `lib/informe-charts.ts`, `lib/tasacion-prompts.ts`, migraciones, `data-sources.yaml`, auditoría 2026-07-30) — HIGH confidence. Los pitfalls genéricos de export recharts→PDF (resolución, corte de página) están verificados con fuentes externas (GitHub issues de html2canvas/recharts, artículos técnicos) — MEDIUM confidence, patrón ampliamente documentado pero no específico de esta stack exacta.

## Critical Pitfalls

### Pitfall 1: El "benchmark de mercado" del dashboard de detalle se calcula sobre una muestra circular o insuficiente, en vez de reusar `mercado_locales_stats_diarias`

**What goes wrong:**
El dashboard de detalle de una oportunidad va a querer mostrar algo como "18% bajo el promedio de su comuna". Hay dos formas fáciles y ambas incorrectas de construir ese número sin darse cuenta: (a) promediar sobre las otras "oportunidades" que aparecen en la misma lista/página — pero esa lista **ya está filtrada a solo lo que está bajo el P25 o bajó de precio** (`reasonCodes.length > 0` es la condición de inclusión en `obtenerOportunidadesMercadoLocales`), así que promediar sobre ella es circular: por construcción, todo lo que queda ahí es barato, y el "insight" seria estadísticamente vacío ("está bajo el promedio... de un grupo pre-filtrado para estar bajo el promedio"); (b) calcular un promedio/mediana ad-hoc en el momento, sobre lo que sea que el detalle traiga a mano (ej. 2-5 listings de la misma comuna cargados para el layout), sin aplicar el mismo piso de `MIN_COHORT_SIZE = 15` que ya protege el cálculo de bandas real.

**Why it happens:**
El sistema YA resolvió este problema correctamente para el propósito de "detectar oportunidades" (`calcular_bandas_mercado_locales` RPC + `mercado_locales_stats_diarias` con `muestra_n`/`muestra_area_n` y fallback a rollup `__TODAS__` bajo el umbral de 15 — ver `lib/mercado-locales-server.ts:58-61,113-171`). Pero ese cálculo vive en una tabla de stats *diaria por cohorte*, no en el objeto `OportunidadMercadoLocal` que llega a la UI hoy (que solo expone `precioUfNormalizado`/`precioUfM2Normalizado`/`reasonCodes`, sin `muestra_n`). Al construir el dashboard de detalle, es más rápido escribir un `oportunidades.filter(...).reduce(...)` nuevo sobre lo que ya está en la página que ir a buscar la fila de stats correcta — y ese atajo reintroduce exactamente el problema de "N=1/N=2 presentado como benchmark confiable" que el milestone pide evitar.

**How to avoid:**
- El dashboard de detalle debe leer la fila de `mercado_locales_stats_diarias` (misma `comuna` + `tipo_propiedad` + `operacion` + fecha de hoy) — no recalcular nada. Extender `OportunidadMercadoLocal` (o el fetch del detalle) para traer `muestra_n`, `p25_uf`/`p25_uf_m2`, `mediana_uf`/`mediana_uf_m2` de esa tabla ya persistida.
- Si `muestra_n < MIN_COHORT_SIZE` (15) para la comuna, el benchmark debe mostrarse explícitamente contra el rollup `__TODAS__` (citywide) con la etiqueta "comparado con el mercado nacional de {tipo}, no con {comuna} — muestra insuficiente en la comuna (N={muestra_n})", exactamente el patrón tres-estados que zonificación ya usa para "sin cobertura" — nunca mostrar un número sin decir contra qué universo se comparó.
- Nunca promediar sobre el propio set de "oportunidades" mostradas (sesgo de selección circular) — ese set es un resultado, no un universo de comparación.

**Warning signs:**
Grep por cualquier `.reduce(...)` o `.filter(...).map(...)` que compute un promedio/mediana de precio dentro de un componente de detalle/comparación en vez de leer `mercado_locales_stats_diarias` — es la señal de que se reimplementó el cálculo de bandas fuera de su única fuente de verdad.

**Phase to address:**
Fase de Detalle (el contrato de datos del detalle debe incluir `muestra_n` desde el día 1, no como parche posterior) — la fase de Comparación hereda este mismo contrato, no debe reinventarlo.

---

### Pitfall 2: La comparación lado a lado permite poner en la misma tabla propiedades de tipo u operación distintos, con columnas que no significan lo mismo

**What goes wrong:**
`OportunidadMercadoLocal` viene de un universo que ya mezcla 4 `TipoPropiedadComercial` (`local_comercial`, `oficina`, `bodega`, `industrial`) × 2 `OperacionMercadoLocal` (`arriendo`, `venta`). La página actual filtra a **un** tipo y **una** operación por vista (`tipoPropiedad`/`operacion` en `searchParams`), lo cual ya evita el problema en la lista — pero un "seleccionar para comparar" (checkbox por card, guardado en estado/URL/localStorage) es trivialmente construible para que sobreviva a un cambio de filtro: el usuario marca 2 locales en `arriendo`, cambia el filtro a `venta`/`oficina`, marca 1 más, y llega a `/comparar` con 3 ítems de tipo y operación distintos en la misma tabla. `precioUfNormalizado` para arriendo es un flujo mensual y para venta es un stock — dividirlos, promediarlos o ponerlos en el mismo eje de un gráfico produce un número sin sentido económico, y nada en el tipo `OportunidadMercadoLocal` lo impide (no hay un campo que el comparador pueda usar para rechazar la combinación).

**Why it happens:**
El estado de "seleccionados para comparar" es nuevo — no existe hoy ningún guard que lo valide, porque hoy no existe ningún flujo que junte ítems de vistas distintas. Es fácil construir el selector de comparación como "una lista de IDs" sin validar que todos compartan `operacion`+`tipoPropiedad`, porque técnicamente el fetch por ID individual no lo requiere.

**How to avoid:**
- El estado de selección para comparar debe ser `{ operacion, tipoPropiedad, ids: string[] }`, no solo `ids: string[]` — y el UI de selección debe deshabilitar (no solo advertir) el checkbox de un ítem cuyo `operacion`/`tipoPropiedad` no coincida con la selección ya en curso, igual que un carrito de compra no deja mezclar monedas distintas sin conversión.
- Si el negocio sí quiere permitir comparar, por ejemplo, arriendo vs. venta del mismo tipo de propiedad (caso legítimo: "¿me conviene arrendar o comprar este local?"), eso es una *decisión de producto explícita* con su propia UI (columna de "yield/cap rate implícito" que normaliza ambos a un mismo eje anualizado) — no el resultado accidental de permitir cualquier combinación en la misma tabla sin decirlo.
- Todo renderer de "insight" derivado (ej. "el más barato es X") debe verificar `new Set(items.map(i => i.operacion)).size === 1 && new Set(items.map(i => i.tipoPropiedad)).size === 1` antes de emitir cualquier conclusión comparativa — si no, mostrar cada ítem por separado sin ranking cruzado.

**Warning signs:**
Cualquier componente de comparación que acepte `OportunidadMercadoLocal[]` sin un tipo que garantice homogeneidad de `operacion`/`tipoPropiedad` en tiempo de compilación (ej. un tipo `ComparacionHomogenea` con esos dos campos a nivel de grupo, no por ítem) es una señal de que la validación, si existe, es solo un `if` en runtime fácil de saltarse desde otra ruta de entrada.

**Phase to address:**
Fase de Comparación — este es exactamente el pitfall que el milestone pidió anticipar antes de construir, no descubrir después. No aplica a la fase de Detalle (un solo ítem no puede mezclarse consigo mismo).

---

### Pitfall 3: El informe exportado es un snapshot que envejece de forma invisible — mismo patrón A8 ya encontrado en zonificación, ahora en precios de scraping con SLA de 1-8 días

**What goes wrong:**
La auditoría de fidelidad de datos (2026-07-30) ya encontró y corrigió este patrón exacto para zonificación (hallazgo A8: "Drift snapshot `zona_*` vs. caché compartida en la misma tarjeta"). El informe exportable de oportunidades es la misma clase de bug con un origen de datos distinto: `mercado_locales_listings` se refresca a diario (`freshness_sla_days: 1`) pero listings específicos pueden llevar más tiempo sin verificación real de que la propiedad sigue disponible/al mismo precio (el scraper hace upsert, no confirma disponibilidad activa fuera de su corrida), y comparar dos oportunidades de fuentes con SLA distinto (locales comerciales SLA=1 día vs. terrenos SLA=8 días si el informe llega a mezclar ambos universos) hace que "generado hoy" no signifique lo mismo para cada fila. Un arquitecto/inversionista que imprime o guarda el PDF y lo revisa 2 semanas después (uso real esperado de un informe: se comparte con un socio, se lleva a una reunión) no tiene ninguna señal en el documento de que el precio pudo cambiar o la propiedad pudo salir del mercado — a diferencia de la vista en vivo, que siempre refleja el último scrape.

**Why it happens:**
Un informe "para llevar" se construye naturalmente copiando los valores ya calculados al momento de export, porque es lo simple y correcto para ese instante — el bug no es el snapshot en sí (es inevitable e incluso deseable que un PDF sea estático), es la ausencia de metadata de vigencia *dentro* del documento exportado, que es precisamente lo que lo distingue de un simple "imprimir pantalla".

**How to avoid:**
- Cada informe debe incluir, de forma visible (no en letra chica al pie) el timestamp exacto de generación en hora de Chile (America/Santiago) y — por cada oportunidad incluida — la fecha del último scrape real de esa fila (`updated_at`/`precio_actualizado_el` si existe, o el timestamp del scraper), igual que ya hace `informe-pdf.ts` con `formatGeneradoEl` para el due diligence.
- Incluir una nota estándar tipo "Precios verificados por última vez el {fecha}. Los datos de mercado se actualizan diariamente; un precio o disponibilidad puede haber cambiado desde entonces. Vuelve a `/mercado-inmobiliario/oportunidades` para la versión vigente." — mismo espíritu que el disclaimer "orientativo" que `via-tramitacion.ts` ya usa en otro módulo.
- Si el informe combina ítems con SLA de frescura distinto (ej. locales + terrenos, si el scope llega a incluir ambos), declarar el SLA de cada fuente por fila, no una fecha única para todo el documento — un promedio de "última actualización" entre fuentes con cadencia distinta esconde la fila más vieja.
- No recalcular UF/precios en el momento de exportar con un valor de UF distinto al que el usuario vio en pantalla (ver Pitfall 6) — el snapshot debe congelar también los insumos de cálculo, no solo el resultado final.

**Warning signs:**
Cualquier ruta/función de export que solo tenga un timestamp global de "generado el" sin timestamp por fila cuando el informe mezcla varias propiedades — o que no incluya ningún timestamp en absoluto (el patrón por defecto si se copia el layout del reporte de cadenas en `app/api/cadenas/[id]/reporte/route.ts`, que hoy no muestra fecha de última actualización de los datos subyacentes, solo `fechaStr` de generación).

**Phase to address:**
Fase de Informe — pero el campo de "última verificación por fila" debe existir ya desde la Fase de Detalle (mostrarlo en pantalla primero, exportarlo después es solo reusar el mismo dato).

---

### Pitfall 4: Romper la disciplina existente de PDF vectorial al snapshotear gráficos recharts con html2canvas para el nuevo informe

**What goes wrong:**
El codebase tiene HOY dos generadores de PDF en producción — `lib/informe-pdf.ts` (jsPDF client-side) y `app/api/cadenas/[id]/reporte/route.ts` (pdfkit server-side) — y **ninguno de los dos rasteriza gráficos**: dibujan rectángulos, texto y tablas con primitivas vectoriales directamente en el PDF (`drawCuadroBlock`, las cajas de KPI del reporte de cadenas). La única rasterización que existe es de láminas de planos ya-imágenes (`burnLamina`/`pdfUrlToImages`), no de gráficos de datos. El nuevo informe de oportunidades va a querer mostrar el mismo histograma/comparación visual que ya existe en pantalla (`Histograma`, recharts) — y la ruta de menor esfuerzo para "que se vea igual que en pantalla" es `html2canvas` sobre el DOM del gráfico → `jsPDF.addImage`. Esto reintroduce exactamente los problemas que el resto del codebase ya evitó: resolución baja si no se especifica `scale` (2-3x) en html2canvas, gráficos cortados a mitad de barra en el salto de página porque el snapshot es una sola imagen rectangular sin conciencia de dónde cae el corte de página del PDF, y — específico de recharts — el `ResponsiveContainer` mide su tamaño por el contenedor DOM real; si el snapshot ocurre en un contenedor oculto/fuera de pantalla (patrón común para "renderizar para exportar sin que el usuario lo vea"), `ResponsiveContainer` puede medir 0×0 y producir un gráfico vacío en el PDF sin ningún error.

**Why it happens:**
Es la ruta visualmente más fiel al pixel y la más rápida de implementar para alguien que no conoce que el resto del proyecto ya resolvió esto de otra forma — nada en el nombre `Histograma`/`recharts` sugiere que exportarlo requiere un camino distinto al de mostrarlo en pantalla.

**How to avoid:**
- Para el informe de oportunidades, preferir seguir el patrón ya establecido: recalcular los mismos datos agregados (bins del histograma, valores de la comparación) y dibujarlos como primitivas vectoriales en jsPDF/pdfkit (rectángulos para barras, texto para ejes) — `binarValores()` en `histograma.tsx` ya está extraído como función pura sin JSX específicamente para poder reusarse fuera del componente React; es el candidato natural para alimentar una versión vectorial del mismo gráfico en el PDF.
- Si el equipo decide que sí vale la pena snapshotear recharts (p. ej. para un gráfico complejo que no vale la pena redibujar a mano), como mínimo: renderizar el gráfico en un contenedor visible con tamaño fijo en píxeles (no `ResponsiveContainer` sin dimensiones explícitas) antes de capturarlo, usar `html2canvas({ scale: 2 })` mínimo, y medir la altura real de la imagen resultante contra el espacio restante en la página actual del PDF *antes* de dibujarla — si no cabe, forzar salto de página primero, nunca dejar que la librería corte la imagen a la mitad.
- Probar el export imprimiendo el PDF real a A4 (no solo verificando en el visor del navegador a 100% zoom) — el zoom del visor esconde exactamente el problema de resolución que solo aparece impreso o a zoom alto, según lo reportado en la comunidad de html2canvas/recharts.

**Warning signs:**
Cualquier `import html2canvas` o `dom-to-image` nuevo en el árbol de `mercado-inmobiliario` es la señal de alerta más directa y grep-eable — hoy ese import no existe en absoluto en el proyecto (los dos PDF generators existentes no lo usan).

**Phase to address:**
Fase de Informe — pero la decisión de arquitectura (vectorial vs. snapshot) debe tomarse ANTES de escribir el primer gráfico del informe, no ajustarse después de ver que se ve mal impreso.

---

### Pitfall 5: Comparar/promediar cifras en bases distintas dentro de la misma tabla de comparación (UF vs. UF/m², total vs. por m², con datos faltantes silenciados)

**What goes wrong:**
`precioUfM2Normalizado` es `number | null` — es `null` cuando `superficieM2` falta (frecuente: el propio `data-sources.yaml` describe baches de calidad reales del scraping, y `superficieM2` es exactamente uno de los campos que puede faltar). Una tabla de comparación lado a lado que ordene "de más barato a más caro por m²" y trate el `null` como si fuera `0` (un bug de coerción común: `(a.precioUfM2Normalizado ?? 0) - (b.precioUfM2Normalizado ?? 0)`) pondría la propiedad SIN superficie conocida primera en el ranking, como si fuera gratis — el peor tipo de fabricación: no un valor inventado, sino un `null` tratado como el valor más favorable posible. Por separado, si la tabla muestra una columna "precio" sin distinguir visualmente si esa fila es UF total o UF/m², y el usuario ordena/lee de corrido, dos filas con "precio" superficialmente similar (una total, otra por m²) leen como comparables cuando no lo son.

**Why it happens:**
`?? 0` es el fallback más común y "silencioso" en JS/TS para evitar que `NaN` se propague en un `.sort()` o una suma — pero para un ranking de precio, 0 no es un fallback neutro, es el valor que gana cualquier comparación de "más barato".

**How to avoid:**
- Ordenar con los `null` siempre al final (o en su propia sección "sin superficie conocida — no comparable por m²"), nunca coercionados a un número: `.sort((a, b) => { if (a.x == null) return 1; if (b.x == null) return -1; return a.x - b.x })`.
- Cada columna de la tabla de comparación debe declarar su unidad en el header (`Precio total (UF)` vs. `Precio (UF/m²)`) y nunca combinarlas en una sola columna "Precio" ambigua.
- Cualquier fila con superficie faltante debe mostrar explícitamente "superficie no informada — no comparable por m²" en la celda, igual que el resto del proyecto usa "sin datos" en vez de fabricar (convención ya establecida en todo el codebase per las auditorías).

**Warning signs:**
Grep por `?? 0` o `|| 0` aplicado a cualquier campo `precioUfM2Normalizado`/`superficieM2`/similar dentro de lógica de `.sort()`, `.reduce()` o cálculo de promedio en los nuevos componentes de comparación/detalle.

**Phase to address:**
Fase de Comparación (es donde aparece el ranking multi-ítem) — la Fase de Detalle ya debe decidir cómo se muestra un solo `null` ("sin datos", nunca "0"), sentando el precedente que Comparación hereda.

---

### Pitfall 6: El "insight"/recomendación narrativa del informe recalcula números con una fuente distinta a la que el usuario vio en pantalla (UF, o comparables generados por IA en vez de los ya computados)

**What goes wrong:**
Dos formas concretas en que el número del informe puede no coincidir con el número que el usuario vio en el dashboard: (a) el valor de UF usado para convertir CLP↔UF se resuelve en momentos distintos — el listado usa el UF cacheado por `computarYPersistirBandasMercadoLocales`/`indicadores-macro` del día, pero si la ruta de export hace su propio fetch a `/api/utils/uf` en el momento de generar el PDF (patrón ya usado por 5 call sites distintos según `data-sources.yaml`), y el usuario exporta un día después de haber mirado la oportunidad, el UF del informe difiere del que vio en pantalla sin que nada lo señale; (b) si el informe agrega una narrativa/recomendación generada por IA (razonable para un "informe profesional" al estilo CBRE/JLL), existe un precedente **en este mismo proyecto** de pedirle a un LLM que genere su propia tabla de "comparables" en prosa vía búsqueda web (`lib/tasacion-prompts.ts`, feature de Tasación) — ese patrón es apropiado ahí porque no existe todavía una tabla de comparables reales para ese caso de uso (dixit el propio comentario del archivo), pero sería exactamente el error de fabricación que este proyecto ya corrigió 8+ veces si se reutiliza para oportunidades, donde SÍ existen comparables reales y verificados (`mercado_locales_stats_diarias`). Si el prompt del informe le pide a la IA "compara esta oportunidad con el mercado" sin pasarle el `muestra_n`/percentiles reales como contexto, el modelo puede inventar un rango de mercado plausible pero no anclado a los datos reales de PermisoHub.

**Why it happens:**
(a) es fácil de cometer porque "solo pedir el UF de nuevo" parece más simple que propagar el valor ya usado; (b) es fácil de cometer porque el patrón de "pedirle a la IA que compare y describa comparables" ya existe y funciona bien en Tasación — la tentación de copiarlo para Oportunidades es alta, pero ahí la IA haría de fuente primaria (vía IA) sobre un problema que ya tiene fuente primaria real (los scrapers + bandas).

**How to avoid:**
- El export debe recibir el UF y los valores ya calculados como parámetros desde la misma llamada/estado que renderizó el dashboard — nunca re-fetchear UF ni recalcular `precioUfNormalizado` de forma independiente en la ruta de export.
- Cualquier narrativa generada por IA en el informe debe recibir los números reales (`muestra_n`, P25/mediana/P75 de `mercado_locales_stats_diarias`, `precioUfM2Normalizado` de la oportunidad) como contexto explícito en el prompt y tener instrucción explícita de citarlos, no de re-derivarlos — siguiendo el patrón correcto que el propio proyecto ya usa en A6 ("ESTIMADA (datos sintéticos, no medidos)" declarado explícitamente en el prompt) en vez del patrón de Tasación (comparables vía búsqueda web libre), que es el patrón equivocado para este caso porque acá sí hay datos propios reales.
- Si la narrativa IA no tiene suficiente `muestra_n` para un benchmark confiable, el prompt debe instruir explícitamente "declara la limitación de muestra, no la ocultes" — mismo criterio que ya aplicó el Sprint 2 de la auditoría a los prompts de estimación de plazos.

**Warning signs:**
Cualquier prompt nuevo para el informe de oportunidades que le pida a la IA "compara" o "genera comparables" sin pasarle los números reales ya computados como contexto estructurado — o cualquier ruta de export que llame a `/api/utils/uf` o a `mindicador.cl` de forma independiente en vez de recibir el UF ya usado por el dashboard.

**Phase to address:**
Fase de Informe (si el informe incluye narrativa IA) — pero la propagación de UF/valores ya calculados debe diseñarse desde la Fase de Detalle, para que Comparación e Informe hereden el mismo dato sin recalcular cada uno por su cuenta.

---

### Pitfall 7: Reintroducir el bug de timezone (`new Date(iso)` vs. `new Date(\`${iso}T00:00:00\`)`) en el código nuevo de fechas de detalle/comparación/informe

**What goes wrong:**
El propio `oportunidades/page.tsx` ya tiene la forma correcta escrita (`formatFechaCorta`, línea 26-31, usa `new Date(\`${iso}T00:00:00\`)` + `timeZone: "America/Santiago"`), precisamente porque este bug ya ocurrió 5+ veces en el proyecto. El riesgo concreto para esta milestone es que el código NUEVO (dashboard de detalle, tabla de comparación con columna "última actualización", pie de página del informe con fecha) reintroduzca el patrón incorrecto en vez de reusar/importar la función ya correcta — especialmente si un desarrollador (o agente) escribe un formateador de fecha nuevo desde cero para un campo distinto (`precio_actualizado_el`, `ubicacion_consultada_el`, o cualquier fecha de scraping mostrada en el informe) sin darse cuenta de que ya existe un helper correcto en el mismo archivo/módulo.
Nota de precisión: `precio_actualizado_el` y `ubicacion_consultada_el` son `timestamptz` (ya incluyen hora), así que `new Date(iso)` es correcto para esos dos campos específicos — el bug aplica a cualquier campo `date`-only (solo `YYYY-MM-DD`, como `stats_date` de `mercado_locales_stats_diarias`, o cualquier fecha de "publicado el"/"listado desde" que el scraper solo capture a nivel de día) que se muestre en el nuevo detalle/comparación/informe.

**Why it happens:**
Cada nuevo componente que muestra una fecha es una nueva oportunidad de escribir `new Date(iso)` desde cero en vez de importar el helper existente — el bug no es conceptualmente difícil, es un lapso de copy-paste/reinvención que ya ocurrió 5 veces en este mismo proyecto según el contexto de la milestone.

**How to avoid:**
- Extraer `formatFechaCorta` (y cualquier otro formateador de fecha ya correcto en el módulo de mercado inmobiliario) a un helper compartido importable (ej. `lib/formato-fecha.ts` o similar) ANTES de escribir el primer componente nuevo de esta milestone, para que detalle/comparación/informe lo importen en vez de reescribirlo cada uno.
- Regla simple y verificable en code review: todo campo que sea `date` puro (sin hora) en el schema de Supabase se parsea con `${iso}T00:00:00`; todo campo `timestamptz` se parsea directo con `new Date(iso)` — documentar esta distinción una vez, no repetirla de memoria en cada PR.
- Test unitario mínimo: parsear una fecha límite conocida (ej. `2026-08-31`) y verificar que el mes formateado sea "agosto", no "julio" (el síntoma exacto del bug de corrimiento a UTC-3/-4).

**Warning signs:**
Grep por `new Date(` en cualquier archivo nuevo de esta milestone que reciba un string de un campo `date` de Supabase, sin el patrón `T00:00:00` inmediatamente al lado.

**Phase to address:**
Todas las fases (Detalle, Comparación, Informe) — mitigación única: extraer el helper compartido en la Fase de Detalle (la primera que toca fechas) para que las siguientes dos fases lo hereden por import, no por repetición.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Calcular el benchmark de comparación desde las oportunidades ya cargadas en la página, en vez de leer `mercado_locales_stats_diarias` | Cero queries nuevas, se reusa lo que ya está en memoria | Benchmark circular/con muestra chica presentado como confiable (Pitfall 1) | Nunca para el número mostrado al usuario; aceptable solo como placeholder visual en un mockup/demo interno, marcado explícitamente como tal |
| Snapshotear recharts con html2canvas para el primer borrador del informe | Se ve idéntico a la pantalla, rápido de prototipar | Reintroduce resolución/page-break issues que el resto del proyecto ya evitó (Pitfall 4); reescribir a vectorial después es más trabajo que hacerlo bien la primera vez | Aceptable solo para un prototipo interno de founder que nunca se imprime ni se comparte con un cliente |
| Permitir cualquier combinación de `tipoPropiedad`/`operacion` en el selector de comparación y validar solo en el render (no en el estado) | Selector más simple de construir | El bug de mezclar arriendo/venta o tipos distintos sobrevive a refactors futuros del render porque el estado no lo previene estructuralmente (Pitfall 2) | Nunca — el costo de tipar el estado correctamente desde el inicio es bajo comparado con el riesgo |
| Recalcular UF en la ruta de export en vez de recibirlo del caller | Ruta de export "autocontenida", no depende de props | Números del informe pueden no coincidir con lo que el usuario vio en pantalla (Pitfall 6) | Nunca para el valor mostrado como "precio de esta oportunidad"; aceptable únicamente para un campo explícitamente marcado "UF de referencia al momento de exportar" (que ya declare que es distinto) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| `mercado_locales_stats_diarias` (bandas P25/mediana/P75 por cohorte) | El dashboard de detalle/comparación no la consulta y recalcula su propio promedio ad-hoc sobre lo que tiene a mano | Extender el fetch del detalle para traer la fila de stats correspondiente (comuna+tipo+operación+fecha), incluyendo `muestra_n`, y gatear cualquier benchmark visible con el mismo umbral `MIN_COHORT_SIZE = 15` ya usado internamente |
| `OportunidadMercadoLocal` (tipo actual, sin `muestra_n`/timestamps de vigencia) | Asumir que el tipo actual ya trae todo lo necesario para detalle/comparación/export | Extender el tipo (o crear un tipo `OportunidadDetalle` que lo envuelva) con `muestra_n`, fecha de última actualización real del listing, y el UF usado en el cálculo — antes de construir las 3 features nuevas sobre el tipo actual |
| `lib/tasacion-prompts.ts` (patrón de comparables vía IA + búsqueda web) | Reusar este patrón para generar la narrativa del informe de oportunidades, porque "ya existe algo parecido" | No reusar — Oportunidades ya tiene comparables reales propios (scraping + bandas); cualquier narrativa IA debe recibirlos como contexto, no re-derivarlos vía búsqueda web como hace Tasación |
| `lib/informe-pdf.ts` / `app/api/cadenas/[id]/reporte/route.ts` (los dos generadores de PDF existentes, ambos vectoriales) | Copiar el layout pero introducir `html2canvas` para los gráficos nuevos de oportunidades, rompiendo la disciplina vectorial existente | Redibujar los gráficos (histograma, comparación) con las mismas primitivas jsPDF/pdfkit que ya usa el proyecto — reusar `binarValores()` de `histograma.tsx` como fuente de los bins |
| Scrapers de mercado (`freshness_sla_days: 1` locales, `8` terrenos) | Presentar todas las oportunidades del informe/comparación con la misma fecha de "vigente al" sin distinguir SLA por fuente | Timestamp de vigencia por fila, no uno global, si el informe llega a mezclar fuentes con SLA distinto |
| Campos `date`-only vs. `timestamptz` en Supabase (patrón de bug recurrente del proyecto) | `new Date(iso)` en un campo `date` puro nuevo (ej. si el informe muestra `stats_date` o una fecha de publicación del listing) | Reusar/extraer `formatFechaCorta` (`${iso}T00:00:00` + `timeZone: "America/Santiago"`), ya correcto en `oportunidades/page.tsx` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Comparación lado a lado hace un fetch/join por cada ítem seleccionado (N+1) contra `mercado_locales_listings` + `mercado_locales_stats_diarias` + señales de expansión/construcción | Página de comparación lenta al agregar el 3er/4to ítem | Un solo fetch batched por `ids[]` para los listings, y un fetch único por la combinación (comuna, tipo, operación) deduplicada para las stats — varias oportunidades de la misma comuna comparten la misma fila de stats, no hay que pedirla 2 veces | Notorio ya con 4-5 ítems si cada uno dispara sus propias 3-4 queries secuenciales |
| Generar el PDF completo (con imágenes rasterizadas si se usa html2canvas) de forma síncrona en la request del usuario | Timeout en export con muchos ítems comparados o gráficos pesados | Preferir generación client-side (como ya hace `informe-pdf.ts`) para no consumir tiempo de función serverless; si se mueve a servidor, usar el mismo patrón de `maxDuration` ya usado en rutas IA pesadas | Con informes de 5+ propiedades y gráficos por cada una |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Ruta de export de informe sin rate limit, alcanzable con solo un `id`/lista de `ids` en query string | Scraping masivo de datos de mercado curados de PermisoHub disfrazado de "exportar mi informe" (competidor automatiza la generación de PDFs para reconstruir el dataset) | Reusar `checkRateLimit` (ya usado en `cadenas/[id]/reporte` y `sii/lookup`) en la nueva ruta de export |
| Exponer en el informe exportado más filas/campos de los que el plan del usuario debería ver (ej. bandas de comunas fuera de su cobertura) | Fuga de valor comercial del dataset agregado hacia usuarios que no pagan por ese alcance | Aplicar el mismo feature-gating (`lib/plan-limits.ts`) al export que ya se aplica a la vista en pantalla — no asumir que "solo exportas lo que ya viste" sin verificarlo server-side |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Mostrar un "vs. mercado" en el detalle sin decir el tamaño de muestra ni contra qué universo (comuna vs. citywide) se comparó | El usuario toma una decisión de inversión sobre un número que parece confiable pero puede estar basado en 2-3 comparables | Mostrar siempre `muestra_n` y el universo exacto de comparación, con el mismo tratamiento de disclaimer que zonificación ya usa para "sin cobertura" |
| Tabla de comparación con celdas vacías silenciosas (blank) para superficie/precio-m² faltante | El usuario no distingue "vale poco" de "no tenemos el dato" | Celda explícita "sin dato" o "superficie no informada", nunca vacía ni con un placeholder que parezca un valor |
| Informe exportado sin fecha de vigencia visible en el cuerpo (solo en metadata del archivo, si acaso) | El usuario comparte un PDF desactualizado semanas después, actuando sobre un precio que ya cambió, sin saberlo | Fecha de generación Y de última verificación de cada fila, visible en el cuerpo del documento, no solo en el nombre del archivo |
| Gráfico de comparación que mezcla ejes UF y UF/m² sin etiqueta de unidad clara en cada serie | Lectura errónea de qué barra es "más cara" cuando en realidad están en unidades distintas | Cada serie/eje con su unidad explícita en el label, nunca un eje genérico "Precio" que sirva para ambas |
| Selector de "comparar" que permite armar una comparación de tipos/operaciones distintos sin advertencia | El usuario compara peras con manzanas sin saberlo, y confía en la conclusión de la tabla | Deshabilitar la selección cruzada (Pitfall 2), o si se permite deliberadamente, marcar visualmente cada grupo con badges de tipo/operación bien visibles en cada columna |

## "Looks Done But Isn't" Checklist

- [ ] **Dashboard de detalle:** Muestra un "vs. mercado" — verificar que declara `muestra_n` y el universo (comuna/citywide), no solo el número
- [ ] **Comparación lado a lado:** Acepta cualquier combinación de `tipoPropiedad`/`operacion` — verificar que el estado de selección tipifica/bloquea combinaciones heterogéneas, no solo que el render muestra una advertencia
- [ ] **Comparación lado a lado:** Ordena/rankea por precio o precio-m² — verificar que los `null` (superficie faltante) van al final o a su propia sección, nunca coercionados a 0
- [ ] **Informe exportable:** Tiene botón de exportar y se ve bien en el visor del navegador — verificar que también se ve bien impreso a A4 real, no solo en preview a 100% de zoom
- [ ] **Informe exportable:** Muestra gráficos — verificar que NO usa `html2canvas`/rasterización de recharts (o si la usa, que maneja `scale` y corte de página explícitamente)
- [ ] **Informe exportable:** Tiene fecha de "generado el" — verificar que también tiene fecha de última verificación POR FILA de dato, no solo la fecha de generación del documento
- [ ] **Informe exportable / narrativa IA (si existe):** Genera una recomendación de texto — verificar que el prompt recibe los números reales (`muestra_n`, percentiles) como contexto, no que los re-deriva o los inventa vía búsqueda libre (patrón de Tasación, incorrecto para este caso)
- [ ] **Cualquier fecha nueva mostrada (detalle/comparación/informe):** Verificar contra el helper compartido de parseo de fecha (`${iso}T00:00:00` para campos `date`, directo para `timestamptz`) — no un `new Date(iso)` nuevo escrito a mano

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Benchmark circular/N chico ya mostrado a usuarios | LOW-MEDIUM | Agregar `muestra_n` al contrato de datos, gatear el render existente con el mismo umbral que ya protege las bandas — es un cambio de UI + un join adicional, no una migración de datos |
| Comparación mezclando tipos/operaciones ya en producción | MEDIUM | Migrar el estado de selección a la forma tipada (`{operacion, tipoPropiedad, ids}`), invalidar comparaciones guardadas que no cumplan la homogeneidad, mostrar mensaje de "esta comparación mezclaba operaciones distintas, vuelve a seleccionar" en vez de intentar reinterpretarla silenciosamente |
| Informes ya exportados con html2canvas de baja resolución/cortados | MEDIUM-HIGH | Reescribir el módulo de gráficos del informe a primitivas vectoriales (reusando `binarValores()`); los PDFs ya entregados a usuarios no se pueden corregir retroactivamente, pero el próximo export sí sale bien — considerar aviso si el informe se comparte con clientes externos regularmente |
| Números del informe no coinciden con lo visto en pantalla (UF u otro recalculado) | LOW | Propagar el valor ya calculado desde el caller en vez de re-fetchear — cambio acotado a la firma de la función de export |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| 1. Benchmark circular / muestra chica no declarada | Fase de Detalle (contrato de datos con `muestra_n` desde el inicio) | Ningún componente de detalle/comparación calcula su propio promedio; todos leen `mercado_locales_stats_diarias`; el umbral `MIN_COHORT_SIZE` se respeta en el render, no solo en el cron |
| 2. Mezcla de tipo/operación en comparación | Fase de Comparación | El estado de selección está tipado para rechazar heterogeneidad; test que intenta seleccionar arriendo+venta y verifica bloqueo o advertencia explícita |
| 3. Snapshot del informe sin señal de vigencia | Fase de Informe (con precedente sentado en Fase de Detalle) | Todo informe exportado incluye fecha de generación Y de última verificación por fila, visibles en el cuerpo del documento |
| 4. html2canvas rompiendo la disciplina vectorial | Fase de Informe (decisión de arquitectura tomada antes del primer gráfico) | Grep de `html2canvas`/`dom-to-image` en el diff de la fase = 0, o si existe, tiene manejo explícito de `scale` y corte de página documentado |
| 5. Ranking con `null` coercionado a 0 | Fase de Comparación | Test unitario: un ítem con `precioUfM2Normalizado: null` aparece al final del ranking o en sección separada, nunca primero |
| 6. Recalcular UF/comparables en vez de propagar los ya vistos | Fase de Informe (propagación diseñada desde Fase de Detalle) | El export recibe UF y valores calculados como parámetros; ningún fetch nuevo a UF/mindicador.cl dentro de la ruta de export; si hay narrativa IA, el prompt incluye los números reales como contexto verificable |
| 7. Bug de timezone reintroducido en fechas nuevas | Todas las fases (helper extraído en Fase de Detalle) | Grep de `new Date(` sin `T00:00:00` en campos `date`-only de los archivos nuevos = 0; test de fecha límite (fin de mes) no se corre un día |

## Sources

- Código del proyecto (HIGH confidence, fuente primaria): `lib/mercado-locales-server.ts` (MIN_COHORT_SIZE, `calcular_bandas_mercado_locales`, `OportunidadMercadoLocal`), `lib/scrapers/mercado-locales-common.ts` (`TipoPropiedadComercial`, `OperacionMercadoLocal`), `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` (`formatFechaCorta`, filtros actuales), `components/mercado-inmobiliario/charts/histograma.tsx` (`binarValores`, degradación con `valores.length < 2`), `lib/informe-pdf.ts` y `app/api/cadenas/[id]/reporte/route.ts` (los dos generadores de PDF vectorial ya en producción), `lib/informe-charts.ts` y `lib/tasacion-prompts.ts` (patrón de comparables vía IA + búsqueda web, feature Tasación), `supabase/migrations/20260801_terrenos_oportunidades.sql`, `.planning/data-sources.yaml` (SLAs de frescura por fuente)
- `.planning/AUDIT-FIDELIDAD-DATOS-2026-07-30.md` (HIGH confidence, auditoría propia del proyecto — hallazgos A8/A9/A6/C4 son el precedente directo de los pitfalls 1, 3 y 6 en este documento)
- `.planning/research/PITFALLS.md` (zonificación, 2026-07-30) — mismo proyecto, mismo patrón de "estado explícito de 3 valores" y "disclosure de staleness" reusado aquí
- html2canvas issues #3009 ("How to download React component as PDF with High Resolution"), #1757 ("Charts are partially captured"): https://github.com/niklasvh/html2canvas/issues/3009 , https://github.com/niklasvh/html2canvas/issues/1757 (MEDIUM confidence — WebSearch, reportes de comunidad recurrentes, no específicos de recharts pero sí de la combinación html2canvas+jsPDF+gráficos)
- recharts issue #464 ("How to export charts?"): https://github.com/recharts/recharts/issues/464 (MEDIUM confidence — confirma que recharts no tiene mecanismo nativo de export, la comunidad recurre a html2canvas con los problemas ya descritos)
- "Optimizing Chart Rendering in React: Ensuring Smooth Performance in Print and Export" (Medium): https://medium.com/@balakumaran428/optimizing-chart-rendering-in-react-ensuring-smooth-performance-in-print-and-export-78206813496f (MEDIUM confidence — describe el problema de resolución zoom-dependiente y sugiere SVG vectorial como alternativa más robusta que rasterizar)
- CBRE — "Connections & Disconnections of Commercial Property Cap Rates": https://www.cbre.com/insights/viewpoints/connections-and-disconnections-of-commercial-property-cap-rates (MEDIUM confidence — confirma que comparar cap rates/precios entre tipos de propiedad y mercados distintos es una fuente de conclusiones engañosas reconocida por la propia industria, sustento externo del Pitfall 2 y su extensión a un eventual "cap rate implícito")

---
*Pitfalls research for: dashboard de detalle + comparación + informe exportable sobre Oportunidades de Mercado Inmobiliario — PermisoHub (milestone v1.6)*
*Researched: 2026-08-02*
