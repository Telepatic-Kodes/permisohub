# Phase 15: Informe Exportable - Research

**Researched:** 2026-08-02
**Domain:** Vista imprimible/exportable (Next.js App Router Server Components + `@media print`) de una oportunidad individual o de una comparación de oportunidades, sobre datos ya producidos por las Fases 13 y 14
**Confidence:** HIGH

## Summary

Esta fase no introduce datos ni lógica de negocio nuevos — es una vista de impresión de lo que `/oportunidades/[id]` (Fase 13) y `/oportunidades/comparar` (Fase 14) ya calculan y muestran en pantalla, verificado leyendo el código real de ambas fases (ya completas: 9/9 y 12/12 must-haves). El proyecto tiene **dos precedentes en producción** del patrón HTML + `@media print` (`app/(dashboard)/clientes/[id]/informe/page.tsx` y `app/(dashboard)/cadenas-comerciales/[id]/compliance/page.tsx`), ambos leídos en full para esta investigación, y ambos confirman: ruta hermana separada (no un toggle de query-param sobre la página existente), botón "Imprimir" que llama `window.print()`, CSS con `@page` + una clase para ocultar el toolbar en impresión. Ninguno de los dos usa jsPDF/html2canvas — ninguno tampoco contiene un gráfico Recharts, lo cual es un hallazgo honesto (ver Open Questions): la afirmación de que "Recharts imprime como SVG vectorial vivo" no está verificada en este repo, solo en teoría general de la plataforma web.

Los datos que la fase debe consumir ya existen con la forma exacta necesaria: `OportunidadDetalle` (`lib/mercado-locales-server.ts:594-613`) para INFO-01, y `OportunidadDetalle[]` + `Record<string, number|null>` de rentabilidad (mismo tipo, ya usado por `TablaComparacion`) para INFO-02. Los dos campos que pide INFO-03 ("fecha de generación Y fecha de última verificación por dato") ya existen sin cálculo adicional: `oportunidad.ultimaVezVistoEl` (timestamptz, por fila) y `oportunidad.bandas?.statsDate` (date-only, vigencia de la banda de cohorte). INFO-04 ("preparado por/para") no tiene ningún precedente de campo de formulario editable en un informe existente — debe construirse como un client island nuevo y pequeño, sin persistencia, siguiendo el mismo criterio de "simple sobre prematuro" que ya rige el resto del proyecto.

**Primary recommendation:** Usar el patrón `@media print` + `window.print()`, sin jsPDF/html2canvas, en dos rutas hermanas nuevas (`/oportunidades/[id]/informe` y `/oportunidades/comparar/informe`), Server Components que re-consultan `lib/mercado-locales-server.ts` directamente (sin API route intermedia). Reservar jsPDF+html2canvas para un caso extendido futuro no pedido por INFO-01..04 (PDF real sin usuario presente).

## User Constraints

No existe CONTEXT.md para esta fase — no se ejecutó `/gsd:discuss-phase`. No hay decisiones de usuario bloqueadas que honrar; el brief de ROADMAP.md/REQUIREMENTS.md (INFO-01..04) es la única fuente de alcance. La decisión de arquitectura `@media print` vs. jsPDF+html2canvas, que el research de milestone dejó explícitamente pendiente de founder, se resuelve en este documento con una recomendación por defecto defendible (ver Open Questions) — el planner debe adoptarla salvo que el usuario indique lo contrario.

## Standard Stack

### Core

| Tecnología | Versión | Propósito | Por qué es el estándar de este repo |
|------------|---------|-----------|--------------------------------------|
| Vista HTML + `@media print` (React Server/Client Components, Next 16 App Router) | React 19.2.4 / Next ^16.2.12 (`package.json`) | Portada + cuerpo + metodología, imprimible/exportable a PDF vía el navegador | Dos precedentes en producción ya leídos en full: `app/(dashboard)/clientes/[id]/informe/page.tsx` y `app/(dashboard)/cadenas-comerciales/[id]/compliance/page.tsx` + `print-button.tsx`. Cero dependencias nuevas. |
| `lib/mercado-locales-server.ts` (ya existe, Fase 13/14) | — | `obtenerOportunidadPorId`, `obtenerOportunidadesPorIds`, `obtenerComparablesOportunidad`, `obtenerBandasMercadoLocales` | Funciones server-to-server ya probadas por Fase 13/14 — el informe las re-invoca directo, sin fetch a una API route (mejor que ambos precedentes existentes, ver Architecture Patterns). |
| `lib/formato-fecha.ts` (`formatFechaCorta`, ya existe) | — | Formatear `bandas.statsDate` (date-only) | Ya extraído en Fase 13 exactamente para este propósito (comentario de cabecera del archivo lo dice explícito: "antes de escribir el primer componente nuevo que muestre fechas"). |

