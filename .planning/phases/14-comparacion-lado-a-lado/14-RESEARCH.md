# Phase 14: Comparación Lado a Lado - Research

**Researched:** 2026-08-02
**Domain:** Selección de 2-5 oportunidades homogéneas (mismo tipo de propiedad + misma operación) + tabla comparativa con mejor valor resaltado por fila + estado en URL — módulo Mercado Inmobiliario / Oportunidades, PermisoHub
**Confidence:** HIGH

> No existe `14-CONTEXT.md` (el usuario no corrió `/gsd:discuss-phase` para esta fase). Este documento usa ROADMAP.md/REQUIREMENTS.md como fuente de alcance y marca explícitamente como **Open Questions** las decisiones de producto que normalmente vendrían fijadas por CONTEXT.md — el planner debe tomar un default defendible para cada una, no asumir en silencio.

## Summary

Esta fase no requiere investigación de stack ni de patrones nuevos — la investigación a nivel de milestone (`.planning/research/SUMMARY.md`) ya lo marcó explícitamente como "estándar, sin research adicional" y la inspección directa del código real que dejó la Fase 13 (completa, verificada, 9/9 must-haves) lo confirma. Todo lo necesario ya existe: `evaluarOportunidad()` como fuente única de verdad del scoring, `obtenerOportunidadPorId()` como plantilla exacta de qué forma de datos necesita cada oportunidad comparada, `OportunidadDetalle`/`ComparableOportunidad` como los dos tipos candidatos a interfaz de retorno, y `Table`/`Checkbox`/`Tabs` de shadcn/ui ya instalados y en uso en el proyecto.

Lo que la Fase 13 **no** dejó construido, y que esta fase sí debe construir desde cero:
1. `obtenerOportunidadesPorIds(ids: string[])` — no existe hoy en `lib/mercado-locales-server.ts` (verificado por grep, cero coincidencias). Debe construirse siguiendo el Pattern 3 ya usado en `compararPortafolioConMercado()` (`lib/propiedades-portafolio-server.ts:88-97`): un fetch batched de listings vía `.in('id', ids)`, más una deduplicación de la consulta de bandas por combinación `comuna×tipoPropiedad×operacion` (con hasta 5 ítems que ya comparten `tipoPropiedad`+`operacion` por diseño — ver más abajo — la deduplicación real es solo por comuna distinta).
2. `SelectorComparacion` (client island) — hoy `oportunidades/page.tsx` no tiene ningún checkbox ni mecanismo de selección (verificado leyendo el archivo completo, 172 líneas) — el único elemento interactivo por card es el link "Ver ficha completa →". Esta fase construye el primer client component del módulo que usa `useRouter()`.
3. `/oportunidades/comparar/page.tsx` — ruta nueva, Server Component, hermana de `[id]/page.tsx` (mismo patrón `searchParams: Promise<{...}>`).
4. Componentes de tabla comparativa nuevos — los 4 tabs que la Fase 13 construyó (`posicionamiento-tab.tsx`, `historial-tab.tsx`, `comparables-tab.tsx`, `resumen-tab.tsx`) están **shape-adaptados a una sola oportunidad** (reciben `oportunidad: OportunidadDetalle` y renderizan secciones apiladas verticalmente, un layout de "ficha", no de "columna de tabla"). **No son reutilizables tal cual como columnas** — ver sección "Qué es reutilizable de verdad" más abajo para el desglose exacto de qué SÍ se reutiliza (los primitivos de chart `GaugeArc`/`DesviacionBar`, las funciones de datos) y qué NO (los componentes `*-tab.tsx` completos).

**Primary recommendation:** Construir `obtenerOportunidadesPorIds()` (batched, reusando `evaluarOportunidad()`) devolviendo `OportunidadDetalle[]`; construir `SelectorComparacion` como client island con `useState<string[]>` local (se resetea al cambiar de filtro porque la página entera es Server Component y se re-renderiza) que hace `router.push()` a `/oportunidades/comparar?ids=...`; validar homogeneidad de tipo/operación **tanto en el cliente (checkbox deshabilitado) como en el servidor** (la URL `?ids=` es input no confiable — cualquiera puede escribirla a mano) antes de renderizar la tabla; construir una tabla nueva (no reusar los tabs de Fase 13) con filas agrupadas por sección, resaltando el mejor valor solo en las filas donde "mejor" tiene una dirección inequívoca (precio UF, precio UF/m², % vs. mediana — todas "menor es mejor"), dejando sin resaltar las filas ambiguas (superficie, días publicado) — ver Open Questions.

