# Architecture Research — Dashboards de Oportunidades (detalle, comparación, informe exportable)

**Milestone:** Detalle por oportunidad + comparación lado a lado + informe exportable, sobre `/mercado-inmobiliario/oportunidades`
**Researched:** 2026-08-02
**Based on:** Direct codebase inspection (`app/(dashboard)/mercado-inmobiliario/`, `lib/mercado-locales-server.ts`, `lib/informe-pdf.ts`, `components/mercado-inmobiliario/`, `supabase/migrations/20260802_mercado_locales_listings.sql`)
**Confidence:** HIGH for all three integration decisions below — verified against the real schema, the real query function, and the real PDF module, not assumed from the milestone brief.

## Executive Summary

The premise in the milestone brief that oportunidades "no son entidades persistentes con id estable" is **not accurate** — verified against `supabase/migrations/20260802_mercado_locales_listings.sql` and `lib/mercado-locales-server.ts`. `mercado_locales_listings.id` is a real `uuid PRIMARY KEY`, and `obtenerOportunidadesMercadoLocales()` already returns that exact `listing.id` as `OportunidadMercadoLocal.id` (used today only as a React `key` in `oportunidades/page.tsx`). The table is a **global, RLS-read-open dataset** (`FOR SELECT TO authenticated USING (true)`, no `workspace_id`) — every authenticated user across every workspace sees the same row. This removes an entire class of concerns (no per-workspace scoping, no ownership check) and directly unblocks a stable `/oportunidades/[id]` route: **no new table, no new migration, no id-generation problem.**

The only real gap is that "oportunidad" today is not a first-class row — it's a *computed label* (`reasonCodes`) applied at read time to a `mercado_locales_listings` row by comparing it against `mercado_locales_stats_diarias`. That scoring logic lives inline inside `obtenerOportunidadesMercadoLocales()`'s loop and is not currently reusable. **This is the one piece of real prerequisite work**: extracting that scoring into a pure, testable function so the list view and the new detail/comparison views compute identical `reasonCodes` from the same listing, instead of two implementations drifting apart. This is exactly the kind of extraction the project's own convention already documents (`lib/calculadora-inversion.ts`, `lib/obligaciones-regulatorias.ts`) — same pattern, different file.

For selection state, the project has **zero precedent for global client state** (no Zustand/Redux in `package.json`; Mi Cartera and Terrenos each use page-local `useState`, never shared across routes) and a **strong, repeated precedent for URL-driven state on exactly this module** (`oportunidades/page.tsx`'s GET form on `comuna`/`operacion`/`tipoPropiedad`; `reportes/page.tsx`'s `useSearchParams().get("comuna")`). The comparison feature should follow that same idiom: a `?ids=uuid1,uuid2,uuid3` querystring on a new `/oportunidades/comparar` route, with an in-page client "island" (checkbox selector + floating action bar) building that URL — not a store, not React Context, not localStorage.

