# Phase 12: Integración con Motores de Decisión - Research

**Researched:** 2026-07-30
**Domain:** Internal integration — wiring an existing, live-verified data source (Phase 11 zonificación fields on `proyectos`) into three existing engines (`via-tramitacion.ts`, `due-diligence.ts`, Copiloto IA) as additive context/citation, with zero regression for projects without zoning data.
**Confidence:** HIGH (all findings sourced directly from this repo's code, no external library research needed — this phase adds no new dependencies)

## Summary

Phase 12 is a pure internal-integration phase: no new libraries, no new architecture, just threading already-live `zona_*` columns (Phase 11) into three engines that don't currently read them. I read every file in scope end to end. The codebase already gives near-complete answers to all seven research questions:

1. **"Uso declarado" has no dedicated field.** The closest existing candidate is `Proyecto.destino_sii` (SII enrichment, e.g. "CASA HABITACION", "COMERCIO") — it's *already* piped into `ViaGuiada` as read-only display context (`via-guiada.tsx:124,213-227`) next to the `cambiaDestino` question, but it is never compared against anything. `Proyecto.tipo` (`TipoPermiso`) is a trámite-type enum, not a use — not a good match. Recommendation: use `destino_sii` as "uso declarado" for INTEG-01, reusing the existing `verificarCompatibilidadUso()` AI check (Phase 11, COMPAT-01) rather than inventing a second compatibility mechanism or a new UI field.

2. **`recomendarVia()` is a pure, synchronous, unit-tested deterministic function** (`lib/via-tramitacion.ts:73-130`) with explicit determinism tests (`tests/unit/via-tramitacion.test.ts:75-79`: "mismo input → mismo output", `toEqual`). It takes only `RespuestasVia` (5 booleans) — no project data, no zona fields, no I/O. INTEG-01's "alerta citada" must be computed and rendered **entirely outside** `recomendarVia()`/`pasoSiguiente()` — as a sibling UI element in `ViaDecision`/`ViaGuiada`, not inside `ViaRecomendada.alertas` (which is populated synchronously inside `recomendarVia`). This is a firm architectural boundary, not a style preference — the test suite will catch any signature/behavior change.

3. **`due-diligence.ts` is AI-driven (map-reduce over GPT-4o)**, not deterministic. `RefNormativa.fuente: FuenteNormativa` (`'OGUC'|'LGUC'|'DDU'`, imported from `lib/normativa-retrieval.ts`) is resolved by `resolverRefNormativa()` against the curated static corpus via `getArticuloById()`. Per the existing Phase 11 decision (already correctly identified in the phase brief — do not re-litigate), PRC/zonificación citations must NOT reuse `FuenteNormativa`/`verificado` semantics because they're live per-parcel GIS data, not curated-corpus-existence checks. The clean fix: add a **local, due-diligence-only union** `type FuenteHallazgo = FuenteNormativa | 'PRC'`, change `RefNormativa.fuente` to that type, and give `resolverRefNormativa()` a separate code path for `'PRC'` that builds the citation directly from the project's own `zona_codigo`/`zona_nombre`/`zona_fuente_url` (not `getArticuloById`, which doesn't know about PRC). `verificado: true` for a `'PRC'` ref should mean "this citation points to real per-project zona data the user can see" (i.e., `zona_status === 'encontrado' && zona_usos_disponibles`) — not the curated-corpus meaning.

4. **The UI that renders citations, `CitaBadges` in `due-diligence-report.tsx:732-767`, is 100% generic** — it does not branch on `fuente`, it just renders `r.etiqueta` as a link to `r.url` when `r.verificado`, or a "Sin fundamento verificado" pill otherwise. **A `'PRC'` `RefNormativa` will render correctly with zero changes to `due-diligence-report.tsx`.**

5. **The exact guard set for "estrictamente aditivo"**: `zona_status === 'encontrado' && zona_usos_disponibles === true` is the necessary condition for all three integrations to have anything to say. `'pendiente' | 'sin_cobertura' | 'error'` must behave exactly as pre-v1.4 (matches requirement 4 literally). Critically: `zona_status === 'encontrado' && zona_usos_disponibles === false` (the Ñuñoa case) must **also** be excluded from citing/context-injection in all three engines — there is no `uperm`/`uproh` text to cite, and both `ZonificacionCard` (`zonificacion-card.tsx:147-162`) and `verificarCompatibilidadUso()` (`zonificacion-compat.ts:22-27`) already treat `usosDisponibles===false` as "nothing to compare," confirming this is the codebase's established convention, not a new rule to invent.

6. **INTEG-01's "no calza" condition should reuse `verificarCompatibilidadUso()` verbatim**, not a new mechanism — but there's a real design tension: it's AI-assisted (non-deterministic), used today as a **user-triggered, on-demand, unpersisted** check (`UsoCompatibleCheck` component, free-text input, `POST /api/proyectos/[id]/compatibilidad`, deliberately not stored per the route's own comment at `app/api/proyectos/[id]/compatibilidad/route.ts:14-17`). For INTEG-01 to show an alert "automatically" on the vía screen, the cleanest option consistent with existing conventions is: on mount, `ViaDecision`/`ViaGuiada` (which already do two silent background `fetch`es on mount — cuadro-cálculo and via-tramitación) fire a **third** background call to the existing `/api/proyectos/[id]/compatibilidad` endpoint, using `destino_sii` as `usoPretendido`, guarded by the condition in point 5. Result is held in component state only (matches COMPAT-01's own "don't persist, it's contextual" decision) — no schema/migration needed. Only render the alert when `estado === 'no_permitido'`.

7. **Where the alert renders**: `ViaDecision` (`components/proyecto/via-decision.tsx`) is the flat, always-visible panel rendered directly in the project's PMO tab (`pmo-panel.tsx:181`, receives `proyectoId` and `destinoSii` already — it currently does NOT receive `zona_status`/`zona_usos_disponibles`/`zona_uperm`/`zona_uproh`/`zona_fuente_url`, these need to be threaded through as new props or by passing the whole `proyecto` object). The natural slot is a new alert block between the "Resultado" section and the "Guiarme paso a paso" footer — reusing the exact same `AlertTriangle` + `var(--state-warn)` visual pattern already used for `rec.alertas` two lines above it (lines 154-163), just with an added citation link (same pattern as `rec.cita`, lines 142-152). `ViaGuiada` (the guided step dialog) already has a precedent for external non-deterministic context inline with a question (`destinoSii` shown as an informational chip at `via-guiada.tsx:223-227`) — the same visual treatment (bordered chip) is appropriate there too, on the `cambiaDestino` step.

**Primary recommendation:** Treat this phase as three small, independent "thread the data through" changes with a single shared guard condition (`zona_status === 'encontrado' && zona_usos_disponibles`), reusing every existing mechanism (COMPAT-01's `verificarCompatibilidadUso`, `RefNormativa`'s existing render path, `aiComplete()`'s existing prompt-assembly pattern) rather than building anything new. The only genuinely new code is: (a) a `FuenteHallazgo` union + PRC resolution branch in `due-diligence.ts`, (b) prop-threading + a new alert block in `via-decision.tsx`, (c) 4 one-line prompt-string additions in `copiloto/route.ts`.

## User Constraints

No CONTEXT.md exists for this phase — `/gsd:discuss-phase` was not run. There are no locked user decisions to honor; all recommendations below are Claude's discretion based on codebase conventions, flagged for the planner/user to confirm.

## Standard Stack

No new libraries. This phase modifies existing TypeScript modules only:

| File | Role in this phase |
|------|---------------------|
| `lib/via-tramitacion.ts` | Read-only (must NOT be modified — `recomendarVia()`/`pasoSiguiente()` stay untouched) |
| `lib/due-diligence.ts` | Extend `RefNormativa`, `ProyectoContexto`, `resolverRefNormativa()`, `buildSynthesisPrompt()` |
| `lib/zonificacion-compat.ts` | Reused as-is (`verificarCompatibilidadUso`) — no changes expected |
| `lib/normativa-retrieval.ts` | Read-only — do NOT add `'PRC'` to `FuenteNormativa` (Phase 11 decision) |
| `lib/zonificacion-format.ts` | Reused (`fixMojibakeArcGIS`) — apply when injecting `zona_uperm`/`zona_uproh` into any new AI prompt or citation string |
| `app/api/proyectos/[id]/via-tramitacion/route.ts` | Likely unchanged (persists respuestas/resultado only — alert is not part of what's saved) |
| `app/api/proyectos/[id]/compatibilidad/route.ts` | Reused as-is via a new automatic client-side call |
| `app/api/ai/due-diligence/route.ts` | Extend `ProyectoRow` + `procesar()` to pass zona_* fields into `ProyectoContexto` |
| `app/api/ai/copiloto/route.ts` | Extend `buildOgucPrompt()` and `buildChecklistPrompt()` (per requirement text); optionally `buildObservacionesPrompt()`/`buildEstimacionPrompt()` |
| `components/proyecto/via-decision.tsx` | New alert UI block; new props (zona fields) |
| `components/proyecto/via-guiada.tsx` | Optional: same informational-chip treatment as `destinoSii` on the `cambiaDestino` step |
| `components/proyecto/pmo-panel.tsx` | Thread zona fields (or the full `proyecto`) into `<ViaDecision>` (currently only passes `proyectoId` + `destinoSii`, `pmo-panel.tsx:181`) |
| `components/proyecto/due-diligence-report.tsx` | **No changes needed** — `CitaBadges` (line 732) is generic over `fuente` |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Reusing `verificarCompatibilidadUso()` for INTEG-01 | A new deterministic keyword-match against `zona_uperm`/`zona_uproh` | Deterministic, but duplicates COMPAT-01's already-built AI classification, and simple keyword matching against free-text uperm/uproh strings is exactly the kind of naive heuristic Phase 11 avoided by building an AI classifier in the first place. Not recommended. |
| Extending `FuenteNormativa` in `normativa-retrieval.ts` to include `'PRC'` | Local union type in `due-diligence.ts` | Extending `FuenteNormativa` would make `getArticuloById('PRC', ...)`, `getContextoNormativo`, `flagUnverifiedCita` etc. all need to handle a source they can't resolve (no curated PRC corpus) — high blast radius for zero benefit. Local union is safer and was already correctly identified as the constraint in the phase brief. |
| Auto-calling `verificarCompatibilidadUso` on every via-tramitación page load | Caching the compat result on the project row | Caching would require a migration + invalidation logic (when does `destino_sii` or `zona_uperm/uproh` change invalidate the cache?) — out of scope for a milestone explicitly scoped to "additive signal," and COMPAT-01 already deliberately chose NOT to persist for this exact reason (see `compatibilidad/route.ts:14-17`). Recommend keeping it uncached, client-state-only, exactly like the existing manual check. |

**Installation:** none — zero new dependencies.

## Architecture Patterns

### Pattern 1: Additive guard before any zona-aware code path

**What:** A single boolean guard, computed once, gates all three integrations.
```typescript
const zonaUtilizable = proyecto.zona_status === 'encontrado' && proyecto.zona_usos_disponibles === true
```
**When to use:** Before calling `verificarCompatibilidadUso` automatically in `ViaDecision`, before injecting a "## Zonificación" section into the due-diligence synthesis prompt, before appending zona text to any Copiloto skill prompt.
**Why this exact condition:** Established by Phase 11's own code — `ZonificacionCard` (`zonificacion-card.tsx:147`) and `verificarCompatibilidadUso` (`zonificacion-compat.ts:22`) both already treat `zona_usos_disponibles === false` as "nothing usable to compare," even when `zona_status === 'encontrado'`. Treating this condition differently in Phase 12 would be an inconsistency, not a new decision.

### Pattern 2: Non-deterministic signal lives strictly OUTSIDE the deterministic core

**What:** `recomendarVia()` and `pasoSiguiente()` (`lib/via-tramitacion.ts`) remain pure functions of `RespuestasVia` only. Any AI-assisted or zona-derived signal is computed in the React component (`ViaDecision`) as separate state, rendered as a sibling block, never passed into or returned from `recomendarVia`.
**When to use:** INTEG-01 specifically. This is non-negotiable per the phase's explicit success criterion #1 ("sin que `recomendarVia()` altere su árbol de decisión ni sus resultados") and is enforced today by `tests/unit/via-tramitacion.test.ts`'s determinism assertions (`toEqual` on repeated calls).
**Example (recommended shape, not yet in codebase):**
```typescript
// components/proyecto/via-decision.tsx — NEW state, alongside existing `r`/`rec`
const [compat, setCompat] = useState<{ estado: CompatEstado; justificacion: string } | null>(null)

useEffect(() => {
  if (!(proyecto.zona_status === 'encontrado' && proyecto.zona_usos_disponibles) || !destinoSii) return
  let cancelled = false
  void (async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/compatibilidad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usoPretendido: destinoSii }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (!cancelled) setCompat({ estado: data.estado, justificacion: data.justificacion })
    } catch { /* silencioso: señal opcional, igual que los otros dos useEffect de este componente */ }
  })()
  return () => { cancelled = true }
}, [proyectoId, destinoSii, proyecto.zona_status, proyecto.zona_usos_disponibles])
```
This mirrors the exact two existing `useEffect` blocks already in this file (lines 32-51, 54-70) — same silent-catch, same cancelled-flag idiom.

### Pattern 3: PRC citation resolved from project data, not corpus lookup

**What:** In `due-diligence.ts`, `resolverRefNormativa` gets a second parameter (or closure) with the project's zona context, and branches on `fuente === 'PRC'` before falling into the existing `getArticuloById` path.
**Example:**
```typescript
// lib/due-diligence.ts
export type FuenteHallazgo = FuenteNormativa | 'PRC'

export interface RefNormativa {
  fuente: FuenteHallazgo   // was: FuenteNormativa
  id: string
  etiqueta: string
  url?: string
  verificado: boolean
}

// ProyectoContexto gains (all optional, mirrors types/index.ts's zona_* optionality):
export interface ProyectoContexto {
  // ...existing fields
  zona_status?: string | null
  zona_usos_disponibles?: boolean | null
  zona_codigo?: string | null
  zona_nombre?: string | null
  zona_uperm?: string | null
  zona_uproh?: string | null
  zona_fuente_url?: string | null
}

function resolverRefNormativa(raw: RawRefNormativa[] | undefined, proyecto: ProyectoContexto): RefNormativa[] {
  if (!Array.isArray(raw)) return []
  const out: RefNormativa[] = []
  const zonaUtilizable = proyecto.zona_status === 'encontrado' && proyecto.zona_usos_disponibles === true
  for (const r of raw) {
    const fuenteRaw = typeof r.fuente === 'string' ? r.fuente.toUpperCase() : null
    if (fuenteRaw === 'PRC') {
      if (zonaUtilizable) {
        out.push({
          fuente: 'PRC',
          id: proyecto.zona_codigo ?? 'zona',
          etiqueta: `Zona ${proyecto.zona_codigo ?? ''}${proyecto.zona_nombre ? ` — ${fixMojibakeArcGIS(proyecto.zona_nombre)}` : ''}`.trim(),
          url: proyecto.zona_fuente_url ?? undefined,
          verificado: true,
        })
      }
      continue
    }
    // ...existing OGUC/LGUC/DDU branch unchanged
  }
  return out
}
```

### Recommended Project Structure

No new files/folders required — every change is inside an existing module. If preferred, extract the shared guard (`zonaUtilizable`) into a tiny exported helper, e.g. `lib/zonificacion-compat.ts`:
```typescript
export function zonaTieneUsosCitables(p: Pick<Proyecto, 'zona_status' | 'zona_usos_disponibles'>): boolean {
  return p.zona_status === 'encontrado' && p.zona_usos_disponibles === true
}
```
This avoids repeating the same two-field check in three different files (`via-decision.tsx`, `due-diligence.ts`, `copiloto/route.ts`) — cheap DRY win, not mandatory.

### Anti-Patterns to Avoid

- **Adding zona fields to `RespuestasVia` or as a parameter to `recomendarVia()`:** Breaks the explicit "no altera su árbol de decisión" requirement and the existing determinism test suite's contract. The alert is UI-adjacent, not decision-tree-adjacent.
- **Extending `FuenteNormativa` (in `normativa-retrieval.ts`) with `'PRC'`:** Already flagged as wrong in the phase brief; would force every corpus-lookup function (`getArticuloById`, `getContextoNormativo`, `flagUnverifiedCita`, `REGLAS_CITACION`) to reason about a source they structurally can't resolve.
- **Persisting the automatic compat-check result on `proyectos`:** No migration needed for this phase; COMPAT-01 already decided against persistence for the identical reason (uso pretendido / destino_sii can change between queries — see `compatibilidad/route.ts:14-17`). Keep it in-memory/client-state.
- **Injecting raw `zona_uperm`/`zona_uproh` into any prompt or citation label without `fixMojibakeArcGIS()`:** These strings come from ArcGIS and are known to contain double-encoding mojibake (see `lib/zonificacion-format.ts:1-6`, referenced as "Pitfall 6" in `11-RESEARCH.md`). **Note:** `app/api/proyectos/[id]/compatibilidad/route.ts:58-60` currently passes `proyecto.zona_uperm`/`zona_uproh` to `verificarCompatibilidadUso` WITHOUT calling `fixMojibakeArcGIS` first — this is a pre-existing gap in Phase 11 code, out of scope to fix here, but Phase 12's own new prompt-injection code (due-diligence, copiloto) should not repeat it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Uso-declarado vs zona compatibility classification | A new deterministic or AI-based classifier | `verificarCompatibilidadUso()` (`lib/zonificacion-compat.ts`) | Already built, already handles the "no data → no_especificado, never force a verdict" defensive pattern (Pitfall 4 per its own comments), already has its API route and rate limiting wired. |
| PRC citation rendering (link, "sin fundamento verificado" fallback) | A new citation badge component for PRC | Existing `CitaBadges` in `due-diligence-report.tsx:732-767` | Already generic over `fuente`; requires zero UI changes if `RefNormativa.verificado`/`url`/`etiqueta` are populated correctly. |
| Mojibake repair for ArcGIS zona text | A new sanitizer | `fixMojibakeArcGIS()` (`lib/zonificacion-format.ts`) | Already defensive (only transforms if pattern detected, never corrupts clean text), already used successfully in `zonificacion-card.tsx`. |
| Safe AI degradation when `OPENAI_API_KEY` missing | New try/catch scattered per call site | `isAIAvailable()` guard + existing try/catch fallback idiom (used throughout: `zonificacion-compat.ts:29`, `copiloto/route.ts:160`) | Established codebase convention (also cited in phase context as the Weekly-email precedent). |

**Key insight:** Every piece this phase needs already exists somewhere in the codebase in a slightly different context (compat checking, citation rendering, AI degradation, mojibake fixing). The work is wiring, not invention.

## Common Pitfalls

### Pitfall 1: Treating `zona_status === 'encontrado'` alone as sufficient
**What goes wrong:** A project in a comuna like Ñuñoa has `zona_status: 'encontrado'` but `zona_usos_disponibles: false` — `zona_uperm`/`zona_uproh` are structurally empty. Citing or comparing against empty strings produces either a false "no_permitido" or a nonsensical citation.
**Why it happens:** It's tempting to gate only on `zona_status`, since that's the field name that most directly signals "we have zoning data."
**How to avoid:** Always gate on the compound condition `zona_status === 'encontrado' && zona_usos_disponibles === true`.
**Warning signs:** A PRC citation or compat-check with no `zona_uperm`/`zona_uproh` text behind it; an alert firing for Ñuñoa-like comunas.

### Pitfall 2: Forgetting `destino_sii` can be `null`/`undefined`
**What goes wrong:** Many projects (especially older ones, or those without successful SII enrichment) have no `destino_sii`. If INTEG-01's automatic compat-check fires with an empty `usoPretendido`, the API route rejects it (`compatibilidad/route.ts:51-53`: `if (!usoPretendido) return 400`), which would surface as a spurious error/toast if not guarded client-side first.
**How to avoid:** Guard with `if (!destinoSii?.trim()) return` before calling the compat endpoint, in addition to the zona guard.

### Pitfall 3: Modifying `recomendarVia()`'s signature "just to pass zona data through cleanly"
**What goes wrong:** It's architecturally tempting to add an optional `zona?: {...}` parameter to `recomendarVia()` so the alert can live inside `ViaRecomendada.alertas` alongside the existing PRC-limit alert. This technically doesn't change *existing* call sites' behavior (optional param), but it does change the function's contract and blurs the "recomendarVia() no se altera" requirement, and risks a reviewer/tester treating any future non-deterministic input (AI compat check) as part of the deterministic core.
**How to avoid:** Keep the alert entirely in the UI layer (`ViaDecision`/`ViaGuiada`) as separate component state, never merged into `ViaRecomendada`.
**Warning signs:** Any diff touching `lib/via-tramitacion.ts` or `tests/unit/via-tramitacion.test.ts` for this phase should be treated as a red flag requiring justification.

### Pitfall 4: Copiloto skills silently exceeding token budget
**What goes wrong:** `buildOgucPrompt`, `buildObservacionesPrompt`, `buildChecklistPrompt`, `buildEstimacionPrompt` all run with fairly tight `max_tokens` caps (800–2000) already. Appending a full `zona_uperm`/`zona_uproh` string (which can be a long comma-separated list per the ArcGIS source) to every skill's prompt increases input tokens (not the capped output) but also increases prompt-assembly noise for skills where it isn't relevant.
**How to avoid:** Per requirement text, only `buildOgucPrompt` (diagnóstico OGUC) and `buildChecklistPrompt` (checklist) need the zona section — these are the two skills the requirement explicitly names. `buildObservacionesPrompt` (predicción de observaciones) and `buildEstimacionPrompt` (estimación de plazo/derechos) are not about use-compliance and don't have an obvious causal link to zona usos permitidos — recommend leaving them untouched to keep the change minimal and requirement-literal, but flag this as an open question for the user/planner (see below) since a reasonable case exists for `buildObservacionesPrompt` too (a use-incompatible project is itself a likely source of DOM observations).
**Warning signs:** None yet — this is a forward-looking judgment call, not an observed bug.

### Pitfall 5: `Proyecto` fetched with `select('*')` already includes zona fields — but narrow `ProyectoRow`/`ProyectoContexto` types in due-diligence's route do NOT
**What goes wrong:** `app/api/ai/due-diligence/route.ts` already does `select('*')` (line 216) so the raw Supabase row has all `zona_*` columns — but the local `ProyectoRow` interface (lines 37-44) and the `proyectoContexto` object built in `procesar()` (lines 166-172) only narrow-cast a handful of fields. Adding `zona_*` to `ProyectoContexto` in `due-diligence.ts` without also adding them to `ProyectoRow` and the `proyectoContexto` construction in the route will silently leave the synthesis prompt without zona context (TypeScript won't catch this — `proyecto.zona_uperm` on `ProyectoRow` would be a type error you'd have to fix, which is actually the safety net here).
**How to avoid:** Update `ProyectoRow` (route), `ProyectoContexto` (lib), and the `proyectoContexto` literal in `procesar()` together — all three must move in lockstep.

### Pitfall 6: `Copiloto` route already does `select('*')` and casts to full `Proyecto` — this one is safe
**What goes wrong:** N/A — noting explicitly because it's the opposite of Pitfall 5. `app/api/ai/copiloto/route.ts:172-182` does `.select('*')` and casts directly to `const p = proyecto as Proyecto`, so `p.zona_uperm`/`p.zona_uproh` are already type-safe and available with zero route changes — only the four `build*Prompt(p)` functions need a new conditional section appended.

## Code Examples

### Threading zona props into `ViaDecision` (pmo-panel.tsx)
```typescript
// components/proyecto/pmo-panel.tsx:181 — CURRENT
<ViaDecision proyectoId={proyecto.id} destinoSii={proyecto.destino_sii} />

// RECOMMENDED — pass the fields ViaDecision needs for the guard + compat check
// (or simplify by passing the whole `proyecto` object, since ViaDecision already
// receives `proyecto.id` and `proyecto.destino_sii` individually today — either
// works, prefer whichever keeps ViaDecision's prop surface consistent with its
// existing style)
<ViaDecision
  proyectoId={proyecto.id}
  destinoSii={proyecto.destino_sii}
  zonaStatus={proyecto.zona_status}
  zonaUsosDisponibles={proyecto.zona_usos_disponibles}
/>
```

### Appending zona context to Copiloto's OGUC + checklist prompts
```typescript
// app/api/ai/copiloto/route.ts — inside buildOgucPrompt(p) and buildChecklistPrompt(p)
function seccionZonificacion(p: Proyecto): string {
  const utilizable = p.zona_status === 'encontrado' && p.zona_usos_disponibles === true
  if (!utilizable) return ''
  const uperm = fixMojibakeArcGIS(p.zona_uperm) ?? '(sin dato)'
  const uproh = fixMojibakeArcGIS(p.zona_uproh) ?? '(sin dato)'
  return `\n## Zonificación (PRC) — ${p.zona_codigo ?? ''} ${p.zona_nombre ?? ''}\nUsos permitidos: ${uperm}\nUsos prohibidos: ${uproh}\n`
}

// then append `${seccionZonificacion(p)}` into buildOgucPrompt's and
// buildChecklistPrompt's template strings, right after "## Datos del proyecto"
```
This mirrors the existing `statsSection`/`intelSection` pattern already used in `buildObservacionesPrompt` (lines 55-69) — conditional string sections appended only when data exists, exact same idiom.

## State of the Art

Not applicable — this is a pure internal-integration phase with no external ecosystem to track. All "state of the art" is this codebase's own Phase 11 precedent, already summarized above.

## Open Questions

1. **Should `buildObservacionesPrompt` (predicción de observaciones) also receive zona context?**
   - What we know: requirement text names only "diagnóstico OGUC" and "checklist" explicitly.
   - What's unclear: a use/zone mismatch is plausibly a strong predictor of DOM observations, so there's a reasonable product argument for including it too.
   - Recommendation: implement OGUC + checklist only (requirement-literal, minimal blast radius) for this phase; leave `buildObservacionesPrompt`/`buildEstimacionPrompt` untouched. If the user wants it broader, it's a one-line addition to add later — don't gold-plate now.

2. **Should the INTEG-01 compat-check be a background auto-fetch (no user action) or a labeled button ("Verificar compatibilidad con el destino SII")?**
   - What we know: the requirement's wording ("via-tramitacion.ts muestra una alerta citada") reads as automatic/passive, matching how `rec.alertas` already renders automatically. The existing `UsoCompatibleCheck` component is manual/button-triggered by design (free-text input for an arbitrary "uso pretendido," not the project's actual declared use).
   - What's unclear: an automatic background OpenAI call on every visit to the vía tab has a real cost/latency tradeoff the user hasn't weighed in on (each such call goes through `checkRateLimit` + `aiComplete`, ~similar cost to the existing manual check).
   - Recommendation: implement as automatic background fetch (matches requirement wording and existing two-`useEffect` precedent in `ViaDecision`), but flag this cost tradeoff explicitly to the user/planner — a debounced/cached client-side approach (e.g., only refetch if `destino_sii` or `zona_consultada_el` changed, mirroring `ZonificacionCard`'s own re-fetch trigger at `zonificacion-card.tsx:42`) is a cheap mitigation worth planning in.

3. **Where exactly does INTEG-03's "cuando el proyecto tiene un resultado de zonificación disponible" apply for the checklist skill, given the checklist is only generated ONCE (`hasExistingChecklist` short-circuits regeneration, `copiloto/route.ts:223,228-230,254`)?**
   - What we know: if a checklist already exists, `buildChecklistPrompt` is never called again (`Promise.resolve(null)` at line 229) — so a project whose zonificación became available *after* its checklist was first generated will never get a zona-aware checklist regeneration under current logic.
   - What's unclear: whether this is acceptable (checklist generation is explicitly a one-time event in this codebase) or whether Phase 12 should force a regeneration path.
   - Recommendation: treat as out of scope / acceptable given existing "generate once" design — flag explicitly so the user can confirm, since it's an edge case the requirement text doesn't address.

## Sources

### Primary (HIGH confidence — direct source read)
- `/Users/tomas/Estefanía/permisohub/lib/via-tramitacion.ts` — full read
- `/Users/tomas/Estefanía/permisohub/lib/due-diligence.ts` — full read
- `/Users/tomas/Estefanía/permisohub/lib/normativa-retrieval.ts` — full read
- `/Users/tomas/Estefanía/permisohub/lib/zonificacion-compat.ts` — full read
- `/Users/tomas/Estefanía/permisohub/lib/zonificacion-format.ts` — full read
- `/Users/tomas/Estefanía/permisohub/lib/ai.ts` — full read
- `/Users/tomas/Estefanía/permisohub/types/index.ts` — `Proyecto` interface (lines 78-146) and related types
- `/Users/tomas/Estefanía/permisohub/app/api/proyectos/[id]/via-tramitacion/route.ts` — full read
- `/Users/tomas/Estefanía/permisohub/app/api/proyectos/[id]/compatibilidad/route.ts` — full read
- `/Users/tomas/Estefanía/permisohub/app/api/ai/copiloto/route.ts` — full read
- `/Users/tomas/Estefanía/permisohub/app/api/ai/due-diligence/route.ts` — full read
- `/Users/tomas/Estefanía/permisohub/components/proyecto/via-decision.tsx` — full read
- `/Users/tomas/Estefanía/permisohub/components/proyecto/via-guiada.tsx` — full read
- `/Users/tomas/Estefanía/permisohub/components/proyecto/zonificacion-card.tsx` — full read
- `/Users/tomas/Estefanía/permisohub/components/proyecto/uso-compatible-check.tsx` — full read
- `/Users/tomas/Estefanía/permisohub/components/proyecto/pmo-panel.tsx` — relevant sections (imports, `<ViaDecision>` usage)
- `/Users/tomas/Estefanía/permisohub/components/proyecto/due-diligence-report.tsx` — `CitaBadges`/`HallazgoCard` sections
- `/Users/tomas/Estefanía/permisohub/components/arch/estado.tsx` — full read
- `/Users/tomas/Estefanía/permisohub/components/arch/cita.tsx` — full read
- `/Users/tomas/Estefanía/permisohub/tests/unit/via-tramitacion.test.ts` — full read (determinism guarantees)
- `/Users/tomas/Estefanía/permisohub/package.json` — dependency versions (next 16.2.9, react 19.2.4, zod 4.4.3)

### Secondary (MEDIUM confidence)
None — no external/web sources were needed for this phase; it is entirely internal wiring.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing modules read in full
- Architecture: HIGH — read the actual deterministic core, its tests, the AI-driven due-diligence engine, the Copiloto prompt-assembly, and the exact UI components where output renders
- Pitfalls: HIGH — sourced from direct code inspection (e.g., Pitfall 5's route/lib type mismatch, Pitfall 1's Ñuñoa precedent) rather than speculation

**Research date:** 2026-07-30
**Valid until:** No external expiry — this research is tied to the current state of this specific codebase, not a fast-moving external ecosystem. Re-validate only if Phase 11's `zona_*` schema or `via-tramitacion.ts`/`due-diligence.ts`/`copiloto/route.ts` change materially before Phase 12 is planned/executed.