## User Constraints

Ninguno — no existe `14-CONTEXT.md`. Fuente de alcance: ROADMAP.md (Phase 14 section) + REQUIREMENTS.md (COMPA-01..04), citados en `<additional_context>` de este research.

## Standard Stack

### Core (ya instalado, cero instalaciones nuevas)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui `Table` | ya instalado, `components/ui/table.tsx` | Tabla comparativa (columnas=propiedades, filas=atributos) | Verificado: `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` ya existen con el estilo "Consultora" del proyecto (`text-xs uppercase tracking-wide` en headers). No existe paquete npm de industria para "comparar propiedades" (confirmado por STACK.md a nivel milestone) — se construye a mano sobre esta tabla. |
| shadcn/ui `Checkbox` | ya instalado, `components/ui/checkbox.tsx` | Selección de oportunidades en la lista, con estado deshabilitado para ítems heterogéneos | Ya usado en 4 lugares del proyecto (`proyectos/nuevo`, `due-diligence`, `calculadora`, `notificaciones-dialog`) — patrón conocido, `disabled` prop nativo de Radix soporta directamente el requisito COMPA-03. |
| `next/navigation` `useRouter` | Next 16 App Router | `SelectorComparacion` construye `/oportunidades/comparar?ids=...` y navega | Seguirá el mismo patrón `"use client"` + `useRouter()`/`useSearchParams()` ya usado en `reportes/page.tsx` (único precedente client-side del módulo hoy). |
| `components/mercado-inmobiliario/charts/gauge-arc.tsx`, `desviacion-bar.tsx` | ya construidos (Fase 13) | Reutilizables tal cual dentro de celdas de tabla — son SVG/CSS puro, sin dependencia de layout de "ficha" | Ambos reciben props planos (`value`, `max`, `color`, `variacionPct`) — no asumen nada sobre estar en una columna vertical vs. una celda de tabla. |

### Supporting

Ninguna librería nueva. `lib/formato-fecha.ts` (`formatFechaCorta`, ya extraído en Fase 13) debe reutilizarse para cualquier fecha `date`-only nueva que aparezca en la tabla (evita reintroducir Pitfall 7).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tabla shadcn/ui a mano | Radar chart (Recharts, ya instalado) como comparación principal | Explícitamente descartado por FEATURES.md del milestone — ningún actor de industria (CoStar/LoopNet/Crexi) usa radar como comparación principal de CRE; tabla es el formato universal. Un radar complementario queda fuera de alcance de esta fase (P3, "nice to have" v2+). |
| `useState` local en `SelectorComparacion` | Zustand/Context global | Cero precedente de estado global en el proyecto (`package.json` no tiene zustand); el caso de uso ("comparar ahora, no guardar para después") no lo necesita — ver Anti-Pattern 1 de ARCHITECTURE.md a nivel milestone. |

**Installation:**
```bash
# Ninguna instalación nueva requerida.
```

## Architecture Patterns

### Recommended Project Structure (delta sobre lo que dejó la Fase 13)

```
app/(dashboard)/mercado-inmobiliario/oportunidades/
├── page.tsx                    # MODIFICADO — agrega <SelectorComparacion oportunidades={...} tipoPropiedad={tipoPropiedad} operacion={operacion} />
├── [id]/
│   └── page.tsx                # SIN CAMBIOS (Fase 13, ya completa)
└── comparar/
    └── page.tsx                # NUEVO — Server Component, searchParams.ids

lib/
└── mercado-locales-server.ts   # MODIFICADO — + obtenerOportunidadesPorIds(ids: string[])

components/mercado-inmobiliario/
├── selector-comparacion.tsx           # NUEVO — client island, checkbox + botón flotante "Comparar (N)"
└── comparacion/
    └── tabla-comparacion.tsx          # NUEVO — Server o Client Component puro de presentación, recibe OportunidadDetalle[] ya homogéneo
```

### Pattern 1: Homogeneidad garantizada por diseño de filtro EN LA LISTA, pero NO en la URL de destino