### Supporting (no requieren `npm install`, ya resueltos en `node_modules`)

| Library | Purpose | Cuándo usarla en esta fase |
|---------|---------|------------------------------|
| `jspdf` (^4.2.1) / `html2canvas` (1.4.1, transitiva de jspdf) | PDF descargable real sin usuario presente | Solo si el founder confirma el caso extendido (ver Open Questions) — no para el MVP de INFO-01..04 |
| `pdfkit` (^0.19.1) | PDF 100% server-side | Ya usado en `app/api/cadenas/[id]/reporte/route.ts` — no aplica a este caso porque el usuario está presente y logueado |

### Alternatives Considered

| Instead of | Podría usarse | Cuándo tendría sentido |
|------------|----------------|--------------------------|
| `@media print` + `window.print()` | `jsPDF` + `pdf.html()` + `html2canvas` sobre el mismo HTML | Cuando se necesite un `.pdf` real sin intervención del usuario (adjunto de email automático, guardado en Supabase Storage) — reutilizando el mismo markup, no reconstruyendo el layout dos veces |
| `@media print` + `window.print()` | `lib/informe-oportunidades-pdf.ts` nuevo (jsPDF client-side, calcado de `lib/informe-pdf.ts`) | Nunca para este alcance — ver Open Questions, esta opción está en ARCHITECTURE.md (research de milestone) pero contradice STACK.md/PITFALLS.md del mismo research pass; jsPDF exige redibujar todo a primitivas o rasterizar con html2canvas, sin ganar nada sobre `@media print` para el caso "usuario logueado quiere ver/imprimir/guardar" |

**Installation:**
```bash
# Ninguna instalación nueva requerida.
```

## Architecture Patterns

### Recommended Project Structure

```
app/(dashboard)/mercado-inmobiliario/oportunidades/
├── [id]/
│   ├── page.tsx                 # EXISTENTE (Fase 13) — sin cambios de datos
│   └── informe/
│       └── page.tsx             # NUEVO — Server Component, re-consulta obtenerOportunidadPorId + obtenerComparablesOportunidad
└── comparar/
    ├── page.tsx                 # EXISTENTE (Fase 14) — sin cambios de datos
    └── informe/
        └── page.tsx             # NUEVO — Server Component, lee ?ids= (mismo parseo/validación que comparar/page.tsx), obtenerOportunidadesPorIds

components/mercado-inmobiliario/informe/
├── print-button.tsx             # NUEVO — client island, calcado de cadenas-comerciales/[id]/compliance/print-button.tsx
├── preparado-por-para.tsx       # NUEVO — client island, 2 inputs controlados, sin persistencia
└── (secciones de portada/cuerpo/metodología reusadas entre las 2 rutas — ver Pattern 2)

lib/formato-fecha.ts             # MODIFICADO — agregar formatTimestampCorto (o similar) para timestamptz, extraído de historial-tab.tsx
```

### Pattern 1: Ruta hermana `/informe`, no un toggle sobre la página existente

