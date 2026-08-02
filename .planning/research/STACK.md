# Stack Research — Oportunidades: Dashboards, Comparación e Informe Exportable

**Domain:** Dashboard de detalle por oportunidad, comparación lado a lado y reporte exportable "calidad consultora" — módulo Mercado Inmobiliario / Oportunidades, PermisoHub
**Researched:** 2026-08-02
**Confidence:** HIGH (verificado contra `node_modules` real del proyecto, `package.json`/`package-lock.json`, y patrones ya en producción en el propio repo — no solo training data)

> Este archivo reemplaza el contenido anterior de `STACK.md` (research de v1.4 Zonificación, dominio de ArcGIS/geoespacial). Ese research no se pierde — queda en el historial de git — pero pertenece a un milestone distinto sin solapamiento con este dominio (dashboards/reportes de Oportunidades).

## Conclusión ejecutiva

**No hace falta instalar ninguna librería nueva.** Recharts 3.10.1 (ya instalado) incluye `RadarChart` nativo y soporta gráficos de banda de rango (`Area` con tupla `[min, max]`) sin dependencias extra. Para el informe exportable, jsPDF (ya instalado) **no es la herramienta correcta para este caso** — el propio repo ya resuelve "informe profesional imprimible" con un patrón superior (vista HTML + `@media print`) en `app/(dashboard)/clientes/[id]/informe/page.tsx`, que imprime los gráficos Recharts como SVG vivo sin rasterizar nada. Para la comparación lado a lado, no existe un paquete de industria para esto — se construye con `Table`/`Tabs` de shadcn/ui, ya instalados.

## Recommended Stack

### Core Technologies (ya instaladas — uso extendido)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Recharts | 3.10.1 (`package.json` actual) | Radar/spider chart para comparación multi-atributo (precio/m², plusvalía, riesgo, liquidez); gráfico de banda de rango (P25–P75 de la cohorte) en el dashboard de detalle | Verificado en `node_modules/recharts/es6/chart/RadarChart.js`, `ComposedChart.js`, `AreaChart.js` — existen en la versión exacta ya instalada, cero riesgo de bump de versión. `Area` con `dataKey` que devuelve tupla `[min, max]` renderiza una banda de rango de forma nativa (docs oficiales de Recharts), justo lo que se necesita para "¿esta oportunidad está cara o barata vs su cohorte?" sin cálculos manuales de path SVG. |
| Vista HTML + `@media print` (React Server/Client Components, Next 16 App Router) | React 19.2.4 / Next 16.2.12 | Informe exportable de una oportunidad o de una comparación, con calidad "consultora" | El repo ya resuelve exactamente este problema en `app/(dashboard)/clientes/[id]/informe/page.tsx` y `app/(dashboard)/cadenas-comerciales/[id]/compliance/page.tsx` + `print-button.tsx`: CSS `@page { size: A4 portrait; margin: ... }`, clases `no-print` / `page-break` / `.report-card { break-inside: avoid }`, botón `window.print()`. Los gráficos Recharts son SVG real en el DOM — el navegador ("Guardar como PDF") los imprime nítidos y vectoriales, sin el paso de rasterización que sí necesita jsPDF. Es el enfoque de menor esfuerzo y mayor fidelidad visual ya validado en dos informes distintos del proyecto. |
| shadcn/ui `Table` + `Tabs` (ya instalados: `components/ui/table.tsx`, `components/ui/tabs.tsx`) | — | Vista de comparación lado a lado de 2+ oportunidades | No existe un paquete npm estándar de industria para "comparar propiedades lado a lado" (confirmado por búsqueda de mercado — lo que aparece son demos de diseño de dashboards de comparación de productos SaaS, no librerías). El patrón de industria (comparadores inmobiliarios, G2/Capterra-style) es una tabla con atributos en filas y una columna por ítem, celda destacada para el mejor/peor valor — se construye directo sobre `Table` de shadcn/ui, ya integrada al tema "Consultora" del proyecto. |

### Supporting Libraries (uso puntual, ya resueltas — no requieren `npm install`)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `html2canvas` | 1.4.1 (dependencia opcional transitiva de `jspdf`, ya resuelta en `node_modules`) | Único caso válido: generar un archivo `.pdf` descargable de verdad a partir del informe HTML (no solo abrir el diálogo de impresión), p.ej. para adjuntar a un email automático | `require.resolve('html2canvas')` confirma que ya está disponible en el árbol de dependencias sin tocar `package.json`. Se usaría vía `jspdf`'s `pdf.html(el, { html2canvas })`. No importar directo salvo que este caso de uso ("archivo real, sin usuario presente") se active — hoy ningún archivo del proyecto lo importa. |
| `jspdf` | ^4.2.1 (ya instalado) | Seguir usándolo tal cual está: PDF client-side con imágenes rasterizadas (planos anotados de Due Diligence) | Rol ya cumplido en `lib/informe-pdf.ts`. No es la herramienta para el informe de Oportunidades: ese caso no tiene imágenes que rasterizar, tiene gráficos SVG vivos — forzarlos por jsPDF agrega un paso de canvas que el propio repo ya evita en su otro informe. |
| `pdfkit` | ^0.19.1 (ya instalado) | PDF **server-side**, sin gráficos ricos (texto + formas vectoriales simples dibujadas a mano) | Patrón usado en `app/api/cadenas/[id]/reporte/route.ts`. Camino válido si en el futuro se necesita el PDF de Oportunidades generado 100% en servidor (ej. cron/email sin navegador) — pero no dibuja gráficos Recharts, solo primitivas vectoriales manuales. |