**What:** `oportunidades/page.tsx` llama a `obtenerOportunidadesMercadoLocales(operacion, { tipoPropiedad, comuna })` con **un solo** `operacion`/`tipoPropiedad` a la vez (viene del `<form method="GET">` de filtros) — verificado en `oportunidades/page.tsx:27-31,37`. Esto significa que **dentro de un mismo render de la lista, todas las oportunidades ya son homogéneas** — el `SelectorComparacion` que vive en esa página nunca puede, por construcción, ofrecer al usuario ítems de tipo/operación distintos para marcar, porque la lista que recibe como prop ya viene filtrada a uno solo.

**Dónde SÍ puede colarse la heterogeneidad:** la ruta `/oportunidades/comparar?ids=...` es alcanzable directamente por URL — pegando/editando el querystring a mano, compartiendo un link armado con ids de dos búsquedas distintas, o (si en el futuro se cambia el diseño de `SelectorComparacion` para persistir selección entre cambios de filtro vía localStorage/sessionStorage) acumulando ítems heterogéneos antes de navegar. Ninguna de estas rutas está bloqueada por el checkbox deshabilitado del cliente.

**Implicación de diseño — dos capas de defensa, no una:**
1. **UX (checkbox deshabilitado)** — satisface la letra literal de COMPA-03 ("checkbox/selección deshabilitada") y previene el error accidental más común (usuario intentando marcar un ítem que no corresponde). Se implementa trivialmente porque, dentro de la lista, CUALQUIER ítem no seleccionado ya es del mismo tipo/operación que los ya marcados (son todos iguales) — el único caso real a deshabilitar es cuando ya hay 5 seleccionados (tope, no heterogeneidad).
2. **Validación estructural real (server-side en `/comparar/page.tsx`)** — es la que de verdad "previene estructuralmente" en el sentido fuerte de COMPA-03, porque la URL es input no confiable. `obtenerOportunidadesPorIds()` debe devolver oportunidades de comuna potencialmente distinta pero **la página debe verificar** `new Set(oportunidades.map(o => o.tipoPropiedad)).size === 1 && new Set(oportunidades.map(o => o.operacion)).size === 1` antes de renderizar la tabla — si falla, mostrar un mensaje explícito ("Esta comparación mezcla tipos de propiedad u operaciones distintas — vuelve a seleccionar desde la lista") en vez de una tabla con columnas sin sentido económico.

**Trade-offs:** Un poco de código de validación que "nunca debería dispararse" si el flujo normal (checkbox → botón → URL) es el único camino — pero es exactamente la defensa que Pitfall 2 (PITFALLS.md) pide, y es barata.

### Pattern 2: Fetch en lote deduplicado por cohorte (ya establecido, Fase 13 no lo necesitó pero `compararPortafolioConMercado` sí)

**What:** `obtenerOportunidadesPorIds(ids: string[])` debe hacer **un** `.in('id', ids)` contra `mercado_locales_listings` (no N llamadas a `obtenerOportunidadPorId`), y para las bandas de mercado, cachear por `comuna` (ya que `tipoPropiedad`+`operacion` son homogéneos por construcción tras la validación del Pattern 1 — solo la comuna puede variar entre las hasta 5 oportunidades comparadas).

**Example (adaptar el patrón exacto de `lib/propiedades-portafolio-server.ts:88-97`, ya citado en ARCHITECTURE.md del milestone):**
```typescript
export async function obtenerOportunidadesPorIds(ids: string[]): Promise<OportunidadDetalle[]> {
  const supabase = createServiceClient()
  const { data: listings, error } = await supabase
    .from('mercado_locales_listings')
    .select('id, titulo, url, comuna, tipo_propiedad, operacion, status, dado_de_baja_el, precio_monto, precio_moneda, superficie_m2, primera_vez_visto_el, ultima_vez_visto_el')
    .in('id', ids)
  if (error || !listings) return []

  // Cache de bandas por comuna×tipoPropiedad×operacion — con ids homogéneos
  // en tipo/operación, la única variación real es la comuna.
  const bandasCache = new Map<string, Promise<BandasMercadoLocal | null>>()
  function bandasPara(comuna: string, tipoPropiedad: TipoPropiedadComercial, operacion: OperacionMercadoLocal) {
    const key = `${comuna}|${tipoPropiedad}|${operacion}`
    if (!bandasCache.has(key)) bandasCache.set(key, obtenerBandasMercadoLocales(comuna, operacion, tipoPropiedad))
    return bandasCache.get(key)!
  }

  // Historial de precio de TODOS los ids en una sola query .in() (ids.length <= 5,
  // sin necesidad del chunking de CHUNK_IN_LISTING_IDS que sí usa la lista completa)
  const { data: historyRows } = await supabase
    .from('mercado_locales_historial_precio')
    .select('listing_id, precio_monto, capturado_el')
    .in('listing_id', ids)
    .order('capturado_el', { ascending: true })
  const historyByListing = new Map<string, { precio_monto: number; capturado_el: string }[]>()
  for (const row of historyRows ?? []) {
    const arr = historyByListing.get(row.listing_id as string) ?? []
    arr.push(row as { precio_monto: number; capturado_el: string })
    historyByListing.set(row.listing_id as string, arr)
  }

  // ... precioUf/precioUfM2/reasonCodes por listing usando evaluarOportunidad(),
  // exactamente la misma lógica ya escrita en obtenerOportunidadPorId() (líneas
  // 637-673 de lib/mercado-locales-server.ts) — extraer a un helper interno
  // compartido en vez de duplicar el bloque, o llamar obtenerOportunidadPorId
  // por id si se prefiere simplicidad sobre el ahorro de queries (ver Open
  // Question sobre el trade-off).
}
```

