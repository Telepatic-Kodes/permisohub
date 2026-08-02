# Phase 13: Refactor de Scoring + Dashboard de Detalle - Research

**Researched:** 2026-08-02
**Domain:** Server Component detail page for a single "oportunidad" (mercado_locales_listings row), scoring extraction, comparables, zone-level implied yield, on-demand AI executive summary (SSE)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Jerarquía y densidad de la ficha**
- Orden de secciones: Header (precio/comuna/tipo/operación) → Posicionamiento vs. cohorte → Resumen ejecutivo IA → Historial de precio + señales → Comparables sugeridos. El dato duro va antes que la narrativa.
- Layout: tabs por sección (Resumen | Posicionamiento | Historial | Comparables), no scroll único ni acordeón.
- `muestra_n` (hoy no se muestra en ningún lugar del UI) se declara explícitamente en la ficha. Cuando la muestra es chica (por debajo de `MIN_COHORT_SIZE=15`) y cae a fallback ciudad, se comunica con un **banner de advertencia prominente** arriba de la sección de posicionamiento — no una nota discreta.
- Acceso desde la lista: se agrega un **nuevo link "Ver ficha completa"** en cada card que abre `/oportunidades/[id]`. El link externo al aviso original en la card se mantiene igual, sin reemplazarlo.

**Comparables sugeridos (DETA-05)**
- Criterio: mismo comuna + tipo de propiedad + operación (match exacto en los tres), ordenados por cercanía de precio UF/m² al de la oportunidad actual.
- Cantidad máxima: Claude's Discretion — ajustar según cuántos suelen calificar realmente por cohorte.
- Cuando hay 0 o 1 comparable real disponible: la sección **siempre aparece** y muestra un mensaje explícito (ej. "No hay suficientes comparables en esta comuna/tipo todavía") — nunca se oculta la sección ni se rellena con datos fuera de criterio. Consistente con la disciplina de "nunca fabricar datos" del proyecto.
- Cada comparable es una mini-card clickeable que enlaza a su propia ficha `/oportunidades/[id]` (crea un loop de navegación entre fichas), mostrando precio + UF/m² + comuna + badge de reason code.

**Rentabilidad implícita de zona (DETA-07)**
- Solo existe cuando hay cobertura real de ambas bandas (arriendo y venta) para la misma comuna×tipo.
- Cuando falta cobertura: la sección **siempre aparece** con un mensaje explicando explícitamente qué dato falta (ej. "sin datos de venta suficientes en esta comuna×tipo") — mismo criterio que comparables, nunca se oculta silenciosamente.
- Es el dato más fácil de malinterpretar de la ficha (parece cap rate real del activo, es un estimado de zona). Se etiqueta con un **badge visible "Estimado de zona"** de color distintivo pegado al número — no un tooltip sutil.
- Se muestra el **desglose completo del cálculo** (banda de arriendo UF/m² y banda de venta UF/m² usadas), no solo el porcentaje final — prioriza transparencia/verificabilidad sobre densidad visual.
- Aparece en **toda ficha de esa comuna×tipo**, tanto venta como arriendo — es un dato de zona, no del activo específico, así que no se restringe solo a fichas de venta.

**Resumen ejecutivo IA (DETA-06)**
- Bajo demanda con botón (mismo patrón que Tasación/Due Diligence hoy vía `InformeEjecutivo` + streaming SSE) — no se auto-genera al cargar la página.
- El resto de la ficha (posicionamiento, historial, comparables — todos datos reales sin IA) se renderiza de inmediato sin esperar al resumen; si el resumen falla o tarda, esa sección específica muestra error/vacío sin bloquear nada más.

### Claude's Discretion
- Cantidad máxima de comparables sugeridos a mostrar (3, 5, u otro número).
- Estrategia de cache del resumen ejecutivo IA entre visitas a la misma ficha (dado que ahora es bajo demanda, el peso de esta decisión bajó vs. si hubiera sido automático).
- Extensión/tono del resumen ejecutivo IA (breve tipo "so what" vs. formato extenso multi-párrafo como Tasación/DD hoy).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Comparación lado a lado e informe exportable ya están planificados como Phase 14 y Phase 15 respectivamente, fuera de esta discusión.)
</user_constraints>

## Summary