For the exportable report, `lib/informe-pdf.ts` is real Due Diligence domain logic (láminas anotadas, hallazgos con cita normativa, estado DOM) wrapped in a single "autocontenido" module — its own header comment says as much. Bolting an Oportunidades report onto it would violate that single-responsibility boundary and drag in `pdfjs-dist` rasterization that Oportunidades never needs (no planos involved). The correct move is a **new sibling module**, `lib/informe-oportunidades-pdf.ts`, following the exact same conventions (`"use client"` caller, dynamic `import("jspdf")`, `pdf.save(...)` client-side download) but with none of the plano-rasterization machinery — it is a strictly simpler module than `informe-pdf.ts`, not a variant of it.

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx  (Server Comp.)  │
│    reads searchParams (comuna/operacion/tipoPropiedad)                       │
│    → obtenerOportunidadesMercadoLocales()  (existing)                        │
│    → obtenerSenalesExpansionPorComuna() / obtenerTendenciasConstruccionPorComuna() │
│    renders: filter form + Histograma (client) + list of cards                │
│    NEW: each card gets a "Ver detalle" <Link> + a client checkbox (island)   │
├────────────────────────────────────────────────────────────────────────────────┤
│  NEW  app/.../oportunidades/[id]/page.tsx  (Server Component)                 │
│    params.id → obtenerOportunidadPorId(id)     [NEW fn, lib/mercado-locales-server.ts] │
│    → same senales/tendencias lookups, single-comuna                          │
│    renders: KpiCard + GaugeArc (posición en banda) + DesviacionBar + historial │
│    "Exportar informe (single)" button → lib/informe-oportunidades-pdf.ts      │
├────────────────────────────────────────────────────────────────────────────────┤
│  NEW  app/.../oportunidades/comparar/page.tsx  (Server Component)             │
│    searchParams.ids ("uuid,uuid,uuid") → obtenerOportunidadesPorIds(ids)      │
│    [NEW fn, batched like compararPortafolioConMercado()]                     │
│    renders: side-by-side table/grid, RankingBarChart, DesviacionBar per fila │
│    "Exportar informe (comparación)" button → lib/informe-oportunidades-pdf.ts │
├────────────────────────────────────────────────────────────────────────────────┤
│  REFACTORED  lib/mercado-locales-server.ts                                    │
│    evaluarOportunidad(listing, cohort, historial) → { reasonCodes, precios } │
│    ← used by obtenerOportunidadesMercadoLocales() (list, unchanged behavior) │
│    ← used by obtenerOportunidadPorId()            (NEW)                     │
│    ← used by obtenerOportunidadesPorIds()         (NEW)                     │
├────────────────────────────────────────────────────────────────────────────────┤
│  NEW  lib/informe-oportunidades-pdf.ts  (client-side, jsPDF, no pdfjs-dist)  │
│    generarInformeOportunidadPDF(oportunidad)                                 │
│    generarInformeOportunidadesComparadasPDF(oportunidades[])                 │
├────────────────────────────────────────────────────────────────────────────────┤
│  Supabase (unchanged schema)                                                  │
│    mercado_locales_listings          (id uuid PK, status, RLS: read-open)    │
│    mercado_locales_historial_precio  (listing_id FK)                        │
│    mercado_locales_stats_diarias     (bandas por comuna×operación×tipo)      │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modified |
|-----------|-----------------|-----------------|
| `oportunidades/page.tsx` | Lista filtrada + histograma (existente) | **Modified** — agrega link de detalle + checkbox de selección |
| `oportunidades/[id]/page.tsx` | Ficha de detalle de una oportunidad (Server Component) | **New** |
| `oportunidades/comparar/page.tsx` | Comparación lado a lado de N oportunidades (Server Component) | **New** |
| `lib/mercado-locales-server.ts` | Fuente de verdad de scoring + lecturas por id/lote | **Modified** (refactor interno) + funciones nuevas |
| `lib/informe-oportunidades-pdf.ts` | Generación de PDF (detalle y comparación) | **New** |
| `components/mercado-inmobiliario/selector-comparacion.tsx` | Checkbox + botón flotante "Comparar (N)" — client island | **New** |
| `components/mercado-inmobiliario/exportar-informe-oportunidades-button.tsx` | Botón cliente que invoca `lib/informe-oportunidades-pdf.ts` | **New** |
| `components/mercado-inmobiliario/charts/*` | KpiCard, GaugeArc, DesviacionBar, RankingBarChart, Histograma | **Reused as-is**, sin cambios |

## Answering the three questions directly

### (1) Ruta `/oportunidades/[id]` vs. panel/drawer client-side

**Decisión: ruta `/oportunidades/[id]`, Server Component.** No panel/drawer.