**Trade-offs:** Con un tope de 5 ítems, el "N+1" real es pequeño (máximo 5 fetches de bandas si las 5 comunas son distintas, típicamente menos porque la comparación suele ser dentro de una misma zona de interés) — pero el research de milestone (PITFALLS.md, "Performance Traps") lo marca explícitamente como pitfall a evitar, y el costo de hacerlo bien es bajo. Ver Open Question sobre si vale la pena extraer el bloque de cálculo de `obtenerOportunidadPorId()` a un helper compartido para no duplicarlo aquí.

### Pattern 3: Tabla nueva, NO reutilización directa de los tabs de Fase 13

**What:** Los 4 componentes `components/mercado-inmobiliario/oportunidad-detalle/*.tsx` están diseñados para **una** oportunidad: `PosicionamientoTab` recibe `{oportunidad: OportunidadDetalle, bandasArriendo, bandasVenta}` y renderiza un layout vertical de bloques (`space-y-5`) pensado para ocupar el ancho completo de un tab. Ponerlos uno al lado del otro (5 columnas de `PosicionamientoTab` completo) produciría una página excesivamente ancha con contenido repetido (cada uno vuelve a mostrar su propio banner de "sin banda"/"muestra insuficiente", su propia sección de rentabilidad de zona con su propio texto explicativo largo) — no es lo que CoStar/LoopNet/Crexi hacen (tabla compacta fila=atributo), y no es lo que COMPA-02 pide literalmente ("tabla, columnas=propiedades, filas=atributos").

**What to build instead:** Una tabla nueva (`tabla-comparacion.tsx`) donde cada **fila** es un atributo (Precio UF, Precio UF/m², % vs. mediana cohorte, Superficie, Días publicado, Señales/reasonCodes, Rentabilidad implícita de zona si aplica) y cada **columna** es una oportunidad — reutilizando:
- Los **datos** ya resueltos por `OportunidadDetalle` (incluye `bandas` — no hace falta recalcular nada, Pitfall 1 ya está resuelto en el contrato de datos heredado de Fase 13).
- Los **primitivos de chart** (`GaugeArc`, `DesviacionBar`) dentro de celdas individuales si se quiere una lectura visual rápida de posicionamiento por columna, en vez de solo texto — son reutilizables sin cambios porque no asumen contexto de layout.
- La función `evaluarOportunidad`/`REASON_LABEL` para la fila de señales.
- `calcularCapRate` (`lib/calculadora-inversion.ts:37`) para la fila de rentabilidad de zona, exactamente como hace `posicionamiento-tab.tsx:25-27` — pero compactado a una celda, no la explicación larga de 3 párrafos que tiene el tab de detalle.

**Trade-offs:** Es más código nuevo que "solo reusar los tabs", pero es la única forma de cumplir el formato de tabla que pide el requisito y que confirma FEATURES.md como estándar de industria (CoStar/Crexi/LoopNet, ninguno usa "4 fichas completas lado a lado").

### Anti-Patterns to Avoid

