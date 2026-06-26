# Phase 8: Copiloto Core - Research

**Researched:** 2026-06-25
**Domain:** AI-powered side drawer with 4 tabbed analysis skills over project data
**Confidence:** HIGH (all findings verified directly from codebase)

---

## Summary

Phase 8 adds an "Copiloto IA" Sheet drawer accessible from three existing list pages (Permisos, Patentes, and the desarchivo flow inside Proyectos). The drawer is project-scoped: the user selects a row, clicks a trigger button, and the drawer opens showing suggested task cards. On card click, a single API endpoint fires 4 concurrent OpenAI calls via `Promise.all` and returns structured JSON for each of 4 tabs: Diagnóstico OGUC, Predicción de Observaciones, Checklist de Documentos, and Estimación de Plazo/Derechos.

All supporting infrastructure already exists: the `Sheet` component (base-ui/dialog), the `aiComplete` function, lib helpers for OGUC articles, municipality stats, fee calculation, and business days. The `document_checklist_items` table is live in Supabase with RLS. The only new artifacts are: one shared `CopilotoDrawer` component, one API route at `app/api/ai/copiloto/route.ts`, and the checklist toggle endpoint.

**Primary recommendation:** Build a single `POST /api/ai/copiloto` route that receives a `proyectoId`, fetches the full proyecto from Supabase server-side, runs 4 `aiComplete` calls in `Promise.all`, and returns `{ oguc, observaciones, checklist, estimacion }`. The drawer component is stateful client-side: it fetches on open, caches per-project, and manages tab state locally.

---

## Standard Stack

### Core (all already installed, no new dependencies needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@base-ui/react/dialog` | installed | Sheet drawer primitive | Already in `components/ui/sheet.tsx` |
| `openai` | installed | GPT-4o via `aiComplete` | `lib/ai.ts` |
| `@supabase/ssr` | installed | DB access in route handlers | `lib/supabase/server.ts` |
| `sonner` | installed | Toast notifications | `components/ui/sonner.tsx` |
| `lucide-react` | installed | Icons | Used throughout |

### Lib Helpers Already Present

| File | Exports | Used For |
|------|---------|---------|
| `lib/ai.ts` | `aiComplete(messages, options)`, `isAIAvailable()`, `AI_MODEL` | All AI calls |
| `lib/oguc-knowledge.ts` | `ARTICULOS_OGUC[]`, `getContextoOGUC(query)` | SKILL-02 OGUC diagnosis |
| `lib/inteligencia-dom.ts` | `InteligenciaMunicipio`, `BASE` array with per-municipality data | SKILL-03 observation prediction enrichment |
| `lib/municipios-stats.ts` | `ESTADISTICAS_MUNICIPIOS[]`, `EstadisticaMunicipio` | SKILL-03 + SKILL-05 timing data |
| `lib/derechos-municipales.ts` | `calcularDerechosMunicipales(...)`, `CalculoDerechos` | SKILL-05 fees in CLP |
| `lib/dias-habiles.ts` | `sumarDiasHabiles()`, `contarDiasHabiles()`, `getEstadoPlazoLey21718()` | SKILL-05 business days |
| `app/api/utils/uf/route.ts` | `GET /api/utils/uf` → `{ valor: number }` | SKILL-05 UF conversion |

### No New Packages Required

All dependencies are already installed. No `npm install` needed for this phase.

---

## Architecture Patterns

### Recommended File Structure

```
components/copiloto/
├── copiloto-drawer.tsx      # Main Sheet wrapper + state machine
├── copiloto-trigger.tsx     # Button that opens the drawer (receives proyecto prop)
├── tabs/
│   ├── tab-oguc.tsx         # SKILL-02: OGUC diagnosis tab content
│   ├── tab-observaciones.tsx # SKILL-03: observation prediction tab
│   ├── tab-checklist.tsx    # SKILL-04: document checklist tab
│   └── tab-estimacion.tsx   # SKILL-05: timeline + fee estimation tab
app/api/ai/
└── copiloto/
    └── route.ts             # Single endpoint, 4 concurrent AI calls
```

