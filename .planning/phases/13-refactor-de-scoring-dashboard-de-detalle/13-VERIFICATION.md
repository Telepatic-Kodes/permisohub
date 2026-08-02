---
phase: 13-refactor-de-scoring-dashboard-de-detalle
verified: 2026-08-02T20:05:46Z
status: passed
score: 9/9 must-haves verified
---

# Phase 13: Refactor de scoring + Dashboard de detalle Verification Report

**Phase Goal:** El arquitecto/inversionista puede abrir la ficha de una oportunidad individual y ver, en una sola pantalla, todo lo que hoy solo existe repartido entre la card de la lista y el histograma — posicionamiento real vs. mercado, historial, señales explicadas, comparables sugeridos y un resumen ejecutivo narrado por IA.

**Verified:** 2026-08-02T20:05:46Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `evaluarOportunidad()` es la fuente única de verdad del scoring, reutilizada por la lista, la ficha individual y los comparables (list/detail nunca divergen) | ✓ VERIFIED | `lib/mercado-locales-server.ts:372-395` exporta `evaluarOportunidad()`; llamada en `obtenerOportunidadesMercadoLocales` (L525), `obtenerOportunidadPorId` (L665), `obtenerComparablesOportunidad` (L800). 9/9 tests pasan en `tests/unit/evaluar-oportunidad.test.ts`. Los 5 call sites de `obtenerOportunidadesMercadoLocales` en el proyecto (reportes-mercado, oportunidades/page, dashboard/page ×2, mercado-inmobiliario-copiloto) no cambiaron de firma. |
| 2 | Usuario puede abrir `/mercado-inmobiliario/oportunidades/[id]` para una oportunidad real y ver las 4 tabs (Posicionamiento, Resumen, Historial, Comparables), todas con datos reales, sin esperar a la IA | ✓ VERIFIED | `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` — Server Component, `Promise.all` fetch-ea todo antes de renderizar; `<Tabs>` con 4 `<TabsContent>` (Posicionamiento/Resumen/Historial/Comparables), Resumen es el único tab que requiere interacción (botón). |
| 3 | Id inexistente devuelve 404; un aviso `dado_de_baja` SÍ abre su ficha con ese estado explícito | ✓ VERIFIED | `[id]/page.tsx:34` `if (!oportunidad) notFound()`; `obtenerOportunidadPorId()` (L621) no filtra por status; banner rojo explícito "Aviso dado de baja" en `[id]/page.tsx:116-126`. |
| 4 | Ficha muestra posicionamiento real vs. banda P25/mediana/P75, con `muestra_n` declarado explícitamente en texto visible, y banner amber prominente si la banda es fallback/inexistente | ✓ VERIFIED | `posicionamiento-tab.tsx` — `N={bandas.muestraN}` visible en texto (L61), banners amber `border-amber-200 bg-amber-50` con ⚠ para "sin banda" (L31-42) y "muestra insuficiente/fallback" (L44-55). |
| 5 | Rentabilidad implícita de zona (DETA-07) solo se calcula/muestra cuando ambas bandas (arriendo y venta) tienen `mediana_uf_m2` real; badge "Estimado de zona" visualmente distinto de banner amber y del pill "Estimado" de KpiCard | ✓ VERIFIED | `posicionamiento-tab.tsx:25-27` condiciona `rentabilidad` a `arriendoUfM2 !== null && ventaUfM2 !== null`; mensaje explícito de qué falta en el else (L138-146); badge `bg-violet-100 text-violet-800` (L116) — distinto de `bg-amber-50` (banner) y `bg-blueprint-soft text-blueprint` (KpiCard, confirmado en `kpi-card.tsx:36-39`); desglose completo banda arriendo+venta con N y fallback (L123-136). |
| 6 | Ficha muestra historial de precio completo y días publicado, con mensaje explícito si no hay cambios | ✓ VERIFIED | `historial-tab.tsx` — `diasPublicado` (L30, L36), lista de `historial` (L50-57) o "Sin cambios de precio registrados..." si vacío (L48). |
| 7 | Cada reason code se explica en detalle (REASON_LABEL_DETALLE) junto con señales cruzadas (expansión de cadenas, tendencia constructiva) | ✓ VERIFIED | `historial-tab.tsx:70-75` usa `REASON_LABEL_DETALLE`; señales cruzadas condicionales L78-94. `REASON_LABEL_DETALLE` exportado desde `lib/mercado-locales-server.ts:562-569` con texto completo por código. |
| 8 | Tab Comparables siempre aparece; con 0/1 comparable muestra mensaje explícito Y los reales que existan; cada comparable enlaza a su propia ficha `/oportunidades/[id]` | ✓ VERIFIED | `comparables-tab.tsx` — siempre renderiza el contenedor; `insuficiente` (L16) muestra mensaje sin ocultar comparables reales (L20-25 + L27-55 coexisten); `Link href={\`/mercado-inmobiliario/oportunidades/${c.id}\`}` (L32). `obtenerComparablesOportunidad()` consulta `mercado_locales_listings` directo (no reutiliza `obtenerOportunidadesMercadoLocales`, confirmado en `mercado-locales-server.ts:729-737`); sort null-goes-last confirmado (L762-772, nunca coerciona `precioUfM2` null a 0). |
| 9 | Resumen ejecutivo IA requiere click explícito (nunca automático), falla de forma aislada sin bloquear el resto de la ficha, y usa `streamConContexto` (sin `web_search_preview`) con orden `aiAuthGuard → checkRateLimit → recordUsage` antes de streamear | ✓ VERIFIED | `resumen-tab.tsx` — estado inicial muestra botón "Generar resumen ejecutivo" (L58-70), sin auto-fetch en mount; error solo afecta el bloque del tab (L75-84). `app/api/oportunidades-resumen/route.ts:15-24` — orden `aiAuthGuard` → `checkRateLimit` → `recordUsage` antes de `streamConContexto` (L39). `streamConContexto` en `lib/ai.ts:199-209` no incluye `tools` en el payload (confirmado, a diferencia de `streamConBusquedaWeb` que sí tiene `tools: [{ type: 'web_search_preview' }]`, L182). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/mercado-locales-server.ts` | `evaluarOportunidad()` + `obtenerOportunidadPorId()` + `obtenerComparablesOportunidad()` + `obtenerHistorialPrecioListing()` + `REASON_LABEL`/`REASON_LABEL_DETALLE` | ✓ VERIFIED | Todos exportados y presentes; wired en 3 call sites + [id]/page.tsx + 3 tabs |
| `tests/unit/evaluar-oportunidad.test.ts` | Cobertura RED→GREEN de 4 combinaciones + rebote de ventana | ✓ VERIFIED | 9/9 tests pasan |
| `lib/formato-fecha.ts` | `formatFechaCorta()` movida verbatim | ✓ VERIFIED | Idéntica lógica (`T00:00:00` + America/Santiago); usada en `historial-tab.tsx` y `oportunidades/page.tsx` (copia local eliminada) |
| `lib/ai.ts` | `streamConContexto()` sin tools | ✓ VERIFIED | Confirmado sin `tools` en el payload |
| `lib/resumen-oportunidad-prompts.ts` | `ResumenOportunidadContexto`, `buildSystemResumenOportunidad()`, `buildUserQueryResumenOportunidad()` | ✓ VERIFIED | Interpola campos reales, marca `null` como "no disponible" (función `num()`, L34-36) |
| `app/api/oportunidades-resumen/route.ts` | Ruta SSE flat, `POST` | ✓ VERIFIED | Orden guard→rate-limit→usage confirmado; usa `streamConContexto` |
| `components/mercado-inmobiliario/oportunidad-detalle/resumen-tab.tsx` | `ResumenTab` con botón + streaming + `InformeEjecutivo` | ✓ VERIFIED | Wired en `[id]/page.tsx` |
| `components/mercado-inmobiliario/oportunidad-detalle/posicionamiento-tab.tsx` | `PosicionamientoTab` | ✓ VERIFIED | Wired en `[id]/page.tsx`, usa `GaugeArc`/`DesviacionBar`/`calcularCapRate` |
| `components/mercado-inmobiliario/oportunidad-detalle/historial-tab.tsx` | `HistorialTab` | ✓ VERIFIED | Wired en `[id]/page.tsx` |
| `components/mercado-inmobiliario/oportunidad-detalle/comparables-tab.tsx` | `ComparablesTab` | ✓ VERIFIED | Wired en `[id]/page.tsx` |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx` | Server Component que compone las 4 tabs | ✓ VERIFIED | `notFound()`, `Promise.all` fetch, 9 `TabsContent`/`Tabs`/`TabsTrigger` usages |
| `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` | Import de `formatFechaCorta`/`REASON_LABEL` compartidos + link "Ver ficha completa" | ✓ VERIFIED | Import compartido confirmado (sin copias locales), link presente (L158-163), link externo al aviso original intacto (L125-127) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `obtenerOportunidadesMercadoLocales` loop | `evaluarOportunidad()` | llamada de función | ✓ WIRED | L525 |
| `obtenerOportunidadPorId()` | `evaluarOportunidad()` + `obtenerBandasMercadoLocales()` | llamada directa | ✓ WIRED | L635 (bandas), L665 (evaluarOportunidad) |
| `obtenerComparablesOportunidad()` | `evaluarOportunidad()` | cálculo solo para el top final | ✓ WIRED | L800, tras `.slice(0, limit)` en L774 |
| `resumen-tab.tsx` | `app/api/oportunidades-resumen/route.ts` | `fetch POST` en `handleGenerar` | ✓ WIRED | L28 |
| `app/api/oportunidades-resumen/route.ts` | `lib/ai.ts streamConContexto` + prompts builders | import + llamada | ✓ WIRED | L1, L31-32, L39 |
| `comparables-tab.tsx` | `/mercado-inmobiliario/oportunidades/[id]` | `next/link` | ✓ WIRED | L32 |
| `oportunidades/page.tsx` | `[id]/page.tsx` | `next/link` "Ver ficha completa" | ✓ WIRED | L158-163 |
| `[id]/page.tsx` | `obtenerOportunidadPorId`, `obtenerComparablesOportunidad`, `obtenerHistorialPrecioListing`, `obtenerBandasMercadoLocales` | `Promise.all` | ✓ WIRED | L33, L36-50 |
| `[id]/page.tsx` | `{posicionamiento,resumen,historial,comparables}-tab.tsx` | composición dentro de `<Tabs>` | ✓ WIRED | L157-176 |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|-----------------|
| DETA-01 (ficha en ruta propia) | ✓ SATISFIED | — |
| DETA-02 (posicionamiento vs. banda, muestra_n declarada) | ✓ SATISFIED | — |
| DETA-03 (historial de precio + días publicado) | ✓ SATISFIED | — |
| DETA-04 (reason codes detallados + señales cruzadas) | ✓ SATISFIED | — |
| DETA-05 (comparables sugeridos) | ✓ SATISFIED | — |
| DETA-06 (resumen ejecutivo IA, patrón InformeEjecutivo) | ✓ SATISFIED | — |
| DETA-07 (rentabilidad implícita de zona, solo con cobertura real) | ✓ SATISFIED | — |