- **Reutilizar los 4 `*-tab.tsx` de Fase 13 tal cual, en 5 columnas anchas**: viola el formato de tabla pedido y duplica banners/explicaciones largas 5 veces. Construir una tabla compacta nueva en su lugar (Pattern 3).
- **Confiar solo en el checkbox deshabilitado del cliente como "prevención estructural"**: la URL `?ids=` es alcanzable directamente sin pasar por el checkbox — validar homogeneidad también server-side en `/comparar/page.tsx` (Pattern 1).
- **`?? 0` en cualquier `.sort()`/comparación de "mejor valor" sobre `precioUfM2Normalizado`**: Pitfall 5 (PITFALLS.md, HIGH confidence, ya verificado contra el código real) — un `null` (superficie no informada) coercionado a `0` ganaría cualquier comparación de "más barato". Usar `null`-goes-last explícito, exactamente como ya hace `obtenerComparablesOportunidad()` (líneas 761-772 de `mercado-locales-server.ts` — patrón ya en producción en este mismo archivo, cópialo).
- **Persistir la selección de comparación en una tabla nueva de Supabase**: fuera de alcance — el caso de uso es "comparar ahora", la URL ya es "compartible" (COMPA-04 lo pide explícitamente vía querystring, no vía guardado server-side).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Tabla con columnas dinámicas (2-5) | Grid CSS a mano con cálculo de anchos | `<Table>` de shadcn/ui con `<TableHead>` por oportunidad — el `overflow-x-auto` del wrapper (`components/ui/table.tsx:5`) ya maneja el caso de 5 columnas angostas en mobile | Ya resuelto, con el mismo estilo visual "Consultora" del resto del proyecto |
| Checkbox con estado deshabilitado | `<input type="checkbox" disabled={...}>` a mano con estilos custom | `<Checkbox>` de shadcn/ui (Radix), ya usado en 4 lugares del proyecto | Accesibilidad (aria-disabled, foco) ya resuelta por Radix |
| Parseo/validación de `?ids=uuid1,uuid2,...` | Regex de UUID escrito desde cero sin pensar en duplicados/basura | `.split(',').filter(uuidRegex.test).filter(dedupe)` — simple pero explícito; ver Open Question sobre longitud/formato exacto | Evita que un id malformado rompa la query `.in()` de Supabase con un error opaco |

**Key insight:** Todo el trabajo de esta fase es de composición y validación sobre datos/lógica que Fase 13 ya resolvió correctamente (scoring, bandas, null-handling en comparables) — el riesgo no es técnico, es de disciplina (no reintroducir un pitfall ya corregido en otro lugar del mismo archivo).

## Common Pitfalls

(Heredados del research de milestone, re-verificados contra el código real que dejó Fase 13 — HIGH confidence salvo donde se indica.)

### Pitfall 1: Checkbox deshabilitado en el cliente ≠ prevención estructural real
**What goes wrong:** Se implementa `SelectorComparacion` con checkboxes que se deshabilitan entre sí (correcto, pero trivial porque la lista ya es homogénea — ver Pattern 1) y se da por completado COMPA-03, sin validar nada en `/comparar/page.tsx`. Un `?ids=` armado a mano con ids de dos búsquedas distintas (un local_comercial en arriendo + una oficina en venta) llega a la tabla sin bloqueo.
**Why it happens:** El requisito literal menciona "checkbox/selección deshabilitada" como el mecanismo, lo que hace fácil pensar que ahí termina el trabajo.
**How to avoid:** Validar `tipoPropiedad`/`operacion` homogéneos en el Server Component de `/comparar` ANTES de renderizar la tabla — mensaje de error explícito si no lo son, nunca una tabla con columnas mezcladas.
**Warning signs:** `/comparar/page.tsx` que solo hace `obtenerOportunidadesPorIds(ids)` y renderiza directo, sin ningún check de homogeneidad entre el paso de fetch y el de render.
**Phase to address:** Esta fase.

### Pitfall 2: `null` coercionado a `0` en el resaltado de "mejor valor"
**What goes wrong:** `precioUfM2Normalizado` es `number | null` (falta cuando no hay `superficieM2`). Un resaltado de "mejor valor" que haga `Math.min(...oportunidades.map(o => o.precioUfM2Normalizado ?? 0))` marcaría la oportunidad SIN superficie conocida como "la mejor" (0 gana cualquier comparación de precio).
**Why it happens:** `?? 0` es el fallback reflejo más común en JS/TS para evitar `NaN`/`undefined` en un cálculo de mínimo/máximo.
**How to avoid:** Filtrar `null` antes de calcular el mínimo/máximo de la fila; si TODOS los valores de la fila son `null`, no resaltar nada. Copiar el patrón `null`-goes-last ya en producción en `obtenerComparablesOportunidad()` (`lib/mercado-locales-server.ts:761-772`).
**Warning signs:** Grep de `?? 0` o `|| 0` en cualquier archivo nuevo de esta fase, aplicado a un campo `precioUfM2Normalizado`/`superficieM2`.
**Phase to address:** Esta fase (tabla de comparación).