### Pattern 1: Sheet Trigger from List Pages

The three target pages (Permisos, Patentes, Proyectos with desarchivo) are client components that hold a list of projects. The pattern is:

1. Add `copilotoProyecto` state in each page: `useState<Proyecto | null>(null)`
2. Add `CopilotoTrigger` button to each table row's actions column
3. Render `<CopilotoDrawer proyecto={copilotoProyecto} onClose={() => setCopilotoProyecto(null)} />`

**Why not embed trigger inside the drawer:** The drawer needs to be mounted at the page level to avoid z-index and portal stacking issues with the existing `Dialog` components already in each page.

**Example pattern from codebase (permisos/page.tsx):**
```typescript
// Current pattern (actions column):
<RegistrarPermisoDialog permiso={p} onSaved={...} />

// New pattern (add alongside existing):
<Button variant="ghost" size="sm" onClick={() => setCopilotoProyecto(p)}>
  <Sparkles className="size-3.5" />
  Copiloto
</Button>
```

### Pattern 2: Single API Route with Promise.all

The route receives `proyectoId`, loads the project from Supabase (for RLS auth), then runs 4 AI calls concurrently.

```typescript
// app/api/ai/copiloto/route.ts
export const maxDuration = 90  // REQUIRED — 4 concurrent GPT-4o calls

export async function POST(request: Request) {
  const { proyectoId } = await request.json()
  const supabase = await createClient()
  
  // Load full project (RLS enforces ownership)
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('*, cliente:clientes(*)')
    .eq('id', proyectoId)
    .single()

  // Check existing checklist items (for SKILL-04 persistence logic)
  const { data: existingChecklist } = await supabase
    .from('document_checklist_items')
    .select('*')
    .eq('proyecto_id', proyectoId)

  // Load UF value
  const ufRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/utils/uf`)
  const { valor: ufCLP } = await ufRes.json()

  const [oguc, observaciones, checklist, estimacion] = await Promise.all([
    runOGUCDiagnosis(proyecto),
    runObservacionesPrediccion(proyecto),
    runChecklistGeneration(proyecto, existingChecklist),
    runEstimacion(proyecto, ufCLP),
  ])

  // Persist checklist items if not already in DB
  if (checklist.items && existingChecklist?.length === 0) {
    await supabase.from('document_checklist_items').insert(
      checklist.items.map((item) => ({
        proyecto_id: proyectoId,
        item_key: item.item_key,
        label: item.label,
        articulo_oguc: item.articulo_oguc,
        estado: 'pendiente',
        source: 'ai',
      }))
    )
  }

  return Response.json({ ok: true, oguc, observaciones, checklist, estimacion })
}
```

### Pattern 3: Drawer State Machine

The drawer has 3 states: `idle` → `loading` → `loaded`. Each project open resets to `idle` unless the result is cached.

```typescript
// In copiloto-drawer.tsx
type DrawerState = 'idle' | 'loading' | 'loaded' | 'error'

// Cache by proyectoId to avoid re-fetching on tab switch
const cache = useRef<Map<string, CopilotoResult>>(new Map())
```

### Pattern 4: Checklist Tab with Toggle

SKILL-04 requires the checklist to be editable (pendiente/ok toggle). This maps to PATCH on checklist items:

```typescript
// Existing table: document_checklist_items
// { id, proyecto_id, item_key, label, articulo_oguc, estado, source }
// estado: 'pendiente' | 'ok'