Nota: `.planning/REQUIREMENTS.md` todavía lista DETA-01..07 como `Pending` en su tabla de tracking — es un artefacto de seguimiento que no se actualizó en las SUMMARY de esta fase; no representa una brecha funcional (todo lo que describen los 7 requisitos está verificado en código).

### Anti-Patterns Found

Ninguno bloqueante. Se revisaron los 12 archivos tocados por la fase con grep de `TODO|FIXME|XXX|HACK|PLACEHOLDER|coming soon|not implemented` — las únicas coincidencias son la palabra española "todo" dentro de comentarios/prosa y el atributo HTML legítimo `placeholder="..."` de un `<Input>`.

Dos warnings de lint (`react-hooks/purity`, no error) por `Date.now()` en render de Server Components (`[id]/page.tsx:53`, `historial-tab.tsx:30`) — patrón preexistente en el resto del módulo (`lib/mercado-locales-server.ts` también usa `Date.now()` extensamente), no bloquea el goal ni afecta el comportamiento observable.

### Human Verification Required

Ninguno crítico para el goal — verificación automatizada cubrió toda la lógica observable (existencia, TDD verde, wiring, condicionales de fallback/rentabilidad/comparables/dado_de_baja). Se recomienda una pasada visual rápida (no bloqueante):