**What:** El informe vive en su propia sub-ruta (`[id]/informe`, `comparar/informe`), un Server Component nuevo e independiente que vuelve a llamar la capa de datos — no recibe props de la página padre (Next.js App Router no permite eso entre segmentos de ruta hermanos de todas formas).
**When to use:** Siempre que se necesite una variante imprimible de una vista ya existente en este proyecto.
**Por qué (evidencia directa del repo):** Los DOS precedentes reales de este patrón hacen exactamente esto — `clientes/[id]/informe` es una ruta separada de `clientes/[id]`, y `cadenas-comerciales/[id]/compliance` es una ruta separada de `cadenas-comerciales/[id]`. Ninguno de los dos usa un query-param `?print=true` sobre la página original. Responde directamente la pregunta abierta del brief: **ruta nueva por fuente, no un modo parametrizado.**
**Mejora sobre ambos precedentes:** `clientes/[id]/informe` hace `fetch("/api/clientes/...")` client-side (`"use client"` + `useEffect`); `cadenas-comerciales/[id]/compliance` hace `fetch(`${baseUrl}/api/cadenas/${id}/compliance-export`)` server-side contra una API route propia. Ninguno de los dos patrones es necesario acá: `obtenerOportunidadPorId`/`obtenerOportunidadesPorIds`/`obtenerComparablesOportunidad`/`obtenerBandasMercadoLocales` son funciones server-to-server invocables directo desde un Server Component (exactamente como ya hacen `[id]/page.tsx` y `comparar/page.tsx` de las Fases 13/14) — sin API route intermedia, sin `"use client"` en la página completa.