This phase has no new stack, no new architectural pattern, and no schema migration — it is entirely a matter of correctly wiring already-existing pieces (`mercado_locales_stats_diarias`, `mercado_locales_historial_precio`, `GaugeArc`/`DesviacionBar`/`KpiCard`, `InformeEjecutivo` + SSE, shadcn `Tabs`) into one new Server Component route (`/oportunidades/[id]`) plus a scoring extraction that the milestone-level research already fully mapped in `.planning/research/{ARCHITECTURE,STACK,PITFALLS,FEATURES}.md`. This document does not repeat that mapping; it verifies the exact current code shape against file:line so the planner can write tasks without re-deriving signatures, and it surfaces two concrete corrections the milestone research did not have the field-level detail to catch.

**Primary recommendation:** Follow ARCHITECTURE.md's plan almost verbatim (extract `evaluarOportunidad()` from the loop at `lib/mercado-locales-server.ts:475-517`, add `obtenerOportunidadPorId()`, new Server Component at `app/(dashboard)/mercado-inmobiliario/oportunidades/[id]/page.tsx`), but (1) build comparables from a **new, unfiltered-by-reasonCodes** listings query — not by reusing `obtenerOportunidadesMercadoLocales()`, which is a strict subset of "everything in the cohort" — and (2) do not use `streamConBusquedaWeb` for the executive summary's underlying AI call as-is, because that function hardwires OpenAI's `web_search_preview` tool, which is exactly the anti-pattern Pitfall 6 warns against for this domain (real comparables/bandas exist; the summary should cite them, not re-derive via web search).

## Verified Current Code Shapes

### `lib/mercado-locales-server.ts` (523 lines total, read in full)