### Development Tools

Ninguna herramienta nueva. TypeScript estricto, ESLint y Prettier ya cubren estos componentes igual que el resto del módulo Mercado Inmobiliario.

## Installation

```bash
# Ninguna instalación nueva requerida.
# Ya disponibles: recharts@3.10.1, jspdf@4.2.1, html2canvas@1.4.1 (transitiva,
# resoluble), pdfkit@0.19.1, componentes shadcn/ui (table, tabs, dialog, sheet).
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Recharts `RadarChart` (nativo) | Nivo, Visx, ECharts | Solo si se necesitara radar chart con miles de puntos, animaciones complejas o interacción muy custom (drag de vértices). Para comparar 4-8 atributos entre 2-4 oportunidades, Recharts sobra en capacidad y evita una segunda librería de charting duplicando bundle y rompiendo el tema visual "Consultora" ya aplicado. |
| Recharts `Area` con tupla `[min, max]` | D3 custom, `victory-area` | Solo si el rango necesitara relleno con gradiente multi-stop muy específico o eje logarítmico no soportado por Recharts. No aplica para una banda P25–P75 simple. |
| Vista HTML `@media print` (patrón ya en el repo) | `jsPDF` + `pdf.html()` + `html2canvas` | Cuando se necesite un archivo `.pdf` descargable real sin intervención del usuario (adjunto de email, guardado automático en Supabase Storage). Ahí sí conviene activar `html2canvas` (ya resoluble) sobre el mismo HTML — no reconstruir el layout dos veces. |
| Tabla shadcn/ui a medida | `react-compare-slider` u otras "compare UI" genéricas | Nunca para este caso: esas librerías son para comparación de imágenes (before/after) o diffs de código, no de atributos tabulares de propiedades. No adoptar. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Nueva librería de gráficos (Chart.js, Nivo, Victory, ECharts, Highcharts) | Recharts 3.10.1 ya cubre radar, banda de rango y sparkline (el sparkline ya existe hecho con `LineChart` puro en `kpi-card.tsx`). Sumar una segunda librería de charting rompe el tema "Consultora" aplicado vía scope CSS y duplica ~50-100kb de bundle sin necesidad real. | Extender `components/mercado-inmobiliario/charts/` con nuevos componentes (ej. `radar-comparativo.tsx`, `rango-banda.tsx`) sobre Recharts, siguiendo el mismo patrón que `desviacion-bar.tsx` / `histograma.tsx`. |
| jsPDF client-side calcado de `lib/informe-pdf.ts` para el informe de Oportunidades | Ese módulo resuelve un problema distinto: planos rasterizados con anotaciones dibujadas en canvas, sin gráficos SVG. Forzar los gráficos Recharts por ese camino exige rasterización (canvas/html2canvas) que el propio repo ya evita en su otro informe (`clientes/[id]/informe`). Replicar el patrón equivocado es sobre-ingeniería. | Vista HTML imprimible `@media print`, calcada de `app/(dashboard)/clientes/[id]/informe/page.tsx` + `print-button.tsx`. |
| Motor de PDF adicional (`@react-pdf/renderer`, `puppeteer`) | Introduciría un tercer motor de PDF en el proyecto (ya conviven jsPDF client-side + pdfkit server-side). `@react-pdf/renderer` no renderiza SVG de Recharts directamente (exige reescribir cada gráfico en su propio DSL `<Page>/<View>`); `puppeteer` es un binario de Chromium pesado para un caso que `window.print()` del navegador ya resuelve. | Vista HTML imprimible (cero dependencias nuevas) para el caso interactivo del usuario logueado; `pdfkit` (ya instalado) solo si se necesita generación 100% server-side sin usuario presente. |
| Paquete npm genérico de "comparación de productos/propiedades" en React | La búsqueda de mercado no encontró un estándar de industria empaquetado como librería (solo demos/patrones de diseño). El dominio (UF/m², plusvalía, riesgo, comuna) es demasiado específico para que un paquete genérico agregue valor sobre una tabla shadcn/ui bien resaltada. | `Table` de shadcn/ui (ya instalada) + lógica propia de "mejor/peor valor por fila" (comparación numérica simple, sin librería). |
| Declarar `html2canvas` explícito en `package.json` desde ya | Hoy está resuelto transitivamente vía `jspdf` (`optionalDependencies`) y ningún archivo lo importa — declararlo explícito antes de usarlo agrega una dependencia fantasma al manifiesto. | Agregarlo explícito a `dependencies` recién cuando se active el caso "PDF descargable real" (ver alternativas). |

## Stack Patterns by Variant

**Dashboard de detalle — comparación multi-atributo tipo "spider" (precio/m², plusvalía, riesgo, liquidez, distancia a polos):**
- `RadarChart` + `PolarGrid` + `PolarAngleAxis` + `Radar` de Recharts, un `<Radar>` por oportunidad (2-4 máximo; más satura el polígono).
- Porque es el patrón de industria confirmado para este caso (mismo patrón que shadcn.io publica como "radar-multiple") y no exige tocar dependencias.

**Dashboard de detalle — "¿esta oportunidad está cara o barata vs su cohorte?" como banda visual, no solo un número:**
- `ComposedChart` con `Area` de rango (`dataKey` → `[p25, p75]`) más un `ReferenceDot`/`Scatter` marcando el valor puntual de la oportunidad.
- Porque evita reinventar el cálculo de banda en SVG a mano; Recharts lo soporta de fábrica desde la versión ya instalada.

**Informe exportable — caso base del milestone (usuario logueado quiere ver/imprimir/guardar como PDF):**
- Vista `@media print` + botón `window.print()`, exclusivamente.
- Cero dependencias nuevas, cero rasterización; el navegador ("Guardar como PDF") produce un PDF vectorial nítido — mejor calidad que uno rasterizado por canvas.

**Informe exportable — caso extendido futuro (el PDF debe llegar a un tercero sin que abra la app, ej. adjunto de email):**
- Activar `jspdf` + `pdf.html()` + `html2canvas` (ya resoluble) sobre el mismo HTML del informe imprimible, sin reconstruir el layout dos veces.
- Porque reutiliza el markup/estilos ya escritos para `@media print` en vez de mantener dos versiones del informe.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| recharts@3.10.1 | react@19.2.4 | Ya en uso productivo en 6+ componentes del propio módulo (`KpiCard`, `RankingBarChart`, `DistribucionDonut`, `DesviacionBar`, `Histograma`, `GaugeArc` usa SVG plano a propósito). Cero riesgo adicional al extender con `RadarChart`/`ComposedChart` de la misma versión ya instalada. |
| jspdf@4.2.1 | html2canvas@1.4.1 | `html2canvas` es `optionalDependencies` de `jspdf` (rango `^1.0.0-rc.5`), resuelto en `node_modules` a 1.4.1 — es el par que jsPDF documenta oficialmente para su método `.html()`. |
| jspdf@4.2.1 / html2canvas | Next.js 16 App Router | Debe importarse dinámicamente en cliente (`await import("jspdf")`), tal como ya hace `lib/informe-pdf.ts` — ambas dependen de APIs de DOM/canvas no disponibles en Server Components. Mismo criterio aplica si se activa el caso "PDF descargable real". |

## Sources

- `node_modules/recharts/package.json`, `.../es6/chart/RadarChart.js`, `ComposedChart.js`, `AreaChart.js` — verificación directa de que Recharts 3.10.1 (versión exacta instalada en el proyecto) incluye estos componentes. Confianza: HIGH.
- `node_modules/html2canvas/package.json` + `node_modules/jspdf/package.json` (campo `optionalDependencies`) — verificación de que html2canvas 1.4.1 ya está resuelto transitivamente y es resoluble vía `require.resolve('html2canvas')`. Confianza: HIGH.
- Código propio del repo (leído directamente, no training data): `lib/informe-pdf.ts`, `app/(dashboard)/clientes/[id]/informe/page.tsx`, `app/(dashboard)/cadenas-comerciales/[id]/compliance/page.tsx` + `print-button.tsx`, `components/mercado-inmobiliario/charts/kpi-card.tsx`, `gauge-arc.tsx`, `app/api/cadenas/[id]/reporte/route.ts` — patrones ya validados en producción: PDF client-side con rasterización de planos, informe HTML imprimible, sparkline con Recharts puro, y PDF server-side con pdfkit. Confianza: HIGH.
- [jspdf — npm](https://www.npmjs.com/package/jspdf) y notas de release v4.0.0/v4.2.1 (WebSearch) — confirma que jsPDF v4.x es una versión real y reciente (2026, foco en parches de seguridad), no un error tipográfico de versión. Confianza: MEDIUM, corroborado contra el propio `package-lock.json` del repo.
- [Recharts — Area API docs](https://recharts.github.io/en-US/api/Area/) (WebSearch) — confirma el patrón de `dataKey` con tupla `[min, max]` para banda de rango. Confianza: MEDIUM, verificado contra la presencia real del componente en `node_modules`.
- [shadcn.io — Radar Multiple](https://www.shadcn.io/charts/radar-multiple) (WebSearch) — confirma que "radar con series superpuestas" es el patrón estándar de industria para comparación multi-atributo sobre Recharts. Confianza: MEDIUM.
- Búsqueda de mercado sobre librerías de "comparación de propiedades en React" — no arrojó un paquete npm estándar de industria; solo demos/patrones de diseño. Reportado como hallazgo honesto (ausencia de evidencia), no como certeza absoluta. Confianza: MEDIUM.

---
*Stack research for: dashboards de detalle/comparación e informe exportable — módulo Oportunidades, PermisoHub*
*Researched: 2026-08-02*