### Pitfall 3: Bug de timezone reintroducido en una fecha nueva de la tabla
**What goes wrong:** Si la tabla agrega una fila "Publicado desde" o similar con un campo `date`-only nuevo (no aplica a `primeraVezVistoEl`/`ultimaVezVistoEl`, que son `timestamptz` y usan `new Date(iso)` directo, como ya hace `historial-tab.tsx:23-27`), un `new Date(iso)` sin `T00:00:00` corre el mes/día en UTC-3/-4.
**How to avoid:** Reusar `formatFechaCorta` (`lib/formato-fecha.ts`) para cualquier campo `date`-only; para los timestamptz ya existentes, replicar el helper `formatTimestamp` local que ya tiene `historial-tab.tsx:23-27` (o extraerlo a compartido si se repite un tercer lugar — no era necesario extraerlo en Fase 13 porque solo un archivo lo usaba).
**Phase to address:** Esta fase, si se muestra alguna fecha nueva.

### Pitfall 4: Tope de selección (2-5) no aplicado en ambos extremos
**What goes wrong:** Se bloquea el checkbox al llegar a 5 (correcto) pero no se valida el mínimo de 2 al llegar a `/comparar` — un `?ids=` con un solo id, o con 6+ ids pegados a mano, llega a la tabla sin mensaje claro.
**How to avoid:** `/comparar/page.tsx` debe validar `ids.length >= 2 && ids.length <= 5` (tras deduplicar) y mostrar un estado explícito ("Selecciona entre 2 y 5 oportunidades desde la lista") si no se cumple — no un error genérico ni un crash de `.map()` sobre un array vacío/de 1.
**Phase to address:** Esta fase.

## Code Examples

### Validación de homogeneidad server-side (nuevo, este archivo)
```typescript
// app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx
const oportunidades = await obtenerOportunidadesPorIds(idsValidos)

const tipos = new Set(oportunidades.map((o) => o.tipoPropiedad))
const operaciones = new Set(oportunidades.map((o) => o.operacion))
if (tipos.size > 1 || operaciones.size > 1) {
  // Render explícito de error — NO seguir a la tabla con columnas heterogéneas.
}
```

### Null-goes-last para "mejor valor" (adaptar el patrón ya en producción)
```typescript
// Source: lib/mercado-locales-server.ts:761-772 (obtenerComparablesOportunidad),
// mismo criterio aplicado acá al resaltado de la fila "Precio UF/m²"
function mejorValor(oportunidades: OportunidadDetalle[]): string | null {
  const conValor = oportunidades.filter((o) => o.precioUfM2Normalizado !== null)
  if (conValor.length === 0) return null
  return conValor.reduce((min, o) =>
    (o.precioUfM2Normalizado as number) < (min.precioUfM2Normalizado as number) ? o : min
  ).id
}
```

## State of the Art

No aplica — dominio interno del proyecto, sin librerías externas cambiando de versión relevante para esta fase.

## Open Questions

Estas son decisiones de producto/diseño que CONTEXT.md normalmente fijaría — no hay founder input capturado para esta fase, así que el planner debe elegir un default defendible y dejarlo explícito en el plan (no asumir en silencio).

1. **¿Qué filas de la tabla tienen "mejor valor" resaltable, y en qué dirección?**
   - What we know: COMPA-02 pide "el mejor valor resaltado por fila" sin especificar semántica por atributo. Para **Precio UF** y **Precio UF/m²**, "menor es mejor" es defendible sin ambigüedad (el usuario objetivo busca oportunidades baratas — coincide con el resto del producto, donde `below_p25` = bueno). Para **% de desviación vs. mediana de cohorte**, más negativo (más barato que el mercado) = mejor.
   - What's unclear: **Superficie m²** no tiene una dirección obviamente "mejor" (más grande no es objetivamente mejor ni peor sin conocer el uso que le dará el usuario). **Días publicado** es explícitamente ambiguo — pocos días podría leerse como "recién publicado, quizás sin explorar aún" (bueno) o simplemente neutral; muchos días podría ser "nadie lo quiere" (malo) o "el dueño no tiene apuro, hay margen de negociación" (podría ser bueno). El propio task de research de este documento marcó esto como una trampa a no asumir.
   - Recommendation: Resaltar "mejor" SOLO en filas con dirección inequívoca (Precio UF, Precio UF/m² — con `null`-goes-last, nunca resaltando una fila donde todos son `null`, y % vs. mediana de cohorte). Dejar Superficie y Días publicado como filas informativas SIN resaltado — evita fabricar una interpretación no fundamentada (mismo principio "nunca fabricar interpretación" que ya rige el resto del producto, citado en FEATURES.md del milestone contra el "score único").