// Toggle via dedicated endpoint or reuse a new route:
// PATCH /api/proyectos/[id]/checklist-items/[itemId]
// body: { estado: 'ok' | 'pendiente' }
```

### Pattern 5: Task Cards Initial State

On drawer open (before AI results load), display 4 suggestion cards as entry points:

```typescript
const SKILL_CARDS = [
  { id: 'oguc', icon: Scale, title: 'Diagnóstico OGUC', description: 'Verifica FOT, FOS, rasantes y normativa aplicable' },
  { id: 'observaciones', icon: AlertTriangle, title: 'Predicción de Observaciones', description: 'Anticipa qué observará la DOM' },
  { id: 'checklist', icon: CheckSquare, title: 'Checklist de Documentos', description: 'Genera lista de documentos requeridos' },
  { id: 'estimacion', icon: Clock, title: 'Estimación de Plazo', description: 'Días hábiles y derechos estimados' },
]
```

When idle: show these 4 cards. User clicks any → transitions to `loading` (runs all 4 analyses at once since they use the same backend call), then shows tab bar with pre-selected tab.

### Anti-Patterns to Avoid

- **Per-skill API routes:** Don't create separate routes for each skill. One route with `Promise.all` is faster (4 calls in parallel) and avoids 4 sequential fetch round-trips from the client.
- **Streaming/SSE:** Explicitly out of scope. Use standard `Response.json()`.
- **Regenerating checklist on each open:** Check `document_checklist_items` first — if items exist for the project, return them from DB instead of re-calling AI. Only generate if `existingChecklist.length === 0`.
- **Passing raw project ID without server-side fetch:** Always fetch the project inside the API route using `createClient()` so RLS enforces ownership.
- **Route folder names with dashes containing accented chars:** The path `app/api/ai/copiloto/route.ts` uses no dashes in segment names themselves (the word "copiloto" is fine — no accents). Confirmed safe pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sheet drawer primitive | Custom overlay/panel | `Sheet`, `SheetContent` from `@/components/ui/sheet` | Already installed, base-ui backed |
| UF value | Scraping SII directly | `GET /api/utils/uf` | 24h cached, mindicador.cl source |
| Business days | Date math | `sumarDiasHabiles()`, `contarDiasHabiles()` from `lib/dias-habiles.ts` | Chilean holidays 2024-2030 pre-loaded |
| Municipal fees | Custom formula | `calcularDerechosMunicipales()` from `lib/derechos-municipales.ts` | DFL2, min UF, municipality overrides |
| OGUC articles | Hardcoding text | `ARTICULOS_OGUC[]`, `getContextoOGUC()` from `lib/oguc-knowledge.ts` | Full regulatory text + keyword search |
| Municipality observation stats | Custom data | `ESTADISTICAS_MUNICIPIOS[]` from `lib/municipios-stats.ts` | Per-municipality rates, types, timing |
| Toast notifications | Custom alerts | `sonner` toast | Already installed via `components/ui/sonner.tsx` |

---

## Common Pitfalls

### Pitfall 1: maxDuration Missing on Route
**What goes wrong:** 4 concurrent GPT-4o calls can take 30-60 seconds total. Without `export const maxDuration = 90`, Vercel/Next.js will timeout the serverless function at the default 30s limit.
**How to avoid:** First line of `app/api/ai/copiloto/route.ts` must be `export const maxDuration = 90`.
**Warning signs:** Route returns 504 or disconnects after ~30 seconds in production.

### Pitfall 2: Checklist Duplicate Generation
**What goes wrong:** Each time the copiloto opens, a new set of checklist items is inserted, creating duplicates.
**Why it happens:** Forgetting to check existing items before inserting.
**How to avoid:** Query `document_checklist_items` where `proyecto_id = ?` before inserting. If items exist, return them and skip AI generation for that skill. Only call checklist AI if `existingChecklist.length === 0`.
**Warning signs:** `document_checklist_items` grows unboundedly per project.

### Pitfall 3: RLS Bypass via Direct proyectoId
**What goes wrong:** Client sends `proyectoId` and the route fetches that project from Supabase without auth check, potentially leaking data.
**How to avoid:** Always use `createClient()` (which applies the user's session cookie) to fetch the project. RLS policy `proyectos_own` will block unauthorized access. The `select` will return no data if the user doesn't own the project.
**Warning signs:** Route returns data for any `proyectoId` regardless of session.

### Pitfall 4: Missing Supabase Columns for AI Context
**What goes wrong:** AI prompts reference `superficie_construida_m2`, `avaluo_fiscal_clp`, `rol_sii` etc. These are in the TypeScript `Proyecto` type but check the DB schema — `proyectos` table in `schema.sql` does NOT have these columns natively. They're in the TypeScript type as optional fields added by SII enrichment at the application layer.
**Root cause:** The `proyectos` table in DB has: `nombre, direccion, municipio, tipo, estado, etapa_actual, numero_expediente, fecha_inicio, fecha_estimada, notas`. The SII-enriched fields (`superficie_terreno_m2`, `superficie_construida_m2`, `avaluo_fiscal_clp`, `rol_sii`, `destino_sii`, `lat`, `lng`) are stored in DB only if a migration added them. The schema.sql shows them in the TypeScript type but they may not be DB columns yet.
**How to avoid:** When building AI prompts, use optional chaining and graceful defaults: `proyecto.superficie_construida_m2 ?? 'no disponible'`. Do not assume these fields are populated.
**Warning signs:** SQL error on select, or AI gets undefined values for key project metrics.

### Pitfall 5: Sheet Prop Drilling vs Context
**What goes wrong:** Passing `copilotoProyecto` state through many component layers in complex pages like the permisos page.
**How to avoid:** Keep the drawer state at the page level (not inside table rows). Pass `onOpen={() => setCopilotoProyecto(proyecto)}` as a prop to a thin trigger button component. The drawer itself is mounted at page level.

### Pitfall 6: Tab Component Choice
**What goes wrong:** Importing `Tabs` from shadcn/ui when the project doesn't have a `components/ui/tabs.tsx`.
**How to avoid:** Check `components/ui/` — there is no `tabs.tsx` in the current codebase. Build tabs as plain controlled buttons with `useState<TabId>`. The pattern is already used throughout the app (e.g., the filtro tabs in `permisos/page.tsx` use plain `<button>` elements with `cn` for active state).

---

## Code Examples

### Sheet Usage Pattern (verified from `components/ui/sheet.tsx`)

```typescript
// Source: /components/ui/sheet.tsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'

<Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
  <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Copiloto IA</SheetTitle>
      <SheetDescription>{proyecto.nombre}</SheetDescription>
    </SheetHeader>
    {/* content */}
  </SheetContent>
</Sheet>
```

Note: `SheetContent` default width is `sm:max-w-sm` (~384px). Override with className for wider content.

### AI Route Pattern (verified from `app/api/ai/predict-observations/route.ts`)

```typescript
// Source: /app/api/ai/predict-observations/route.ts pattern
export const dynamic = 'force-dynamic'
export const maxDuration = 90  // Add this for copiloto

import { isAIAvailable, aiComplete } from '@/lib/ai'

export async function POST(request: Request) {
  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }
  // ... build prompt ...
  const text = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 2000 })
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : fallback
  return Response.json({ ok: true, ...parsed })
}
```

### Supabase Pattern for Route Handler (verified from `app/api/proyectos/[id]/route.ts`)

```typescript
// Source: /app/api/proyectos/[id]/route.ts
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: proyecto, error } = await supabase
  .from('proyectos')
  .select('*, cliente:clientes(*)')
  .eq('id', proyectoId)
  .single()
```

### Checklist Items DB Pattern (verified from `supabase/schema.sql`)

```sql
-- Table: document_checklist_items
-- id uuid, proyecto_id uuid, item_key text, label text, articulo_oguc text,
-- estado text CHECK ('pendiente','ok'), source text CHECK ('ai','manual')
```

```typescript
// Insert (first-time generation)
await supabase.from('document_checklist_items').insert([
  { proyecto_id, item_key: 'plano_emplazamiento', label: 'Plano de emplazamiento', 
    articulo_oguc: 'Art. 5.1.6', estado: 'pendiente', source: 'ai' }
])

// Toggle estado
await supabase.from('document_checklist_items')
  .update({ estado: newEstado })
  .eq('id', itemId)
  .eq('proyecto_id', proyectoId) // extra safety
```

### UF Fetch Pattern (verified from `app/api/utils/uf/route.ts`)

```typescript
// GET /api/utils/uf returns: { ok: boolean, valor: number, fecha: string }
// 24-hour cached, falls back to 38000 CLP if mindicador.cl is down