**`OportunidadMercadoLocal` interface (lines 348-359):**
```typescript
export interface OportunidadMercadoLocal {
  id: string
  titulo: string
  url: string
  comuna: string
  precioMonto: number
  precioMoneda: string
  superficieM2: number | null
  precioUfNormalizado: number
  precioUfM2Normalizado: number | null
  reasonCodes: string[]
}
```
No `muestra_n`, no `tipoPropiedad`/`operacion` field, no timestamp fields — all of these must be added for the detail contract (see Pitfall 1 in milestone PITFALLS.md, and note below on `tipoPropiedad`/`operacion` — the interface today doesn't even carry the values the caller already knows, since the whole list is single-typed per call).

**`obtenerOportunidadesMercadoLocales(operacion, opts)` (lines 372-521):** the scoring loop to extract lives at **lines 475-517** inside the `for (const listing of listings)` loop. Key facts, verified by reading the code directly:
- Line 477-478: skips listings with `precio_monto === null` or `precio_moneda` not in `('UF','CLP')` — silent skip, no error.
- Line 480-481: `cohort = latestByComuna.get(listing.comuna) ?? cityCohort` — falls back to citywide silently inside this function; the fallback flag (`usoFallback`) that `obtenerBandasMercadoLocales()` computes (line 292-307) is **not** surfaced here. The detail page's `muestra_n`/fallback banner must come from calling `obtenerBandasMercadoLocales()` directly (which already returns `usoFallback` + `muestraNComuna`), not from whatever cohort math lives inside the oportunidades loop.
- Lines 489-494: `reasonCodes` push order is `below_p25_ufm2` (checked first, only if `precioUfM2 !== null`) **else** `below_p25_uf` — these are mutually exclusive in the current code (`else if`), not both-possible. `evaluarOportunidad()` must preserve this exact branching, not "fix" it into an independent-checks version, or list-view and detail-view will diverge (the one bug this whole phase exists to prevent).
- Lines 496-501: `price_drop_7d` requires `historial.length >= 2` within the already-queried 7-day window and compares the **last two entries only** (not min-vs-max over the window).
- Line 503: **the entire result is discarded (`if (reasonCodes.length > 0)`) if no reason code fired.** This is the critical fact for DETA-05 (see "Comparables" section below) — this function is a *filter*, not a general listing-by-id/cohort fetcher.
- Line 519: sort key is `precioUfM2Normalizado ?? precioUfNormalizado` ascending — a `null` UF/m² silently falls back to comparing raw UF against other rows' UF/m², which is the "different bases in one field" pattern Pitfall 5 flags; not a detail-phase concern per se (this sort stays in the list function) but do not copy this sort pattern into the new comparables sort — write it correctly there per the CONTEXT.md `null`-goes-last rule implied by Pitfall 5.

**`obtenerBandasMercadoLocales(comunaEntrada, operacion, tipoPropiedad?)` (lines 274-308):** already exactly what the "Posicionamiento vs. cohorte" tab needs. Returns `BandasMercadoLocal` (lines 218-233) with `muestraN`, `p25Uf`/`medianaUf`/`p75Uf`, `p25UfM2`/`medianaUfM2`/`p75UfM2`, `usoFallback: boolean`, `muestraNComuna: number` (the comuna's own N even when the returned bands are the citywide fallback — exactly what the CONTEXT.md-mandated banner needs to say "N={muestraNComuna} en la comuna, mostrando cifras metropolitanas"). `MIN_COHORT_SIZE = 15` (line 61) is the exact threshold already gating the fallback inside this function — the detail page does **not** need to re-implement this check, only read `usoFallback` off the return value.

**`obtenerHistorialMedianaUfM2()` (lines 318-346):** zone-level median trend, not per-listing price history. **Not** the function for "historial de precio del listing" (DETA-03) — that must be a new query directly against `mercado_locales_historial_precio` filtered by `listing_id` (see schema below), there is no existing helper for it.

### Schema (verified against migration files, not assumed)

`supabase/migrations/20260802_mercado_locales_listings.sql`:
- `mercado_locales_listings`: `id uuid PK`, `fuente`/`fuente_id`/`url`/`titulo`, `operacion text` (`'arriendo'|'venta'`), `tipo_propiedad text DEFAULT 'local_comercial'`, `comuna`, `precio_monto numeric(14,2)`, `precio_moneda text` (`'UF'|'CLP'`), `superficie_m2 numeric(10,2)`, `status text DEFAULT 'activo'` (`'activo'|'dado_de_baja'`), `primera_vez_visto_el timestamptz`, `ultima_vez_visto_el timestamptz`, `dado_de_baja_el timestamptz`, `atributos_raw jsonb`. RLS: `FOR SELECT TO authenticated USING (true)` — no workspace scoping, confirms ARCHITECTURE.md's finding that `/oportunidades/[id]` needs no ownership check.
  - `primera_vez_visto_el`/`ultima_vez_visto_el` are `timestamptz` (already include time) — for DETA-03 "días publicado," compute `Math.floor((Date.now() - new Date(ultima_vez_visto_el).getTime()) / 86400000)` style math directly on the ISO string with `new Date(iso)` (correct here, no `T00:00:00` needed — these are NOT date-only fields, unlike `stats_date` below). Do not apply the date-only-field fix pattern here; that would be a different bug (needlessly forcing midnight on a real timestamp).
  - `status` — a listing can be `dado_de_baja`; ARCHITECTURE.md's caveat holds: the detail page must render this state ("aviso ya no activo") rather than 404, since `obtenerOportunidadPorId()` should not filter by `status = 'activo'` the way the list query does.
- `mercado_locales_historial_precio`: `id uuid PK`, `listing_id uuid FK → mercado_locales_listings(id) ON DELETE CASCADE`, `precio_monto numeric(14,2)`, `precio_moneda text`, `capturado_el timestamptz`. Populated by a DB trigger (`registrar_historial_precio_mercado_local`, lines 97-117) on every INSERT/UPDATE where price actually changed — this is real, trigger-guaranteed history, not something the app can miss by forgetting to write it. Index `(listing_id, capturado_el)` already exists — a query `WHERE listing_id = $1 ORDER BY capturado_el` is index-backed, no new index needed.

`supabase/migrations/20260802_mercado_locales_stats.sql`:
- `mercado_locales_stats_diarias`: `stats_date date` (**date-only — this IS a Pitfall 7 field**, any new formatter touching `stats_date` must use `${iso}T00:00:00`), `comuna` (real name or `'__TODAS__'` sentinel), `tipo_propiedad`, `operacion`, `muestra_n integer`, `mediana_uf`/`p25_uf`/`p75_uf numeric`, `muestra_area_n integer`, `mediana_uf_m2`/`p25_uf_m2`/`p75_uf_m2 numeric(10,4)`, `uf_valor_usado numeric(10,2)`. Unique index on `(stats_date, comuna, tipo_propiedad, operacion)`.

### `oportunidades/page.tsx` (full file read — 176 lines)

Confirms every claim in ARCHITECTURE.md: pure `async function` Server Component, `searchParams: Promise<{...}>` awaited at the top (Next 16 convention, see below), `REASON_LABEL` is a local `const` (lines 18-22) that must move to a shared module, `formatFechaCorta` is a local function (lines 26-31) using the correct `${iso}T00:00:00` + `timeZone: "America/Santiago"` pattern — **this exact function must be extracted to a new shared file (e.g. `lib/formato-fecha.ts`) before the detail page's first date-rendering component is written**; verified this file does not exist yet (`ls lib/formato-fecha.ts` → no such file). Card markup (lines 133-172) is the exact place the "Ver ficha completa" link (CONTEXT.md-mandated) gets added, alongside the existing external `<a href={o.url}>` link — both coexist, per the locked decision.

`obtenerOportunidadesMercadoLocales` call sites (grepped project-wide — 5 total): `oportunidades/page.tsx`, `app/api/reportes-mercado/route.ts`, `app/(dashboard)/dashboard/page.tsx` (×2, arriendo+venta), `lib/mercado-inmobiliario-copiloto.ts`. None of these need to change for this phase — the refactor must be behavior-preserving for all five.

### Next.js 16 App Router — dynamic route params (verified against `node_modules/next/dist/docs/`, not training data)

`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` confirms the convention already used elsewhere in this repo (`app/api/propiedades-portafolio/[id]/route.ts`) is current, not stale: Server Component pages receive `params: Promise<{ id: string }>` and must `await params` (or `use(params)` in a Client Component) — this is unchanged from what ARCHITECTURE.md already documented. **No version-specific surprise found here** — the async-params convention in this Next version matches what a Server Component `[id]/page.tsx` should already do. Example from the official doc:
```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
}
```

### `InformeEjecutivo` + SSE pattern (DETA-06) — verified end-to-end

`components/mercado-inmobiliario/informe-ejecutivo.tsx` (full file read): takes `content: string` (raw markdown from the model) + `fuentes: FuenteInforme[]` (`{label, disponible}[]` — real signal booleans, never fabricated metadata per its own header comment). It regex-splits out a `## Resumen Ejecutivo`-titled section (`MARCADOR_RESUMEN = /res(u|ú)men ejecutivo/i`) and degrades gracefully (shows full content, no special box) if the model doesn't produce that heading — so **the new prompt for oportunidades must instruct the model to emit a `## 🎯 Resumen Ejecutivo` heading** (or equivalent matching the regex) for the component to work as intended.

Caller pattern, verified in `app/(dashboard)/mercado-inmobiliario/tasacion/page.tsx` (full file read, `"use client"`, wrapped in `<Suspense>`):
1. `handleSubmit` → `fetch("/api/tasacion", {method:"POST", body: JSON.stringify(form)})`.
2. `for await (const data of leerEventosSSE(response))` (from `lib/sse-client.ts`) — this helper (read in full) already solves chunk-buffering/UTF-8-splitting correctly; **reuse it as-is, do not write a new SSE parser.**
3. Each `data` is `JSON.parse`d as `{text?, status?, error?, avaluoFiscal?}` — `text` deltas accumulate into `streamingText` for live display; `status` shows a transient "Buscando…" line; `error` throws.
4. On stream end, `result = accumulated` is passed to `<InformeEjecutivo content={result} fuentes={[...]} />`.

Server side, verified in `app/api/tasacion/route.ts` (full file read): `aiAuthGuard()` → `checkRateLimit(`ai:${userId}`)` → `recordUsage(userId, 'ai_chats')` (called **before** streaming starts, with a comment explaining why: if the client aborts mid-stream, usage must still be recorded because the OpenAI call already happened and was already paid for) → builds a `ReadableStream` that enqueues `data: ${JSON.stringify({text})}\n\n` chunks and a final `data: [DONE]\n\n`, with `Content-Type: text/event-stream`.

**Correction to milestone-level research — the underlying model call must NOT be `streamConBusquedaWeb`:** `lib/ai.ts:176-186` shows `streamConBusquedaWeb(instructions, input)` hardcodes `tools: [{ type: 'web_search_preview' }]` on OpenAI's Responses API. Its own header comment (lines 160-167) explains it exists *because* Tasación and Due Diligence have no real comparables table and web search is their only option. Oportunidades is the opposite case — `mercado_locales_stats_diarias` and the comparables list are real, already-computed data. Reusing `streamConBusquedaWeb` verbatim would let the model search the web for its own market context, which is exactly Pitfall 6's warned-against pattern ("el modelo puede inventar un rango de mercado plausible pero no anclado a los datos reales de PermisoHub"). `lib/ai.ts` has no existing streaming function without the web-search tool attached — this phase needs either (a) a small new function in `lib/ai.ts` (e.g. `streamConContexto(instructions, input)` calling `ai.responses.create({model, instructions, input, stream:true, max_output_tokens: N})` with no `tools`), or (b) building the executive-summary prompt so the *only* input it needs is inline in `input` (the real `muestra_n`, percentiles, comparables, reasonCodes already fetched server-side) and instructing the model explicitly not to search — the safer, structurally-enforced choice is (a), since it makes fabrication impossible rather than merely discouraged by prompt wording.

### Chart components to reuse as-is (all read in full — no props need to change)

- `components/mercado-inmobiliario/charts/gauge-arc.tsx`: `{value, max, label, valueLabel, color}` — plain SVG semicircular gauge, no recharts. Fits "posición en la banda" (e.g. `value=precioUf, max=p75Uf` or similar, `color` passed by caller based on verdict).
- `components/mercado-inmobiliario/charts/desviacion-bar.tsx`: `{variacionPct, color, max?=50}` — horizontal divergent bar around zero. Fits "% vs. mediana de cohorte."
- `components/mercado-inmobiliario/charts/histograma.tsx`: exports `binarValores(valores, numTramos): number[]` as a standalone pure function (line 39) specifically so it's reusable outside the component (its own comment says so) — candidate if the detail page wants a histogram of comparable prices; the component itself already degrades gracefully (`valores.length < 2` → "Sin datos suficientes" message), matching the never-hide-never-fabricate discipline.
- `components/mercado-inmobiliario/charts/kpi-card.tsx`: has an existing `verificado?: boolean` prop that renders a "Verificado"/"Estimado" pill (lines 30-40) — this is a **direct precedent** for the CONTEXT.md-mandated "Estimado de zona" badge on DETA-07, though the exact wording ("Estimado de zona" vs. generic "Estimado") should be a distinct, more specific label per the locked decision, not reuse of the generic pill text verbatim.
- `components/mercado-inmobiliario/charts/ranking-bar-chart.tsx`: `{titulo?, items: {label, valor, color?}[], formatValor?, height?}`, sorted descending by `valor` internally — usable for comparables-by-price if desired, not mandated.

### Tabs (CONTEXT.md-mandated layout)

`components/ui/tabs.tsx` already exists and is already used in this exact codebase — confirmed via `grep`: `app/(dashboard)/proyectos/[id]/page.tsx` and `app/(dashboard)/mercado-inmobiliario/calculadora/page.tsx`. The calculadora usage (`Tabs defaultValue="uf"` → `TabsList` → `TabsTrigger`/`TabsContent` per section) is a directly copyable pattern for the "Resumen | Posicionamiento | Historial | Comparables" tabs CONTEXT.md requires — no new component needed, no research gap here.

### Prominent warning banner (CONTEXT.md-mandated for muestra chica / fallback)

Verified an exact existing visual pattern to copy, `app/(dashboard)/patentes/page.tsx:221-227` and `:239-245` (both read in full):
```tsx
<div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
  <span className="mt-0.5 text-amber-500">⚠</span>
  <div className="text-sm">
    <span className="font-semibold text-amber-800">{titulo}</span>
    <span className="ml-1 text-amber-700">{cuerpo}</span>
  </div>
</div>
```
This is the closest existing "prominent banner" (not a subtle note) in the codebase — `pricing/page.tsx`'s `usoFallback` handling by contrast is just an inline text label ("Región Metropolitana (respaldo)"), which is explicitly **not** prominent enough per the CONTEXT.md decision ("banner de advertencia prominente... no una nota discreta") — do not copy the pricing/page.tsx treatment for this phase; copy the patentes/page.tsx amber-banner treatment instead.

## Correction to milestone research: comparables (DETA-05) need a new query, not a filtered reuse

FEATURES.md's MVP list (line 47) suggested: *"Reusar `obtenerOportunidadesMercadoLocales` filtrando por comuna+tipo, excluyendo el activo actual."* Having now read `obtenerOportunidadesMercadoLocales` in full (lines 372-521), this is **not correct** and the planner should not follow it literally:

- That function only returns listings where `reasonCodes.length > 0` (line 503) — i.e., only listings the system has already flagged as "cheap/dropping," a small, self-selecting subset of all active listings in a cohort.
- CONTEXT.md's locked criterion for comparables is "mismo comuna + tipo de propiedad + operación (match exacto en los tres), ordenados por cercanía de precio UF/m²" — nothing in that criterion requires the comparable itself to *also* be a flagged "oportunidad." A comuna×tipo×operación cohort with, say, 40 active listings might have only 3-4 flagged as oportunidades; filtering comparables to that subset would make the "0 or 1 comparable" empty-state (which CONTEXT.md explicitly requires handling gracefully) trigger far more often than the real data supports, and would silently exclude perfectly valid same-cohort listings from the comparison.
- **Correct approach:** a new function (e.g. `obtenerComparablesOportunidad(comuna, operacion, tipoPropiedad, excludeId, precioUfM2Objetivo)`) that queries `mercado_locales_listings` directly with `.eq('status','activo').eq('comuna',...).eq('operacion',...).eq('tipo_propiedad',...).neq('id', excludeId)` (same shape as the listings query already inside `obtenerOportunidadesMercadoLocales`, lines 417-424, minus the `reasonCodes` computation), then sorts by `Math.abs(precioUfM2 - precioUfM2Objetivo)` ascending in application code — with the same null-goes-last discipline as Pitfall 5 (a comparable with `precioUfM2Normalizado === null` should sort after all comparables with a real value, never coerced to `0` or treated as "closest").
- This also naturally reuses `evaluarOportunidad()` (once extracted) per comparable row, so each comparable mini-card can show its own `reasonCodes` badge (CONTEXT.md: "badge de reason code") — a comparable that happens to score zero reasonCodes still displays (it's a valid comparable, just not itself a flagged oportunidad), consistent with "never hide/never fabricate."

## Correction/clarification: rentabilidad implícita de zona (DETA-07) data availability

FEATURES.md and the milestone SUMMARY already correctly identify the formula (venta ÷ arriendo UF/m² medians of the same comuna×tipo) and the "only when both bands exist" gate. Verified mechanically here: `obtenerBandasMercadoLocales(comuna, 'arriendo', tipoPropiedad)` and `obtenerBandasMercadoLocales(comuna, 'venta', tipoPropiedad)` are two independent calls (same function, different `operacion` arg) — there is no existing helper that fetches both at once. The detail page must call both explicitly and handle each independently possibly returning `null` (function returns `null` at line 306 if even the citywide rollup has no row yet) or returning a row with `p25UfM2 === null` (if `muestra_area_n` — i.e., listings with known `superficie_m2` — is zero even though `muestra_n` might be nonzero). CONTEXT.md's mandated message ("sin datos de venta suficientes en esta comuna×tipo") must distinguish these — a fully-`null` bandas result vs. a present-but-`p25UfM2`-null result are both "insufficient," but the exact copy should read naturally either way; this is a UI-copy decision for planning, not a data gap.

One nuance not previously flagged: `obtenerBandasMercadoLocales` can return `usoFallback: true` for *either* the arriendo or venta call independently (e.g., comuna has enough venta listings but falls back to citywide for arriendo). If DETA-07's yield calc silently uses one fallback-derived band and one comuna-real band, the resulting "estimado de zona" number mixes a citywide input with a comuna-specific input without saying so — worth surfacing both `usoFallback` flags in the calculation breakdown CONTEXT.md already mandates showing (arriendo band + venta band, both with their own N and fallback status, not just two bare numbers).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|--------------|
| Cohort P25/mediana/P75 lookup with small-sample fallback | New query/threshold logic in the detail page | `obtenerBandasMercadoLocales()` — already does exactly this, `lib/mercado-locales-server.ts:274-308` |
| SSE parsing on the client | New `ReadableStream`/`TextDecoder` loop | `leerEventosSSE()` from `lib/sse-client.ts` — already handles chunk-buffering and UTF-8 splitting correctly |
| "Resumen ejecutivo" extraction/display from AI markdown | New markdown-section-splitting component | `<InformeEjecutivo>` — already does this, `components/mercado-inmobiliario/informe-ejecutivo.tsx` |
| Chile timezone-correct date formatting for `date`-only fields | A new `new Date(iso)` call | Extract `formatFechaCorta` (currently inline in `oportunidades/page.tsx:26-31`) to a shared `lib/formato-fecha.ts` before writing the first new date display |
| Semicircular gauge / divergent deviation bar SVG | New chart primitives | `<GaugeArc>` / `<DesviacionBar>` — already built, plain SVG, no recharts dependency |
| Tabbed section layout | Custom tab state | `components/ui/tabs.tsx` (shadcn) — already used twice in this codebase |

## Common Pitfalls

(Full detail already in `.planning/research/PITFALLS.md` — restating only the subset directly load-bearing for this phase's tasks, plus the two corrections above which are new findings from reading the actual code.)

### Pitfall A: Divergent scoring between list and detail
**What goes wrong:** `evaluarOportunidad()` reimplements the branching at lines 489-501 slightly differently (e.g., making `below_p25_ufm2`/`below_p25_uf` independent checks instead of `else if`), so the same listing shows different reasonCodes on the list vs. the detail page.
**How to avoid:** Extract verbatim first, verify behavior-preservation by comparing `obtenerOportunidadesMercadoLocales()` output before/after refactor for a fixed input (manual diff or a small script), only then build new callers on top.

### Pitfall B: Comparables built from the wrong source function
**What goes wrong:** Following FEATURES.md's literal suggestion to reuse `obtenerOportunidadesMercadoLocales()` for comparables — silently shrinks the comparable pool to only other flagged oportunidades, contradicting the "match exacto en comuna+tipo+operación" criterion CONTEXT.md locked.
**How to avoid:** New query against `mercado_locales_listings` directly (see correction above), not the oportunidades-filtering function.

### Pitfall C: Executive summary AI call using `streamConBusquedaWeb` unmodified
**What goes wrong:** Reusing the Tasación/DD streaming call as-is lets the model search the web instead of citing the real `muestra_n`/percentiles/comparables already computed server-side — the exact fabrication risk Pitfall 6 (milestone PITFALLS.md) describes.
**How to avoid:** New non-web-search streaming function in `lib/ai.ts`, prompt receives real numbers as structured context in `input`.

### Pitfall D: `stats_date` (date-only) formatted with bare `new Date(iso)`
**What goes wrong:** Any new component showing `stats_date` from `mercado_locales_stats_diarias` (e.g., "banda calculada el...") off-by-one-days if parsed without `T00:00:00`.
**How to avoid:** Route through the shared `formato-fecha.ts` helper (extracted per Pitfall/Don't-Hand-Roll above) for this field specifically; `primera_vez_visto_el`/`ultima_vez_visto_el`/`capturado_el` are `timestamptz` and are correctly parsed with bare `new Date(iso)` — do not apply the `T00:00:00` fix to those, that would itself be a (different) bug.

### Pitfall E: `precioUfM2Normalizado: null` sorted as if it were the cheapest comparable
**What goes wrong:** A naive `.sort((a,b) => (a.x ?? 0) - (b.x ?? 0))` on comparables-by-price-proximity puts a listing with unknown surface area first, as if its distance from the target price were zero.
**How to avoid:** `null`-aware sort — listings without `superficieM2`/`precioUfM2Normalizado` go to the end of the comparables list (or their own labeled subsection), never treated as "closest."

## Open Questions

1. **Executive-summary streaming function shape.**
   - What we know: `streamConBusquedaWeb` (lines 176-186 of `lib/ai.ts`) is the only existing streaming entry point and it hardcodes web search — wrong tool for this domain per Pitfall 6.
   - What's unclear: whether the planner should add a small sibling function to `lib/ai.ts` (`streamConContexto` or similar, no `tools`) or reuse `aiComplete`'s non-streaming path and fake SSE framing around it. The former matches the codebase's existing separation-of-concerns (`lib/ai.ts` owns model-call shape, routes own SSE framing) better.
   - Recommendation: add the new no-web-search streaming function to `lib/ai.ts`, following the exact param/return shape of `streamConBusquedaWeb` minus the `tools` array, so `app/api/oportunidades/[id]/resumen/route.ts` (or similar new route) can copy `app/api/tasacion/route.ts`'s framing loop almost verbatim.

2. **Exact route path for the SSE resumen endpoint.**
   - What we know: the pattern is `POST /api/{feature}` returning SSE, called from a `"use client"` handler on the page.
   - What's unclear: whether this should be `app/api/oportunidades/[id]/resumen/route.ts` (nested under the id) or `app/api/mercado-locales/resumen/route.ts` (id in body) — both are viable, no existing precedent nests an SSE route under a dynamic `[id]` segment in this codebase (`app/api/tasacion/route.ts` takes the full input in the POST body instead). Following that precedent (id/data in POST body, flat route) is likely the lower-friction choice and avoids a new nesting pattern.
   - Recommendation: flat route taking the already-server-fetched detail data in the POST body (mirrors Tasación exactly), not nested under `[id]`.

3. **Caching strategy for the on-demand resumen (Claude's Discretion per CONTEXT.md).**
   - What we know: it's now on-demand (button-triggered), lowering the stakes vs. an auto-generated version; no existing cache precedent for `InformeEjecutivo` content in this module (Tasación/DD both regenerate fresh on every submit, no caching observed in the read files).
   - What's unclear: whether "cache" means client-side (don't re-fetch if the user re-opens the same tab without navigating away) or server-side (persist last-generated summary per listing id, e.g. in a new small table or a JSON column). Given this is explicitly marked founder-discretion-lowered in CONTEXT.md, the simplest defensible default is **no persistence** — regenerate on each button click, matching the zero-caching precedent of Tasación/DD — and revisit only if usage data shows repeated identical requests are common.

4. **Rate limiting / usage accounting for the new SSE route.**
   - What we know: `app/api/tasacion/route.ts` calls `aiAuthGuard()` → `checkRateLimit(`ai:${userId}`)` → `recordUsage(userId, 'ai_chats')` before streaming.
   - What's unclear: whether the oportunidades resumen should count against the same `ai_chats` metric/limit or a separate one. No signal in CONTEXT.md either way.
   - Recommendation: reuse `ai_chats` (same guard/limit/usage triple as Tasación) — introducing a new metric is out of scope for what this phase asked for, and the existing metric already generically means "an AI-generated report was requested."

## Sources

### Primary (HIGH confidence — direct code/schema reads this session)
- `lib/mercado-locales-server.ts` (full file, 523 lines) — `evaluarOportunidad()` extraction target, `obtenerBandasMercadoLocales()`, `MIN_COHORT_SIZE`, `OportunidadMercadoLocal` shape
- `supabase/migrations/20260802_mercado_locales_listings.sql` (full file) — `mercado_locales_listings`, `mercado_locales_historial_precio` schema, RLS, trigger
- `supabase/migrations/20260802_mercado_locales_stats.sql` (full file) — `mercado_locales_stats_diarias` schema, `calcular_bandas_mercado_locales()` RPC
- `app/(dashboard)/mercado-inmobiliario/oportunidades/page.tsx` (full file) — existing card markup, `REASON_LABEL`, `formatFechaCorta`
- `components/mercado-inmobiliario/informe-ejecutivo.tsx` (full file) — resumen extraction contract
- `app/(dashboard)/mercado-inmobiliario/tasacion/page.tsx` (full file) — client SSE consumer pattern
- `app/api/tasacion/route.ts` (full file) — server SSE producer pattern, auth/rate-limit/usage ordering
- `lib/sse-client.ts` (full file) — `leerEventosSSE()`
- `lib/ai.ts` (relevant sections) — `streamConBusquedaWeb()` shape and why it's wrong for this domain
- `components/mercado-inmobiliario/charts/{gauge-arc,desviacion-bar,histograma,kpi-card,ranking-bar-chart}.tsx` (all full files)
- `app/(dashboard)/patentes/page.tsx` (relevant sections) — prominent amber warning-banner pattern
- `app/(dashboard)/mercado-inmobiliario/pricing/page.tsx` (relevant sections) — the *insufficiently* prominent fallback treatment to avoid copying
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — confirms async `params: Promise<{...}>` convention is current in this Next version
- `lib/scrapers/mercado-locales-common.ts` (grepped) — `TipoPropiedadComercial`, `OperacionMercadoLocal`, `TIPO_PROPIEDAD_LABEL`, `TIPO_PROPIEDAD_DEFAULT`
- `app/(dashboard)/mercado-inmobiliario/calculadora/page.tsx` (grepped) — existing `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` usage to copy

### Secondary (inherited from milestone-level research, not re-verified this session — already HIGH confidence per their own sourcing)
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `FEATURES.md` — full milestone research, read in full this session, forms the backbone of this document

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every component/helper cited was read directly from the repo this session
- Architecture: HIGH — Server Component + client chart islands pattern already used in 4/9 module pages, async-params convention confirmed against actual Next.js docs shipped in `node_modules`
- Pitfalls: HIGH — the two corrections in this document (comparables source function, streaming function choice) came from reading the actual implementation, not inference from the milestone brief

**Research date:** 2026-08-02
**Valid until:** 30 days (stable internal codebase, no external dependency risk)