2. **¿La tabla incluye una fila de "Rentabilidad implícita de zona" (el cálculo DETA-07 que Fase 13 ya construye por oportunidad individual)?**
   - What we know: `posicionamiento-tab.tsx:25-27` ya calcula esto por oportunidad vía `calcularCapRate`, condicionado a que existan bandas de AMBAS operaciones (arriendo y venta) para esa comuna×tipo. En una comparación homogénea por tipo+operación, cada oportunidad puede seguir teniendo esta métrica calculada individualmente (depende de su propia comuna).
   - What's unclear: Si se incluye, ¿se resalta "mejor" (mayor rentabilidad de zona = mejor) o se muestra solo informativo? Y dado que es un estimado de ZONA (no del activo), resaltarlo como "mejor" podría sugerir que la oportunidad específica rinde más, cuando en realidad dos oportunidades en la misma comuna tendrían el mismo valor de esta fila — resaltar "empate" no aporta.
   - Recommendation: Incluir la fila (dato ya calculado, cero costo adicional), pero SIN resaltado de "mejor" — mantener el mismo badge "Estimado de zona" ya usado en el detalle, y aclarar en un tooltip/nota que es igual para todas las oportunidades de la misma comuna. Si dos comunas distintas están en la comparación, ahí sí varía por columna pero sigue siendo un estimado de zona, no del activo — no lo suficientemente "del activo" como para justificar competir por "mejor".

3. **¿Qué pasa cuando un id en `?ids=` no existe o corresponde a un aviso `dado_de_baja`?**
   - What we know: `obtenerOportunidadPorId()` (Fase 13) NO excluye `dado_de_baja` — el detalle individual sigue mostrándolo con un banner rojo explícito, porque "¿por qué ya no aparece?" es información útil, no un error (documentado en el comentario de la función, línea 615-619).
   - What's unclear: En una tabla comparativa, ¿se incluye esa columna con un indicador visual (ej. columna con opacidad reducida + badge "Dado de baja"), o se excluye de la comparación activa pero se informa que fue excluida?
   - Recommendation: Mantener consistencia con Fase 13 — incluir la columna con el mismo tratamiento visual (badge/banner compacto), no excluirla silenciosamente. Si el id simplemente no existe en la tabla (`obtenerOportunidadesPorIds` no lo devuelve), sí debe excluirse pero con un mensaje explícito ("1 de N oportunidades seleccionadas ya no existe").

4. **¿`obtenerOportunidadesPorIds()` duplica el bloque de cálculo de precioUf/reasonCodes de `obtenerOportunidadPorId()`, o lo extrae a un helper compartido?**
   - What we know: El bloque (líneas 637-673 de `mercado-locales-server.ts`) no es trivial (maneja conversión CLP→UF condicionada a bandas disponibles, cálculo de `precioUfM2`, ventana de 7 días para `price_drop_7d`) — duplicarlo en la nueva función arriesga que diverjan con el tiempo (exactamente el problema que `evaluarOportunidad()` ya resolvió una vez en Fase 13).
   - What's unclear: Extraer un helper interno (`function construirOportunidadDetalle(listing, bandas, historialReciente): Omit<OportunidadDetalle, 'bandas'>`) es más trabajo de refactor ahora pero evita la duplicación; simplemente llamar `obtenerOportunidadPorId(id)` dentro de un `Promise.all` para cada id es mucho más simple de escribir pero renuncia al batching real (Pattern 2) y reintroduce N+1 en menor escala (aceptable con ≤5 ids, pero contradice la recomendación explícita del research de milestone).
   - Recommendation: Extraer el helper compartido — es el mismo criterio que ya se aplicó una vez con `evaluarOportunidad()` en esta fase anterior, y el costo es bajo (una función privada, no exportada, sin cambiar la firma pública de `obtenerOportunidadPorId`).