**Example — estructura mínima de la nueva página (`[id]/informe/page.tsx`):**
```tsx
// Server Component — mismo patrón que oportunidades/[id]/page.tsx (Fase 13),
// re-consulta la capa de datos en vez de recibir props (no hay paso de props
// entre rutas hermanas en App Router).
export const dynamic = "force-dynamic"

export default async function InformeOportunidadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const oportunidad = await obtenerOportunidadPorId(id)
  if (!oportunidad) notFound()
  const comparables = await obtenerComparablesOportunidad({ /* mismos args que [id]/page.tsx */ })
  const generadoEl = new Date() // dynamic="force-dynamic" ya evita cache — timestamp real de render

  return (
    <>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          @page { size: A4 portrait; margin: 15mm 12mm; }
        }
      `}</style>
      {/* toolbar print:hidden con <PrintButton /> + <PreparadoPorPara /> */}
      {/* portada + cuerpo + metodología */}
    </>
  )
}
```
**Source:** patrón sintetizado de `app/(dashboard)/cadenas-comerciales/[id]/compliance/page.tsx:74-124` (Server Component async, `params: Promise<{ id: string }>`, toolbar `print:hidden`) + `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx:31-50` (mismo await de `obtenerOportunidadPorId`, `dynamic = "force-dynamic"`).

### Pattern 2: Tailwind `print:` variant, no CSS custom `.no-print`

**What:** Usar la clase utilitaria `print:hidden` de Tailwind (ya usada en `compliance/page.tsx:119` y `print-button.tsx:9`) en vez del patrón custom `.no-print { display: none !important }` definido a mano en un `<style>` block (usado en `clientes/[id]/informe/page.tsx:127-135`).
**When to use:** Para ocultar el toolbar/botones en impresión.
**Trade-off:** El proyecto tiene AMBOS convenciones en producción hoy — no hay una única "fuente de verdad". Se recomienda `print:` porque es el mecanismo nativo de Tailwind (cero CSS a mano) y es el patrón usado en el precedente más reciente/estructuralmente más parecido a Oportunidades (`compliance`, Server Component sin `"use client"` en la página completa — igual que `[id]/page.tsx`/`comparar/page.tsx` de Fases 13/14). El `@page { size: A4 portrait; margin: ... }` sigue necesitando un `<style>` inline (Tailwind no cubre reglas `@page`) — eso sí se replica de ambos precedentes.

### Pattern 3: Secciones de informe compartidas entre las 2 rutas (`[id]/informe` y `comparar/informe`)

**What:** Portada (título, comuna(s), fecha de generación, campo "preparado por/para"), sección de metodología/fuentes (muestra_n, universo de comparación, UF usado, disclaimer de vigencia) son estructuralmente las mismas piezas para INFO-01 e INFO-02 — solo el cuerpo difiere (ficha de 1 oportunidad vs. tabla comparativa).
**When to use:** Extraer 2-3 componentes de presentación puros (`PortadaInforme`, `MetodologiaInforme`) que ambas rutas importen, en vez de duplicar la sección de metodología dos veces.
**Trade-off:** Evita que la sección de metodología/disclaimer diverja entre el informe individual y el de comparación — mismo criterio de "una sola fuente de verdad" que ya aplicó Fase 13/14 al extraer `evaluarOportunidad()`. No se extrae el cuerpo (ficha vs. tabla) porque esos sí son estructuralmente distintos — igual que `TablaComparacion` (Fase 14) explícitamente NO reutiliza los `*-tab.tsx` de Fase 13 por ser layouts incompatibles (ver comentario en `tabla-comparacion.tsx:6-10`).

### Anti-Patterns to Avoid

- **Convertir la página del informe a `"use client"` con `useEffect` + fetch a una API route** (patrón de `clientes/[id]/informe/page.tsx`): innecesario acá porque los datos ya son accesibles server-to-server desde `lib/mercado-locales-server.ts`, exactamente como ya hacen las páginas de detalle/comparación de Fase 13/14. Usar ese patrón sería un paso atrás respecto al patrón ya establecido en este módulo.
- **Extender `lib/informe-pdf.ts` con un parámetro `tipo: "due-diligence" | "oportunidades"`**: confirmado leyendo el archivo — es 100% Due Diligence (`DueDiligenceResult`, `Anotacion`, rasterización de planos vía `pdfjs-dist`), sin una capa neutra separable. Si se activa jsPDF en el futuro para el caso extendido, debe ser un módulo hermano nuevo, nunca una rama condicional en este archivo.
- **Snapshotear con `html2canvas` cualquier gráfico Recharts que se incluya en el informe** (ver Common Pitfalls) — ninguno de los dos generadores de PDF del proyecto lo hace, y ninguno de los dos precedentes de `@media print` lo necesitó porque no tenían gráficos Recharts (ver Open Questions).

## Data Shapes (verificadas contra el código real de Fase 13/14)

### `OportunidadDetalle` — INFO-01, y cada fila de INFO-02

`lib/mercado-locales-server.ts:594-613`:
```typescript
export interface OportunidadDetalle {
  id: string
  titulo: string
  url: string
  comuna: string
  tipoPropiedad: TipoPropiedadComercial
  operacion: OperacionMercadoLocal
  status: 'activo' | 'dado_de_baja'
  dadoDeBajaEl: string | null       // timestamptz
  precioValido: boolean
  precioMonto: number
  precioMoneda: string
  superficieM2: number | null
  precioUfNormalizado: number        // 0 si precioValido=false — NUNCA tratar como precio real
  precioUfM2Normalizado: number | null
  reasonCodes: string[]
  primeraVezVistoEl: string          // timestamptz
  ultimaVezVistoEl: string           // timestamptz — candidato directo para "última verificación" (INFO-03)
  bandas: BandasMercadoLocal | null
}
```

### `BandasMercadoLocal` — metodología/fuentes

`lib/mercado-locales-server.ts:218-233`:
```typescript
export interface BandasMercadoLocal {
  comuna: string
  operacion: OperacionMercadoLocal
  statsDate: string          // DATE-ONLY (¡no timestamptz!) — usar formatFechaCorta
  muestraN: number
  medianaUf: number | null
  p25Uf: number | null
  p75Uf: number | null
  muestraAreaN: number
  medianaUfM2: number | null
  p25UfM2: number | null
  p75UfM2: number | null
  ufValorUsado: number
  usoFallback: boolean       // true = comparación citywide, no comuna (declarar en metodología)
  muestraNComuna: number     // N real de la comuna, aunque usoFallback sea true
}
```

### Funciones de datos ya existentes a re-invocar

| Función | Firma | Uso en el informe |
|---------|-------|---------------------|
| `obtenerOportunidadPorId(id: string)` | `Promise<OportunidadDetalle \| null>` | INFO-01, `lib/mercado-locales-server.ts:708` |
| `obtenerOportunidadesPorIds(ids: string[])` | `Promise<OportunidadDetalle[]>` | INFO-02, `lib/mercado-locales-server.ts:747` — fetch en lote, sin N+1 |
| `obtenerComparablesOportunidad(params)` | `Promise<ComparableOportunidad[]>` | Sección de comparables del informe individual, `lib/mercado-locales-server.ts:808` |
| `obtenerBandasMercadoLocales(comuna, operacion, tipoPropiedad)` | `Promise<BandasMercadoLocal \| null>` | Rentabilidad implícita de zona si el informe la incluye — mismo patrón que `comparar/page.tsx:114-129` |
| `calcularCapRate({ rentaMensual, precioVenta })` | de `lib/calculadora-inversion.ts` | Rentabilidad implícita de zona — ya usada en `[id]/page.tsx:59` y `comparar/page.tsx:124` |

### Tabla comparativa (INFO-02) — componente ya construido, no re-inventar

`components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx` (`TablaComparacion`) ya recibe `oportunidades: OportunidadDetalle[]` + `rentabilidadPorComuna: Record<string, number | null>`, ya implementa null-goes-last (nunca `?? 0`), ya excluye precio inválido de "gana la comparación", ya declara unidad por fila (UF vs. UF/m²). **El informe de comparación puede renderizar el mismo componente** (es JSX puro, sin `"use client"` — confirmado, no tiene `useState`/`useEffect`) dentro de la vista imprimible, en vez de reconstruir la tabla desde cero. Verificar en implementación si sus clases Tailwind (`bg-modulo-mercado-subtle`, etc.) sobreviven a `@media print` sin ajuste — es el único punto de fricción esperado, no una razón para no reutilizarlo.

## Common Pitfalls

### Pitfall 1: Recharts con `ResponsiveContainer` dentro del informe, sin haberlo probado impreso

**What goes wrong:** Ninguno de los dos precedentes de `@media print` en este repo (`clientes/[id]/informe`, `cadenas-comerciales/[id]/compliance`) contiene un gráfico Recharts — ambos son texto/tablas/barras de progreso CSS puras. La afirmación del research de milestone ("los gráficos Recharts imprimen como SVG vectorial vivo") es teóricamente correcta pero **no está verificada contra ningún caso real de este proyecto**. `ResponsiveContainer` (usado en `Histograma`, `RankingBarChart`, `DistribucionDonut`, el sparkline de `KpiCard`) mide su tamaño vía `ResizeObserver` sobre su contenedor DOM en pantalla; el comportamiento exacto al pasar a la hoja de estilos de impresión (`@media print`, tamaño de página A4 distinto al viewport) no tiene precedente verificado en este código.
**Why it happens:** Es fácil asumir que "ya se resolvió esto en el proyecto" citando el research de milestone sin notar que los dos ejemplos reales no ejercitan el caso Recharts+print.
**How to avoid:** Los widgets de "Posicionamiento" que la ficha de detalle (Fase 13) ya usa para el gráfico principal — `GaugeArc` (`components/mercado-inmobiliario/charts/gauge-arc.tsx:30`, SVG plano a mano) y `DesviacionBar` (`components/mercado-inmobiliario/charts/desviacion-bar.tsx:5-7`, comentario explícito: "Plano con CSS, no recharts") — **no usan Recharts en absoluto**. Recomendación: construir el cuerpo del informe (INFO-01/INFO-02) exclusivamente con `GaugeArc`/`DesviacionBar`/tablas/texto, evitando `Histograma`/`RankingBarChart`/`KpiCard` (los 3 con `ResponsiveContainer`) en la v1 del informe — elimina el riesgo por completo en vez de mitigarlo. Si se decide incluirlos de todas formas, probar impresión real a A4 (no solo el visor del navegador a 100%) antes de dar por cerrado el must-have.
**Phase to address:** Esta fase — es la primera vez que un gráfico de este módulo pasa por `@media print`.

### Pitfall 2: `precioUfNormalizado = 0` (precio inválido) tratado como precio real en el informe

**What goes wrong:** `construirOportunidadDetalle()` (`lib/mercado-locales-server.ts:640-700`) deja `precioUfNormalizado = 0` cuando `precioValido = false` — un `0` fabricado, no un precio real. `TablaComparacion` ya lo excluye correctamente de "gana la comparación" (`tabla-comparacion.tsx:38-41`), pero cualquier renderizado nuevo de portada/resumen para INFO-01 que muestre `precioUfNormalizado` sin chequear `precioValido` primero mostraría "0 UF" como si fuera el precio real.
**How to avoid:** Todo render nuevo del informe debe replicar la misma guarda ya usada en `[id]/page.tsx:132` (`oportunidad.precioValido ? ... : "Precio no disponible en moneda reconocida"`).
**Phase to address:** Esta fase, en la portada/resumen del informe individual.

### Pitfall 3: Reintroducir el bug de timezone al formatear `bandas.statsDate`

**What goes wrong:** `statsDate` es DATE-ONLY (`YYYY-MM-DD`), a diferencia de `primeraVezVistoEl`/`ultimaVezVistoEl`/`dadoDeBajaEl` que son `timestamptz`. Un `new Date(bandas.statsDate)` directo (sin `T00:00:00`) corre el riesgo de mostrar el día anterior en horario de Chile — el mismo bug ya ocurrido 5+ veces en este proyecto.
**How to avoid:** Usar `formatFechaCorta` (`lib/formato-fecha.ts`, ya existe) para `statsDate`; usar `new Date(iso)` directo (sin sufijo) para los 3 campos timestamptz. No existe hoy un helper exportado para formatear timestamptz con hora de Chile — `historial-tab.tsx:20-25` tiene uno local (`formatTimestamp`, no exportado). Recomendación: promoverlo a `lib/formato-fecha.ts` como función hermana exportada (ej. `formatTimestampCorto`) antes de escribir el primer componente del informe, para que el informe lo importe en vez de reescribirlo por tercera vez.
**Phase to address:** Esta fase, en la sección de metodología (fecha de banda) y en la fila de "última verificación" por oportunidad.

### Pitfall 4: Informe sin fecha de última verificación POR FILA (solo fecha de generación global)

**What goes wrong:** Es el pitfall explícitamente nombrado por INFO-03 y por PITFALLS.md del research de milestone (Pitfall 3, "snapshot invisible") — mostrar solo "Generado el {fecha}" sin una fecha de vigencia por dato/fila induce decisiones sobre datos obsoletos cuando el informe se comparte semanas después.
**How to avoid:** El campo ya existe y no requiere cálculo: `oportunidad.ultimaVezVistoEl` por fila (informe de comparación: una columna/nota por oportunidad; informe individual: una línea visible en el cuerpo, no solo en el pie). Adicionalmente, declarar `bandas.statsDate` como la fecha de vigencia de la banda de mercado usada para el benchmark — son dos vigencias distintas (la del listing y la de la banda de cohorte) y ambas deben ser visibles, no una sola fecha "genérica".
**Phase to address:** Esta fase (INFO-03 es su propio requirement).

### Pitfall 5: Ruta `/comparar/informe` no re-valida homogeneidad de tipo/operación

**What goes wrong:** `comparar/page.tsx` valida (paso 5, líneas 92-108) que los `ids` recibidos por querystring compartan `tipoPropiedad`/`operacion` — pero esa validación vive en esa página, no en `lib/mercado-locales-server.ts`. Si `/comparar/informe?ids=...` se construye como una ruta independiente que solo llama `obtenerOportunidadesPorIds(ids)` sin repetir la validación, un usuario que arme la URL a mano (o un link roto) podría llegar a un informe que mezcla arriendo/venta o tipos distintos.
**How to avoid:** Replicar exactamente el mismo bloque de validación (parseo UUID + rango 2-5 + `new Set(tipos).size===1 && new Set(operaciones).size===1`) en `comparar/informe/page.tsx`, tal como `comparar/page.tsx` ya lo hace — no asumir que "si llegó desde el botón de la página ya validada, está bien", porque la URL del informe es independiente y navegable directo.
**Phase to address:** Esta fase.

## Don't Hand-Roll

| Problem | No construir desde cero | Usar en su lugar | Por qué |
|---------|----------------------------|-------------------|---------|
| Tabla comparativa del informe (INFO-02) | Un componente de tabla nuevo | `TablaComparacion` (`components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx`), ya JSX puro sin `"use client"` | Ya implementa null-goes-last, exclusión de precio inválido, unidades por fila — reescribirlo arriesga reintroducir Pitfall 2 |
| Formateo de fecha date-only | Un `new Date(iso)` nuevo para `statsDate` | `formatFechaCorta` de `lib/formato-fecha.ts` | Ya corrige el bug de timezone documentado 5+ veces en el proyecto |
| Formateo de fecha timestamptz | Un formateador nuevo para `ultimaVezVistoEl`/`primeraVezVistoEl` | Promover el `formatTimestamp` local de `historial-tab.tsx:20-25` a export de `lib/formato-fecha.ts` | Evita una tercera reimplementación del mismo formateador en 3 archivos |
| Botón de imprimir | Un botón nuevo desde cero | Calcar `cadenas-comerciales/[id]/compliance/print-button.tsx` (client island, `window.print()`, ícono `Printer` de lucide-react) | 15 líneas, ya probado en producción |

**Key insight:** Todo lo que INFO-01/02/03 necesitan ya existe en el código de Fase 13/14 en la forma correcta — el trabajo de esta fase es composición de vista (JSX + CSS de impresión), no cálculo nuevo.

## Open Questions

1. **`@media print` vs. jsPDF+html2canvas — decisión de arquitectura sin founder disponible**
   - What we know: STACK.md y PITFALLS.md del research de milestone (research más profundo y verificado contra `node_modules` real) recomiendan explícitamente `@media print` como "la opción de menor riesgo para el caso base" y reservan jsPDF+html2canvas para "cuando se necesite un archivo `.pdf` real sin usuario presente (adjunto de email automático)". Ninguno de los 4 requirements (INFO-01..04) menciona generación sin usuario presente — todos describen "usuario puede exportar/imprimir", acción interactiva. ARCHITECTURE.md (mismo research pass) en cambio propone un módulo nuevo `lib/informe-oportunidades-pdf.ts` (jsPDF client-side) — una **contradicción interna del research de milestone** entre sus propios documentos, no resuelta explícitamente en SUMMARY.md más allá de "confirmar en planning".
   - What's unclear: si existe un caso de uso real de "el PDF debe llegar a un tercero sin que el usuario abra la app" (ej. envío automático por email a un inversionista) que justificaría jsPDF+html2canvas desde ahora.
   - Recommendation: **Adoptar `@media print` como default para esta fase**, consistente con STACK.md/PITFALLS.md (los dos documentos que sí llegaron a una recomendación taxativa) y con los 4 requirements tal como están redactados (ninguno pide envío sin usuario presente). Si en discusión con la founder surge el caso "PDF sin usuario presente", es una extensión aditiva sobre el mismo HTML/CSS ya escrito (jsPDF's `pdf.html()` + `html2canvas` puede consumir el mismo markup), no un rediseño — no bloquea empezar con `@media print`.

2. **¿El informe de comparación necesita mostrar gráficos, o solo la tabla?**
   - What we know: `TablaComparacion` (Fase 14) es 100% tabla, sin gráfico. `RankingBarChart` existe en el módulo pero no se usa hoy en `/comparar`. La sección "Should have" de FEATURES.md del research de milestone menciona un radar chart como "nunca reemplazo de la tabla, solo si hay señal de que la tabla sola no basta" — v1.6 REQUIREMENTS.md confirma que el radar es explícitamente v2+ ("Radar chart complementario a la tabla de comparación — solo si aparece señal real").
   - What's unclear: si el informe exportable debe incluir `RankingBarChart` (posicionamiento UF/m² entre las N oportunidades) como parte del cuerpo, dado que si se incluye, hereda el riesgo del Pitfall 1 (Recharts+print no probado).
   - Recommendation: Empezar sin gráficos Recharts en el informe (solo `TablaComparacion` + `GaugeArc`/`DesviacionBar` si el informe individual los reusa) — cumple INFO-01/02 tal como están redactados ("portada, cuerpo, metodología/fuentes" no exige gráficos específicos) sin asumir el riesgo no verificado.

3. **Ubicación exacta del campo "preparado por/para" (INFO-04) — ¿en la portada de la vista imprimible, o en el toolbar antes de imprimir?**
   - What we know: No existe ningún precedente de input editable en un informe existente — `clientes/[id]/informe` tiene un valor hardcodeado ("Arquitecta responsable: Estefanía Parada"), no un campo de usuario. `components/arch/rotulo.tsx` (cajetín/title block) es un componente de solo-presentación con `campos: CampoRotulo[]`, útil como inspiración de layout pero no de interacción.
   - What's unclear: si "preparado por/para" debe persistir entre visitas (localStorage) o ser efímero (se pierde al recargar).
   - Recommendation: Client island con 2 `<input>` controlados (`useState`) insertados directamente en la sección de portada (visible tanto en pantalla como en impresión — a diferencia del toolbar, que sí debe llevar `print:hidden`). Sin persistencia — mismo criterio "simple sobre prematuro" que ARCHITECTURE.md (Anti-Pattern 1) ya aplicó a "no guardar listas de comparación". Si el usuario recarga antes de imprimir, pierde lo tipeado — aceptable para un MVP; agregar `localStorage` solo si se reporta como fricción real.

## Sources

### Primary (HIGH confidence — código real del proyecto, leído en full)
- `app/(dashboard)/clientes/[id]/informe/page.tsx` (371 líneas, leído completo) — precedente 1 de `@media print`
- `app/(dashboard)/cadenas-comerciales/[id]/compliance/page.tsx` (288 líneas, leído completo) + `print-button.tsx` (16 líneas) — precedente 2 de `@media print`
- `lib/mercado-locales-server.ts` (904 líneas, secciones 210-350, 550-903 leídas) — `OportunidadDetalle`, `BandasMercadoLocal`, `obtenerOportunidadPorId`, `obtenerOportunidadesPorIds`, `obtenerComparablesOportunidad`, `obtenerBandasMercadoLocales`, `REASON_LABEL`/`REASON_LABEL_DETALLE`
- `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` (182 líneas, leído completo) — Fase 13, ya construida
- `app/(dashboard)/mercado-inmobiliario/oportunidades/comparar/page.tsx` (143 líneas, leído completo) — Fase 14, ya construida
- `components/mercado-inmobiliario/comparacion/tabla-comparacion.tsx` (189 líneas, leído completo) — Fase 14
- `components/mercado-inmobiliario/oportunidad-detalle/posicionamiento-tab.tsx`, `historial-tab.tsx` — Fase 13
- `components/mercado-inmobiliario/charts/desviacion-bar.tsx`, `gauge-arc.tsx` (confirmado SVG/CSS plano, sin Recharts) vs. `histograma.tsx`, `ranking-bar-chart.tsx`, `kpi-card.tsx`, `distribucion-donut.tsx` (confirmado con `ResponsiveContainer` de Recharts)
- `lib/formato-fecha.ts` (20 líneas, leído completo)
- `lib/informe-pdf.ts` (grep dirigido de estructura: header, `drawCoverPage`, `pdfjs-dist`) — confirma que es Due Diligence puro, sin capa neutra reutilizable
- `lib/informe-charts.ts` (141 líneas, leído completo) — confirma "cero reutilización real" (parsea markdown de Tasación/Due Diligence, dominio no relacionado)
- `components/arch/rotulo.tsx` (106 líneas, leído completo) — único precedente de "cajetín"/title-block, sin campo editable
- `.planning/data-sources.yaml` — `freshness_sla_days: 1` para `mercado-locales-portalinmobiliario`, único source relevante (scope confirmado solo Oportunidades, sin mezcla con terrenos SLA=8)
- `.planning/REQUIREMENTS.md` — texto exacto de INFO-01..04, Out of Scope v1.6

### Secondary (MEDIUM confidence — heredado del research de milestone, no re-verificado en esta pasada)
- `.planning/research/SUMMARY.md`, `STACK.md`, `PITFALLS.md`, `ARCHITECTURE.md` — research de milestone 2026-08-02, HIGH confidence declarada para stack/pitfalls, contradicción identificada entre ARCHITECTURE.md (propone jsPDF) y STACK.md/PITFALLS.md (recomiendan `@media print`) — resuelta en Open Questions #1 de este documento

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cero dependencias nuevas, dos precedentes en producción leídos en full
- Architecture: HIGH — estructura de rutas y capa de datos verificada contra el código real de Fase 13/14 (no el brief del milestone, que ya estaba desactualizado sobre esto)
- Pitfalls: HIGH para timezone/precio-inválido/homogeneidad (mismo código ya los previene en Fase 13/14, solo hay que replicar el patrón); MEDIUM para Recharts+print (riesgo real pero no verificado en ningún caso concreto de este repo — mitigado recomendando evitarlo en v1)

**Research date:** 2026-08-02
**Valid until:** Estable — no depende de versiones de librería que cambien pronto; revalidar si Fase 13/14 cambian la forma de `OportunidadDetalle` antes de que esta fase se ejecute