1. **Apariencia visual de las 4 tabs con una oportunidad real**
   **Test:** Abrir `/mercado-inmobiliario/oportunidades/[id]` con un id real de la base de datos (arriendo y venta, con y sin fallback de banda).
   **Expected:** Layout coherente, banners amber legibles, badge violeta "Estimado de zona" visualmente distinguible del banner y del pill de KpiCard.
   **Why human:** Percepción visual de contraste/legibilidad no es verificable por grep.

2. **Streaming del resumen ejecutivo IA en vivo**
   **Test:** Click en "Generar resumen ejecutivo" con `OPENAI_API_KEY` configurado.
   **Expected:** Texto se acumula progresivamente, cita cifras reales del contexto, termina con `InformeEjecutivo` renderizado + fuentes.
   **Why human:** Comportamiento de streaming real y calidad de la narración del modelo requieren ejecución en vivo.

### Gaps Summary

No se encontraron brechas. Las 9 verdades observables derivadas del goal de la fase están verificadas contra el código real (no solo contra las SUMMARY): `evaluarOportunidad()` es la fuente única de verdad reutilizada en los 3 puntos que la necesitan, la ficha de detalle compone las 4 tabs con datos ya fetch-eados (nada espera a la IA), el resumen ejecutivo es estrictamente bajo demanda y aislado de fallos, DETA-07 nunca se muestra sin cobertura real, y los comparables/historial nunca ocultan datos reales ni fabrican valores. `npx tsc --noEmit` limpio, 213/213 tests unitarios pasan (incluyendo los 9 nuevos de `evaluarOportunidad`), y los 7 requisitos DETA-01..07 están satisfechos en código (aunque `.planning/REQUIREMENTS.md` no refleja aún el tracking actualizado — no funcional).

---

_Verified: 2026-08-02T20:05:46Z_
_Verifier: Claude (gsd-verifier)_