## Sources

### Primary (HIGH confidence — código real del proyecto, leído directamente)
- `lib/mercado-locales-server.ts` (810 líneas, completo) — `evaluarOportunidad()` (L372-395), `obtenerOportunidadPorId()` (L621-695, incluyendo el bloque de cálculo a extraer), `OportunidadDetalle` (L594-613), `ComparableOportunidad` (L697-704), `obtenerComparablesOportunidad()` (L714-808, con el patrón null-goes-last ya en producción), `obtenerBandasMercadoLocales()` (L274-308) — confirmado que `obtenerOportunidadesPorIds` NO existe (grep sin resultados)
- `lib/scrapers/mercado-locales-common.ts` — `TipoPropiedadComercial` (`'local_comercial' | 'oficina' | 'bodega' | 'industrial'`), `OperacionMercadoLocal` (`'arriendo' | 'venta'`)
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` (182 líneas, completo) — patrón de composición Server Component, `Promise.all`, `notFound()`
- `components/mercado-inmobiliario/oportunidad-detalle/{posicionamiento,historial,comparables}-tab.tsx` (leídos completos) — confirmado shape "ficha de una oportunidad", no "columna de tabla"; confirmado uso de `GaugeArc`/`DesviacionBar`/`calcularCapRate`/`REASON_LABEL_DETALLE`/`formatFechaCorta`
- `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` (172 líneas, completo) — confirmado: SIN checkbox ni selector de comparación hoy; `<form method="GET">` filtra a UN `operacion`+`tipoPropiedad` por render (Pattern 1 clave de este research)
- `app/(dashboard)/mercado-inmobiliario/reportes/page.tsx` (primeras 80 líneas) — confirmado 2do precedente de estado-en-URL: `useSearchParams().get("comuna")` en un client component
- `components/ui/table.tsx`, `components/ui/checkbox.tsx` (confirmada existencia por `ls`), `components/mercado-inmobiliario/charts/gauge-arc.tsx`, `desviacion-bar.tsx` (leídos completos) — confirmados reutilizables sin cambios
- `lib/formato-fecha.ts` (leído completo) — `formatFechaCorta`, con distinción explícita date-only vs. timestamptz documentada en el propio comentario
- `lib/calculadora-inversion.ts:37-52` — `calcularCapRate()`
- `lib/propiedades-portafolio-server.ts:88-97` (citado, no releído completo esta vez — ya confirmado por el research de milestone) — patrón `compararPortafolioConMercado` de fetch batched con cache por cohorte
- `.planning/phases/13-refactor-de-scoring-dashboard-de-detalle/13-VERIFICATION.md` — confirmación de que Fase 13 está `passed`, 9/9 must-haves, y el contrato de datos exacto que hereda esta fase
- `.planning/ROADMAP.md` (líneas 69-83), `.planning/REQUIREMENTS.md` (líneas 20-26) — alcance exacto de COMPA-01..04, confirmado sin discrepancias con `<additional_context>`

### Secondary (MEDIUM confidence — heredado del research de milestone, no re-verificado con fuentes externas esta vez)
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`, `FEATURES.md` — research de milestone completo (2026-08-02), secciones "Fase 2: Comparación lado a lado" citadas y verificadas contra el código real donde correspondía; estructura de comparación tabular como estándar de industria (CoStar/LoopNet/Crexi) no re-verificada con fuentes externas nuevas en esta pasada — se hereda la confianza MEDIUM-HIGH ya asignada por FEATURES.md.

### Tertiary (LOW confidence)
- Ninguna.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero instalaciones nuevas, todo verificado contra archivos reales (`table.tsx`, `checkbox.tsx` confirmados por `ls`)
- Architecture: HIGH — las 4 decisiones clave (fetch batched, homogeneidad de 2 capas, tabla nueva vs. reuso de tabs, extracción de helper) verificadas contra el código real que dejó Fase 13, no asumidas del research de milestone
- Pitfalls: HIGH para los heredados de PITFALLS.md ya verificados contra código real (null-coercion, timezone); MEDIUM para los nuevos identificados en esta pasada (validación server-side de homogeneidad) porque son inferencia de diseño, no un bug ya observado en el proyecto

**Research date:** 2026-08-02
**Valid until:** Estable — sin dependencias externas de versión; revalidar solo si Fase 13 se modifica después de esta fecha (improbable, está verificada y cerrada).