const ufRes = await fetch('/api/utils/uf')
const { valor: ufCLP } = await ufRes.json() as { valor: number }
// Use ufCLP in calcularDerechosMunicipales(...)
```

### calcularDerechosMunicipales Pattern (verified from `lib/derechos-municipales.ts`)

```typescript
import { calcularDerechosMunicipales } from '@/lib/derechos-municipales'

const result = calcularDerechosMunicipales(
  presupuestoObra,   // CLP
  tipoObra,          // 'obra_nueva' | 'ampliacion' | etc.
  superficieConstruida, // m²
  esDFL2,            // boolean
  municipio,         // string (e.g. 'Providencia')
  ufCLP              // current UF value in CLP
)
// result.montoDerechos = CLP amount
// Convert to UF: result.montoDerechos / ufCLP
```

---

## Project Data Available Per Module

### What proyectos table actually has (verified from schema.sql + TypeScript type)

**Always present in DB:**
- `id`, `nombre`, `direccion`, `municipio`, `tipo` (TipoPermiso), `estado` (EstadoExpediente)
- `etapa_actual`, `numero_expediente`, `fecha_inicio`, `fecha_estimada`, `notas`
- `created_at`, `updated_at`

**Present only if SII enrichment was run (optional fields):**
- `rol_sii`, `avaluo_fiscal_clp`, `superficie_terreno_m2`, `superficie_construida_m2`
- `destino_sii`, `lat`, `lng`

**Present only for permiso workflow:**
- `numero_permiso`, `fecha_otorgamiento`, `fecha_vencimiento_permiso`

**Present only for desarchivo workflow:**
- `esta_archivado`, `fecha_archivado`, `solicitud_desarchivo` (jsonb)

**Present only for patente workflow:**
- `numero_patente`, `giro_sii`, `año_ejercicio`, `valor_derechos`, `fecha_pago_derechos`

**Present only for enterprise (cadenas):**
- `local_id`, `centro_id`, `cadena_id`

### AI Context Strategy Per Skill

**SKILL-02 (OGUC Diagnosis):** Needs `tipo`, `municipio`, `superficie_terreno_m2` (optional), `superficie_construida_m2` (optional). Falls back to graceful messaging if SII data not available.

**SKILL-03 (Observation Prediction):** Needs `municipio`, `tipo`, `estado`. Uses `ESTADISTICAS_MUNICIPIOS` for municipality-specific data. Can use SII data if present.

**SKILL-04 (Checklist):** Needs `tipo` (to pick correct document list), `municipio`. Prior checklist items fetched from DB.

**SKILL-05 (Estimation):** Needs `municipio`, `tipo`, `fecha_inicio`, `superficie_construida_m2` (optional). Uses `calcularDerechosMunicipales` + `sumarDiasHabiles` + municipality stats for timing range.

---

## Drawer Trigger Strategy Per Module

### Permisos page (`app/(dashboard)/permisos/page.tsx`)
- Already has a per-row `RegistrarPermisoDialog` button in the actions column
- Add `CopilotoTrigger` button alongside it
- Data available: full `ProyectoConVigencia` (extends `Proyecto`)
- Page is a client component with `permisos` state — easy to add `copilotoProyecto` state

### Patentes page (`app/(dashboard)/patentes/page.tsx`)
- Has per-row actions (renovar, etc.)
- Data available: full `PatenteConVigencia` (extends `Proyecto`)
- Same pattern as Permisos

### Proyectos/Desarchivo
- "Desarchivo" is not a separate page — it's a panel inside `proyectos/[id]/page.tsx` (the `DesarchivoPanel` component)
- The spec says "Desarchivo" module — this likely refers to projects where `esta_archivado = true`, shown in the proyectos list with a filter
- Alternatively, copiloto can be triggered from the `proyectos/[id]/page.tsx` project detail page directly
- Simplest implementation: add Copiloto button to the project detail page header actions (where WhatsApp, Export buttons already live)

---

## Open Questions

1. **"Desarchivo" as a module**
   - What we know: There's no `/desarchivo` page. "Desarchivo" is handled inside `proyectos/[id]/page.tsx` via `DesarchivoPanel` component. The sidebar does not list a "Desarchivo" nav item.
   - What's unclear: Does the spec mean the Copiloto button should appear on the proyectos list page filtered to archived projects, or in the project detail page for archived projects?
   - Recommendation: Add the trigger to **all projects** in the project detail page header (`proyectos/[id]/page.tsx`) AND to the proyectos list page. This covers all modules including the desarchivo use case.

2. **SII fields in DB**
   - What we know: The TypeScript `Proyecto` type has `superficie_terreno_m2`, `superficie_construida_m2`, `avaluo_fiscal_clp`, `rol_sii`, `destino_sii`. The `schema.sql` baseline does not show an `ALTER TABLE proyectos ADD COLUMN` for these.
   - What's unclear: Were these columns added in a separate migration not included in `schema.sql`?
   - Recommendation: Code defensively — use optional chaining. The AI prompts should explicitly say "si no hay datos SII disponibles, usa estimaciones generales".

3. **Width of SheetContent**
   - What we know: Default `sm:max-w-sm` (~384px). The 4-tab layout with analysis content may feel cramped.
   - Recommendation: Override to `sm:max-w-lg` (512px) or `sm:max-w-xl` (576px) via className for the copiloto drawer specifically.

---

## Sources

### Primary (HIGH confidence — direct code inspection)
- `/Users/tomas/Estefanía/permisohub/components/ui/sheet.tsx` — Sheet API, props, default sizing
- `/Users/tomas/Estefanía/permisohub/lib/ai.ts` — `aiComplete` signature and model
- `/Users/tomas/Estefanía/permisohub/lib/oguc-knowledge.ts` — `ARTICULOS_OGUC`, `getContextoOGUC`
- `/Users/tomas/Estefanía/permisohub/lib/municipios-stats.ts` — `ESTADISTICAS_MUNICIPIOS` structure
- `/Users/tomas/Estefanía/permisohub/lib/inteligencia-dom.ts` — `InteligenciaMunicipio` structure
- `/Users/tomas/Estefanía/permisohub/lib/derechos-municipales.ts` — `calcularDerechosMunicipales` signature
- `/Users/tomas/Estefanía/permisohub/lib/dias-habiles.ts` — `sumarDiasHabiles`, `getEstadoPlazoLey21718`
- `/Users/tomas/Estefanía/permisohub/app/api/utils/uf/route.ts` — UF fetch pattern, response shape
- `/Users/tomas/Estefanía/permisohub/supabase/schema.sql` — `document_checklist_items` table, all RLS policies
- `/Users/tomas/Estefanía/permisohub/types/index.ts` — `Proyecto` type with all optional fields
- `/Users/tomas/Estefanía/permisohub/app/api/ai/predict-observations/route.ts` — AI route pattern
- `/Users/tomas/Estefanía/permisohub/app/api/ai/compliance-check/route.ts` — AI route pattern
- `/Users/tomas/Estefanía/permisohub/app/api/proyectos/[id]/route.ts` — Supabase + Promise.all pattern
- `/Users/tomas/Estefanía/permisohub/app/(dashboard)/permisos/page.tsx` — Per-row action button pattern
- `/Users/tomas/Estefanía/permisohub/app/(dashboard)/patentes/page.tsx` — Module structure
- `/Users/tomas/Estefanía/permisohub/components/cadenas/local-historial-drawer.tsx` — Dialog-as-drawer pattern
- `/Users/tomas/Estefanía/permisohub/next.config.ts` — Turbopack config, route name constraints

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by direct file inspection
- Architecture patterns: HIGH — derived from actual existing route and component code
- Data model: HIGH — verified from schema.sql and TypeScript types
- Pitfalls: HIGH — derived from code patterns and existing workarounds (maxDuration, NFD path bug)

**Research date:** 2026-06-25
**Valid until:** 2026-08-25 (stable codebase, no external APIs changing)