Evidencia contra la premisa del brief: `obtenerOportunidadesMercadoLocales()` en `lib/mercado-locales-server.ts:372-521` lee de `mercado_locales_listings` (tabla real, `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, ver `supabase/migrations/20260802_mercado_locales_listings.sql:13-14`) y ya devuelve ese `listing.id` sin transformar como `OportunidadMercadoLocal.id` (línea 505). Hoy se usa solo como `key` de React en el `.map()` de la página — el id estable **ya existe**, simplemente no está expuesto como ruta.

Por qué Server Component (no drawer client-side):
- `oportunidades/page.tsx` es hoy uno de los pocos Server Components puros del módulo (junto a `macro/`, `cadenas/`, `noticias/`) — sin `"use client"`, `async function`, lee `searchParams`, llama funciones de `lib/*-server.ts` directo. Un detalle en drawer forzaría convertir la página entera a cliente y refetchear todo vía una API route nueva, exactamente el patrón más pesado que usan `mi-cartera/`, `tasacion/`, `pricing/` — páginas que SÍ necesitan ese patrón porque tienen edición/mutación en vivo. Oportunidades no edita nada: es 100% lectura, el ajuste natural es un Server Component, igual que hoy.
- El proyecto ya tiene el folder-convention `[id]` como Server Component de solo-vista en 7 lugares distintos (`proyectos/[id]`, `terrenos/[id]`, `cadenas/[id]`, `clientes/[id]`, `municipios/[id]`, `prospectos/[id]`, `cadenas-comerciales/[id]`), y el API-route-convention `params: Promise<{ id: string }>` en `app/api/propiedades-portafolio/[id]/route.ts:41-44` — Next.js App Router async-params, mismo patrón a seguir.
- Reusa exactamente los mismos client chart components que ya cruzan la frontera Server→Client en este módulo hoy: `oportunidades/page.tsx` ya le pasa datos serializables a `<Histograma>` (client component); `macro/page.tsx` hace lo mismo con `<IndicadorMacroChart>`; `cadenas/page.tsx` con `<RankingBarChart>`. El detalle simplemente añade `<GaugeArc>` y `<DesviacionBar>` al mismo patrón — sin componentes nuevos de gráfico.
- Ventaja práctica sobre un drawer: la ficha es linkeable/compartible (`/oportunidades/{id}`), abre directo desde el informe PDF exportado (el PDF puede incluir la URL de la ficha), y sobrevive a un refresh — nada de esto existe gratis con un drawer.

Caveat real a manejar (no un bloqueador, pero debe diseñarse explícito): un listing puede pasar a `status = 'dado_de_baja'` en cualquier momento (columna existente, ver migración línea 30). La ficha de detalle **no debe hacer 404 por eso** — debe seguir mostrando la fila (precio, comuna, historial, badges) con un aviso "Este aviso ya no está activo en el portal" cuando `status !== 'activo'`, porque el caso de uso real ("¿por qué esta oportunidad que vi la semana pasada ya no aparece? ¿se vendió?") es información, no un error. Solo el caso "id no existe en absoluto" es un verdadero 404.

### (2) Selección para comparar: URL querystring, no Zustand/Context

**Decisión: querystring de ids en la ruta `/oportunidades/comparar?ids=uuid1,uuid2,uuid3`**, construida por un client component aislado ("island") en la lista, no un store global.

Evidencia revisada:
- `package.json` no tiene `zustand` ni ninguna librería de estado global — verificado (`grep -rl zustand package.json` sin resultados).
- **Mi Cartera** (`mi-cartera/page.tsx`) — la página con más estado de todo el módulo — usa `useState` scoped a esa única página cliente (`filas`, `expandido`, `form`, `consultandoSii`), nunca algo compartido entre rutas.
- **Terrenos** (`app/(dashboard)/terrenos/page.tsx`) tiene 12+ `useState` de filtros, todos locales a la página — sin ningún precedente de selección multi-fila para comparar en ningún punto del código actual (se buscó explícitamente: `grep -rl "seleccionados\|selectedIds"` no encontró nada relacionado a comparación).
- **El propio `oportunidades/page.tsx` y `reportes/page.tsx`** son los dos casos reales de estado-en-URL en este módulo: el primero via `<form method="GET">` (submit completo), el segundo via `useSearchParams().get("comuna")` leído para pre-poblar un form cliente. La comparación es una extensión natural del segundo patrón: no cada checkbox necesita URL-sync en vivo (eso sí sería un mal fit para un `<form GET>` con muchos checkboxes), pero el resultado final de la selección sí viaja como querystring al navegar a `/oportunidades/comparar`.

Implementación concreta recomendada:
- Nuevo client component `components/mercado-inmobiliario/selector-comparacion.tsx` (`"use client"`), recibe como prop la lista de oportunidades ya renderizadas por el Server Component (`{id, titulo, comuna, precioUfNormalizado}[]` — datos planos, serializables, mismo criterio ya documentado en el comentario de `histograma.tsx` sobre no pasar funciones de Server a Client). Mantiene `useState<string[]>` local con los ids marcados, muestra un botón flotante "Comparar (N)" que aparece solo cuando N ≥ 2, y al click hace `router.push(\`/oportunidades/comparar?ids=${ids.join(",")}\`)`.
- Tope simple de selección (ej. 5): mismo criterio de guardrail ya usado en `DistribucionDonut` ("nunca más de 5-6 categorías, si hay más un donut deja de comunicar") — una comparación de 8+ oportunidades tampoco comunica nada, cortar en el cliente es una validación de UX, no una limitación técnica.
- La página `/oportunidades/comparar/page.tsx` (Server Component) parsea `searchParams.ids`, hace `.split(",")`, valida que sean UUIDs (regex simple, descarta basura), y llama a la nueva `obtenerOportunidadesPorIds(ids)`.
- **No se necesita persistencia de "listas de comparación guardadas"** para este milestone — es explícitamente fuera de alcance (ver Anti-Patterns más abajo). Si se pidiera después, ahí sí haría falta una tabla nueva (`workspace_id`, ids, nombre) — hoy no.

### (3) Informe exportable: módulo nuevo `lib/informe-oportunidades-pdf.ts`, no extender `informe-pdf.ts`

**Decisión: archivo nuevo**, hermano de `lib/informe-pdf.ts`, mismas convenciones de bajo nivel, cero acoplamiento de dominio.

Evidencia revisada en `lib/informe-pdf.ts` (689 líneas):
- Es explícitamente "autocontenido" para un dominio distinto — su propio comentario de cabecera dice "Generación del informe PDF profesional del due diligence (portada con riesgo, estado DOM, hallazgos, próximos pasos y documentos + una página por lámina de plano anotada)". Cada función interna (`drawCoverPage`, `drawCuadroBlock`, `drawLaminaLeyenda`, `burnLamina`, `pdfUrlToImages`) está parametrizada sobre tipos de Due Diligence (`DueDiligenceResult`, `Anotacion`, `CuadroResultado`) — no hay una capa neutra separable sin tocar el archivo.
- Arrastra `pdfjs-dist` (rasterización de PDFs de planos a canvas) — maquinaria que Oportunidades **no necesita en absoluto** (no hay planos, no hay anotaciones, no hay imágenes que rasterizar). Importar ese módulo solo para reusar 3 helpers de dibujo de 10 líneas cada uno sería net-negative: más código cargado client-side, cero necesidad real.
- El proyecto ya tiene precedente explícito de **duplicar pequeños helpers puros en vez de forzar un import cruzado de dominio**: `lib/informe-charts.ts` duplica `parsearNumeroChileno` (comentario: "mismo parser que app/api/sii/lookup/route.ts... duplicado acá (función pura de 5 líneas) en vez de importar desde una ruta API"). El mismo criterio aplica acá: los 2-3 helpers realmente genéricos de `informe-pdf.ts` (`sectionRule()`, `hexToRgb()`, `formatGeneradoEl()`) se reescriben en 15 líneas dentro del archivo nuevo — no se factorizan a un tercer módulo compartido, porque el proyecto explícitamente prefiere esa pequeña duplicación sobre una abstracción prematura.

Estructura recomendada del módulo nuevo (mucho más simple que su hermano):
```typescript
// lib/informe-oportunidades-pdf.ts
// Informe de Oportunidades de Mercado — a diferencia de lib/informe-pdf.ts
// (Due Diligence: láminas anotadas + hallazgos normativos), este informe no
// tiene planos ni anotaciones: es una portada + tabla comparativa sobre
// datos que la ficha/comparación ya muestran en pantalla. Sin pdfjs-dist.

export async function generarInformeOportunidadPDF(oportunidad: OportunidadDetalle): Promise<void> { ... }
export async function generarInformeOportunidadesComparadasPDF(oportunidades: OportunidadDetalle[]): Promise<void> { ... }
```
Contenido: portada con filtros aplicados + fecha de generación (`formatGeneradoEl`-equivalent) + tabla/grid con, por oportunidad: título, comuna, precio UF, UF/m², reasonCodes traducidos (reusar el `REASON_LABEL` hoy inline en `oportunidades/page.tsx` — moverlo a un export compartido, ver Build Order), variación vs. mediana de cohorte, señales cruzadas (expansión de cadena / tendencia INE) si existen. Nunca fabrica datos que la pantalla no tenga — mismo principio ya aplicado en `informe-pdf.ts` (portada solo muestra `result.resumenEjecutivo` si existe, nunca lo inventa).

Trigger: mismo patrón de botón — un componente cliente (`exportar-informe-oportunidades-button.tsx`, `"use client"`) importado dentro de la página Server Component de detalle y de comparación, que en el `onClick` hace `const mod = await import("jspdf")` (dynamic import, igual que `informe-pdf.ts` línea 658) y llama la función correspondiente con los datos ya recibidos por props (no hace fetch propio — los datos ya están en la página, a diferencia de `generarInformePDF` que sí vuelve a consultar Supabase porque su caller vive en una página cliente separada sin esos datos ya cargados).

## Recommended Project Structure (delta sobre lo existente)

```
app/(dashboard)/mercado-inmobiliario/oportunidades/
├── page.tsx                    # MODIFICADO — + Link a detalle, + <SelectorComparacion>
├── [id]/
│   └── page.tsx                # NUEVO — Server Component, ficha de detalle
└── comparar/
    └── page.tsx                # NUEVO — Server Component, comparación lado a lado

lib/
├── mercado-locales-server.ts   # MODIFICADO — extrae evaluarOportunidad(), + obtenerOportunidadPorId(), + obtenerOportunidadesPorIds()
├── informe-oportunidades-pdf.ts # NUEVO — hermano de informe-pdf.ts, sin pdfjs-dist
└── mercado-locales-reason-labels.ts # NUEVO (pequeño) — REASON_LABEL movido desde oportunidades/page.tsx para reusar en detalle/comparación/PDF

components/mercado-inmobiliario/
├── selector-comparacion.tsx              # NUEVO — client island, checkbox + botón flotante
└── exportar-informe-oportunidades-button.tsx # NUEVO — client island, botón que invoca el PDF
```

### Structure Rationale

- **`[id]/` y `comparar/` como subcarpetas de `oportunidades/`, no rutas top-level**: sigue el mismo anidamiento que `cadenas-comerciales/[id]/centros/[centroId]` ya usa en este proyecto para jerarquías padre-hijo — la URL comunica la relación (`/oportunidades/{id}` es "una oportunidad de la lista de oportunidades").
- **`mercado-locales-reason-labels.ts` separado en vez de seguir inline en `page.tsx`**: hoy `REASON_LABEL` vive como constante privada dentro de `oportunidades/page.tsx` (líneas 16-20). En cuanto una segunda página (detalle) o un módulo no-React (el PDF) necesitan la misma traducción de código→texto, mantenerla inline deja de ser sostenible — extraerla es el mínimo movimiento necesario, no una reestructuración grande.
- **PDF module fuera de `components/`, en `lib/`**: seguir la convención exacta de `lib/informe-pdf.ts` (lógica de generación, no JSX) — el componente de botón en `components/` es una capa fina que solo llama a `lib/informe-oportunidades-pdf.ts`, igual que `planos-anotados.tsx` llama a `generarInformePDF`.

## Architectural Patterns

### Pattern 1: Server Component + client chart "islands" (ya establecido, se extiende)

**What:** La página es un Server Component async que hace todo el data-fetching server-side (Supabase vía `createServiceClient()`) y le pasa props planos y serializables a componentes de gráfico marcados `"use client"`. Ningún componente de gráfico acepta funciones como prop.
**When to use:** Cualquier vista de solo-lectura del módulo Mercado Inmobiliario — es el patrón por defecto de 4 de las 9 páginas (`oportunidades`, `macro`, `cadenas`, `noticias`).
**Trade-offs:** Sin esto se gana simplicidad (sin loading states, sin API routes intermedias) pero se pierde interactividad fina (no hay "cargar más" sin nueva navegación) — aceptable para detalle/comparación porque son vistas de análisis, no de edición.
**Example (ya en el código, `histograma.tsx` línea 20-26):**
```typescript
// Sin prop de formateo custom a propósito: un `formatTramo?: (n) => string`
// es una función que un Server Component no puede pasar a este Client
// Component (rompe la frontera de serialización de RSC — bug ya visto dos
// veces en este proyecto, en Cadenas y Oportunidades).
```
El detalle y la comparación deben respetar la misma regla al pasarle datos a `<GaugeArc>`/`<DesviacionBar>`/`<RankingBarChart>`.

### Pattern 2: Extracción de cálculo puro a `lib/*.ts` testeable (convención explícita del proyecto)

**What:** Cualquier lógica de negocio no trivial (cap rate, estado de obligación, y ahora scoring de oportunidad) vive en una función pura exportada de `lib/`, nunca inline dentro de un componente.
**When to use:** Siempre que la misma lógica deba producir el mismo resultado en dos lugares — acá, list view y detail/comparison view deben marcar `reasonCodes` de forma idéntica para el mismo listing.
**Trade-offs:** Un archivo extra de indirección, a cambio de eliminar el riesgo real de que el detalle diga "no es oportunidad" para un listing que la lista sí marcó (o viceversa) por una lógica duplicada que diverge con el tiempo.
**Example (patrón existente a replicar, `lib/propiedades-portafolio-server.ts:133-139`):**
```typescript
export function calcularCapRatePropiedad(prop: PropiedadPortafolio): CapRateResultado | null {
  if (prop.operacion !== 'arriendo') return null
  if (prop.precioActualUf === null || prop.precioActualUf === undefined) return null
  if (prop.siiAvaluoFiscalUf === null || prop.siiAvaluoFiscalUf === undefined) return null
  return calcularCapRate({ rentaMensual: prop.precioActualUf, precioVenta: prop.siiAvaluoFiscalUf })
}
```
La función nueva `evaluarOportunidad(listing, cohort, historialReciente)` debe seguir la misma forma: entradas explícitas, sin leer nada de Supabase por su cuenta, testeable sin mocks de red.

### Pattern 3: Fetch en lote para evitar N+1 (ya establecido en Mi Cartera)

**What:** Cuando se necesita el mismo tipo de dato para varios ids (o varias combinaciones comuna×operación×tipo), se hace **una** consulta agrupada con caché en memoria por el request, no una consulta por fila.
**When to use:** `obtenerOportunidadesPorIds(ids: string[])` para la vista de comparación — hasta 5 ids, pero el patrón importa igual.
**Trade-offs:** Un poco más de código de agrupación, a cambio de no repetir N consultas idénticas a `mercado_locales_stats_diarias` cuando varias oportunidades comparadas caen en la misma comuna/operación/tipo.
**Example (patrón existente a replicar, `lib/propiedades-portafolio-server.ts:88-97`):**
```typescript
export async function compararPortafolioConMercado(propiedades: PropiedadPortafolio[]): Promise<Map<string, ComparacionMercado>> {
  const bandasCache = new Map<string, Promise<BandasMercadoLocal | null>>()
  function bandasPara(p: PropiedadPortafolio): Promise<BandasMercadoLocal | null> {
    const key = `${p.comuna}|${p.operacion}|${p.tipoPropiedad}`
    if (!bandasCache.has(key)) bandasCache.set(key, obtenerBandasMercadoLocales(p.comuna, p.operacion, p.tipoPropiedad))
    return bandasCache.get(key)!
  }
  ...
}
```

## Data Flow

### Detalle de una oportunidad

```
Usuario click "Ver detalle" en oportunidades/page.tsx
    ↓
GET /oportunidades/{id}
    ↓
[id]/page.tsx (Server Component)
    → obtenerOportunidadPorId(id)          [lib/mercado-locales-server.ts, NUEVO]
        → SELECT * FROM mercado_locales_listings WHERE id = $1   (createServiceClient, sin filtro workspace)
        → obtenerBandasMercadoLocales(comuna, operacion, tipoPropiedad)  [existente]
        → SELECT historial de mercado_locales_historial_precio WHERE listing_id = $1  [tabla existente]
        → evaluarOportunidad(listing, cohort, historial)   [extraído, NUEVO]
    → obtenerSenalesExpansionPorComuna([comuna])   [existente, reusado con array de 1]
    → obtenerTendenciasConstruccionPorComuna([comuna])  [existente, reusado con array de 1]
    ↓
Render: KpiCard (precio, UF/m²) + GaugeArc (posición vs. P25/mediana/P75) + DesviacionBar + tabla de historial + badges de señales
    ↓
<ExportarInformeOportunidadesButton oportunidad={...}/>  (client island)
    → onClick → lib/informe-oportunidades-pdf.ts::generarInformeOportunidadPDF()  → jsPDF → download
```

### Comparación de N oportunidades

```
Usuario marca 2-5 checkboxes en oportunidades/page.tsx (SelectorComparacion, client island)
    ↓
router.push("/oportunidades/comparar?ids=uuid1,uuid2,uuid3")
    ↓
comparar/page.tsx (Server Component)
    → parsea + valida searchParams.ids
    → obtenerOportunidadesPorIds(ids)   [lib/mercado-locales-server.ts, NUEVO — fetch en lote, ver Pattern 3]
    ↓
Render: tabla comparativa + RankingBarChart (ranking UF/m² entre las N) + DesviacionBar por fila
    ↓
<ExportarInformeOportunidadesButton oportunidades={[...]}/>  (client island)
    → onClick → lib/informe-oportunidades-pdf.ts::generarInformeOportunidadesComparadasPDF()  → jsPDF → download
```

### Key Data Flows

1. **Scoring compartido:** `evaluarOportunidad()` es la única fuente de verdad de "por qué esto es una oportunidad" — list, detail y comparison todos la llaman, ninguno reimplementa el cálculo.
2. **Sin nueva escritura a Supabase:** todo este milestone es de lectura pura sobre tablas ya existentes (`mercado_locales_listings`, `mercado_locales_historial_precio`, `mercado_locales_stats_diarias`) — no hay migración de schema requerida.

## Scaling Considerations

| Concern | Hoy (dataset actual) | Si crece 10x | Si crece 100x |
|---------|----------------------|----------------|-----------------|
| Detalle por id | 1 SELECT por PK, trivial | Sin cambios — index en PK ya existe | Sin cambios |
| Comparación (batch) | ≤5 ids, `.in()` directo | Sin cambios (tope de UX sigue en 5) | Sin cambios |
| Informe PDF | Generado client-side, ≤5 filas | Sin cambios | Si se pidiera exportar 50+ oportunidades, reconsiderar generación server-side — no es el caso de este milestone |

### Scaling Priorities

No hay cuello de botella real esperado en este milestone: el volumen relevante (N oportunidades comparadas) está acotado por diseño a un puñado, y el detalle es una sola fila por PK. El único límite real conocido en este módulo (documentado en `obtenerOportunidadesMercadoLocales`) es el corte de paginación de PostgREST a 1000 filas — no aplica acá porque el detalle/comparación consultan por id explícito, no por listado completo.

## Anti-Patterns

### Anti-Pattern 1: Persistir la selección de comparación en una tabla nueva desde el día 1

**What people do:** Ver "comparar oportunidades" y asumir que hace falta una tabla `oportunidades_comparaciones` (workspace_id, ids, nombre) para poder "guardar" comparaciones.
**Why it's wrong:** El caso de uso del milestone es "comparar ahora mismo, lado a lado" — no "guardar una comparación para volver la próxima semana". Una tabla nueva implica migración, RLS, API routes de CRUD, y UI de nombrar/listar comparaciones guardadas: todo eso es trabajo real para un caso de uso que nadie pidió todavía. El proyecto explícitamente prefiere simple sobre prematuro.
**Do this instead:** Querystring `?ids=...`. Es bookmarkeable/compartible por su cuenta (copiar el link YA es "guardar la comparación" para el caso de uso real de un corredor mandándosela a un colega por WhatsApp). Si más adelante se pide guardar con nombre, ahí sí se justifica la tabla — no antes.

### Anti-Pattern 2: Convertir `oportunidades/page.tsx` entero a `"use client"` para agregar los checkboxes

**What people do:** Ver que se necesita estado interactivo (selección) y asumir que toda la página debe volverse cliente, como `mi-cartera/page.tsx`.
**Why it's wrong:** Perdería el data-fetching directo server-side (habría que mover `obtenerOportunidadesMercadoLocales()` detrás de una API route nueva solo para poder llamarla desde un `useEffect`), duplicando trabajo que hoy no existe y descartando el Server Component que ya funciona bien.
**Do this instead:** Un client component chico y aislado (`SelectorComparacion`) que recibe los datos ya resueltos como props — exactamente el mismo patrón que `<Histograma>` ya prueba que funciona en esta misma página hoy.

### Anti-Pattern 3: Extender `lib/informe-pdf.ts` con un parámetro `tipo: "due-diligence" | "oportunidades"`

**What people do:** Ver dos features de "exportar PDF" y asumir que deben compartir un solo generador parametrizado.
**Why it's wrong:** Los dos informes no comparten estructura de datos (`DueDiligenceResult` vs. una lista de oportunidades), ni layout (láminas anotadas vs. tabla comparativa), ni dependencias (`pdfjs-dist` vs. nada). Forzar un solo módulo con una rama `if (tipo === ...)` en cada función de dibujo generaría el tipo de acoplamiento que el propio código ya evita hoy (compárese con `lib/informe-charts.ts`, que duplica un parser de 5 líneas antes que importar cruzado).
**Do this instead:** Módulo hermano nuevo, mismas convenciones de bajo nivel (jsPDF, `"use client"` caller, dynamic import), cero import cruzado de tipos de Due Diligence.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `oportunidades/page.tsx` ↔ `oportunidades/[id]/page.tsx` | `<Link href={`/oportunidades/${o.id}`}>` (navegación normal, no fetch) | El id ya viaja en el payload de `obtenerOportunidadesMercadoLocales()` hoy — solo falta el link |
| `oportunidades/page.tsx` ↔ `SelectorComparacion` (client) | Props planos (`{id, titulo, comuna, precioUfNormalizado}[]`) | Sin callbacks del padre — el hijo resuelve su propia navegación con `useRouter()` |
| `SelectorComparacion` ↔ `oportunidades/comparar/page.tsx` | `router.push()` con querystring | Mismo mecanismo que el `<form method="GET">` ya usado en la lista, solo que construido en cliente en vez de vía submit |
| `[id]/page.tsx` / `comparar/page.tsx` ↔ `lib/mercado-locales-server.ts` | Llamada directa server-to-server (`createServiceClient()`), igual que hoy | Sin API route intermedia — mismo patrón que `oportunidades/page.tsx` ya usa |
| `[id]/page.tsx` / `comparar/page.tsx` ↔ `ExportarInformeOportunidadesButton` (client) | Props planos con los datos ya cargados por el Server Component | A diferencia de `generarInformePDF` (que sí vuelve a consultar Supabase porque su caller vive en una página cliente sin esos datos), acá el botón recibe los datos ya resueltos — no hace su propio fetch |
| `ExportarInformeOportunidadesButton` ↔ `lib/informe-oportunidades-pdf.ts` | Import + `await` directo, dynamic `import("jspdf")` dentro | Mismo patrón que `planos-anotados.tsx` → `generarInformePDF` |

### External Services

Ninguno nuevo. Todo el dato ya vive en Supabase (`mercado_locales_listings`, `mercado_locales_historial_precio`, `mercado_locales_stats_diarias`) más las dos señales cruzadas ya integradas (`cadenas-sucursales-server.ts`, `ine-permisos-server.ts`). No se agrega ninguna llamada externa nueva.

## Build Order (respetando dependencias reales)

1. **Refactor de `lib/mercado-locales-server.ts`**: extraer la lógica de scoring del loop de `obtenerOportunidadesMercadoLocales()` (líneas ~475-517) a una función pura `evaluarOportunidad(listing, cohort, historialReciente)`. Verificar con un test/comparación manual que `obtenerOportunidadesMercadoLocales()` sigue devolviendo exactamente los mismos resultados post-refactor (comportamiento no debe cambiar, solo la forma). **Todo lo demás depende de este paso** — sin scoring reusable, el detalle y la comparación no pueden marcar `reasonCodes` de forma consistente con la lista.
2. **Mover `REASON_LABEL` a `lib/mercado-locales-reason-labels.ts`** (o similar), actualizar el import en `oportunidades/page.tsx`. Trivial, sin dependencias, se puede hacer en paralelo al paso 1.
3. **`obtenerOportunidadPorId(id)`** en `lib/mercado-locales-server.ts`, usando `evaluarOportunidad()` del paso 1. Depende del paso 1.
4. **`app/.../oportunidades/[id]/page.tsx`** (Server Component) + link "Ver detalle" agregado a las cards de `oportunidades/page.tsx`. Depende del paso 3.
5. **`SelectorComparacion` (client island)** + integrarlo en `oportunidades/page.tsx`. Sin dependencia de los pasos 3-4 — se puede construir en paralelo, ya que solo necesita los ids que la lista ya tiene.
6. **`obtenerOportunidadesPorIds(ids[])`** en `lib/mercado-locales-server.ts` (fetch en lote, Pattern 3), usando `evaluarOportunidad()` del paso 1. Depende del paso 1.
7. **`app/.../oportunidades/comparar/page.tsx`** (Server Component). Depende de los pasos 5 (para tener cómo llegar ahí) y 6 (para tener qué mostrar).
8. **`lib/informe-oportunidades-pdf.ts`** + `ExportarInformeOportunidadesButton`, integrado en los pasos 4 y 7. Se construye último porque su forma de datos depende de qué campos terminen mostrando el detalle y la comparación — construirlo antes arriesga tener que rehacerlo si cambia la forma de los datos en los pasos anteriores.

## Sources

- `supabase/migrations/20260802_mercado_locales_listings.sql` — schema real de `mercado_locales_listings` (id uuid PK, RLS read-open, sin workspace_id) y `mercado_locales_historial_precio`
- `lib/mercado-locales-server.ts` — `obtenerOportunidadesMercadoLocales()`, `obtenerBandasMercadoLocales()`, patrón de paginación y de fallback citywide
- `lib/propiedades-portafolio-server.ts` — `calcularCapRatePropiedad()`, `compararPortafolioConMercado()` (precedentes directos de Pattern 2 y Pattern 3)
- `lib/informe-pdf.ts` — módulo de referencia para convenciones de generación de PDF client-side (dynamic import, `pdf.save()`), y motivo de por qué NO extenderlo
- `lib/informe-charts.ts` — precedente explícito de duplicar helpers puros pequeños en vez de importar cruzado
- `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx`, `reportes/page.tsx`, `mi-cartera/page.tsx`, `macro/page.tsx`, `cadenas/page.tsx` — precedentes de Server Component vs. Client Component en el módulo
- `components/mercado-inmobiliario/charts/histograma.tsx`, `kpi-card.tsx`, `ranking-bar-chart.tsx`, `gauge-arc.tsx`, `distribucion-donut.tsx` — librería de gráficos a reusar sin modificar
- `app/api/propiedades-portafolio/[id]/route.ts` — convención `params: Promise<{ id: string }>` de Next.js App Router usada en este proyecto

---
*Architecture research for: PermisoHub — módulo Mercado Inmobiliario, feature Oportunidades (detalle/comparación/informe)*
*Researched: 2026-08-02*
