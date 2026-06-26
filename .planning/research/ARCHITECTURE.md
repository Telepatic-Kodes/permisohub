# Architecture Research — v1.3 Army of Skills

**Milestone:** AI Copilot Skills
**Researched:** 2026-06-25
**Based on:** Direct codebase inspection

---

## Existing Patterns (Ground Truth)

Before listing new files, these patterns were verified in the live code and must be followed exactly:

**AI calls:** All existing AI routes use `aiComplete()` from `lib/ai.ts` (OpenAI gpt-4o, no Anthropic SDK). Non-streaming routes return `Response.json()` with a typed struct. Streaming routes build a `ReadableStream` that emits `data: {...}\n\n` SSE events and close with `data: [DONE]\n\n`. The `chat/route.ts` is the only streaming route today — all analysis routes (`predict-observations`, `audit-expediente`, `generate-communication`) return JSON synchronously via `aiComplete()`.

**Dev fallback pattern:** `try { Supabase query } catch { if (NODE_ENV !== 'production') return mock }`. All new routes must include this.

**Cron auth:** `validateCronSecret(request)` from `lib/scraper.ts` on every cron GET handler.

**Context passing to AI:** Context built in the route, injected into the prompt string, never passed as a separate system message object (except the `chat` route). Follow `predict-observations` as the template for structured JSON responses.

**Project ID access in pages:** `use(params)` unwraps the Promise<{id}> in Next.js App Router pages. The project detail page (`app/(dashboard)/proyectos/[id]/page.tsx`) already stores `proyecto.id` in `window.__ph_command_context` via `use-command-context.ts` inside a `useEffect`.

**Drawer pattern reference:** `components/cadenas/local-historial-drawer.tsx` is the canonical existing drawer — it uses `Dialog` from shadcn/ui (not Sheet), fetches data on `open` via `useEffect`, and receives its entity ID as a prop. Use this as the structural template.

**Vercel cron config:** `vercel.json` already has both `/api/cron/daily-check` (0 11 * * *) and `/api/cron/weekly-summary` (0 12 * * 1). Both routes already exist and are functional. The weekly cron is not a new file — it already sends internal digest to ADMIN_EMAIL.

---

## New Files

### `components/copiloto/copiloto-drawer.tsx`
The Sheet/panel component. Receives `proyectoId` and `proyecto` data as props from the parent page. Internally manages tab state (4 analysis tabs). On tab activation, fires a fetch to `/api/ai/analyze-project`. Uses `Dialog` (consistent with existing drawer pattern) or `Sheet` from shadcn/ui — `Sheet` is more appropriate for a side panel and is already a shadcn component; confirm it is installed before using it.

### `app/api/ai/analyze-project/route.ts`
POST handler. Receives `{ proyecto_id: string }`, queries Supabase for the full project record including observaciones, documentos, etapas, and municipio data from `lib/inteligencia-dom.ts`. Calls `aiComplete()` and returns structured JSON. **Must not stream** — reasoning below in the Decision section.

### `lib/copiloto-prompts.ts`
Prompt builders for each of the 4 analysis tabs. Keeps the route handler thin. Pattern: one exported function per analysis type that takes a `Proyecto` + context and returns a `string` prompt. Modeled after how `getContextoOGUC()` and `getInteligenciaDOM()` already work in other routes.

---

## Modified Files

### `app/(dashboard)/proyectos/[id]/page.tsx`
Add a single button in the existing "Herramientas IA" card (right column, lines 936–969). On click, sets `drawerOpen = true`. Render `<CopilotoDrawer proyectoId={id} proyecto={proyecto} open={drawerOpen} onClose={() => setDrawerOpen(false)} />` at the bottom of the JSX, alongside the existing `WhatsAppDialog`. No structural changes to the page — the project data is already loaded in state.

### `app/api/proyectos/route.ts` — Patente creation
When `tipo === 'patente_comercial'` and a `rol_sii` is provided in the POST body, call `/api/enrich/sii` internally after inserting the project. Write `giro_sii` and surface areas back to the new project row before returning. This is a best-effort call — if SII fails, return the project anyway with a `sii_enriched: false` flag.

### `app/api/cron/daily-check/route.ts`
DOM auto-update already writes back to the `proyectos` table (lines 149–153 in the live file). The `estado` update is already there. What is missing: when `estadoNuevo === 'con_observaciones'` and the scraped response includes `descripcion`, persist that text into an `observaciones` row. Add a Supabase insert to `observaciones` table inside the state-change block, immediately after the existing `proyectos` update. No restructuring needed — two extra lines.

### `vercel.json`
No changes needed. Both crons are already registered. The weekly summary route already exists.

---

## Key Architectural Decision: JSON vs SSE for `analyze-project`

**Return structured JSON, not SSE.**

Rationale:
1. All structured analysis routes in the codebase (`predict-observations`, `audit-expediente`, `generate-communication`) use `aiComplete()` + `Response.json()`. Only `chat/route.ts` streams, and it streams free-form text for a conversational UI.
2. The copiloto tabs display structured cards (risk score, checklist, predicted observations, etc.), not a text stream. Rendering structured UI from a stream requires parsing partial JSON, which adds complexity with no user benefit here.
3. The drawer can show a skeleton/spinner while the fetch resolves. For a 2–4 second `aiComplete()` call, this is acceptable UX.
4. If individual tabs need progressive disclosure in a future milestone, the route can add streaming then. Start simple.

**Consequence:** `CopilotoDrawer` uses a normal `fetch()` with `await res.json()` per tab, not an SSE reader.

---

## Data Flow

### Copiloto Drawer Flow

```
proyectos/[id]/page.tsx
  └─ renders proyecto state (already loaded from /api/proyectos/[id] on mount)
  └─ "Copiloto" button click → setDrawerOpen(true)
  └─ <CopilotoDrawer proyectoId={id} proyecto={proyecto} open={true} />

CopilotoDrawer
  └─ on tab change → setLoading(true)
  └─ fetch POST /api/ai/analyze-project { proyecto_id, tab: 'riesgo'|'docs'|'prediccion'|'accion' }
  └─ await res.json() → setAnalysis(data)
  └─ render tab content from structured response

/api/ai/analyze-project/route.ts
  └─ createClient() → supabase query proyectos + observaciones + documentos
  └─ getInteligenciaDOM(municipio) for municipality context
  └─ buildCopilotoPrompt(tab, proyecto, context) from lib/copiloto-prompts.ts
  └─ aiComplete([{ role: 'user', content: prompt }], { max_tokens: 2000 })
  └─ JSON.parse(response) → Response.json(structured result)
```

**Prop chain:** Parent page has `proyecto` in state → passes `proyecto` and `proyectoId` to drawer as props → drawer uses `proyectoId` in the API POST body. No need to re-fetch project data inside the drawer; pass the full object from the parent.

**Why not use `window.__ph_command_context`?** That object is designed for the command palette (`command-palette.tsx`), not component-to-component communication. Passing props directly is more explicit and testable.

### DOM Auto-Update Write-Back Flow

```
/api/cron/daily-check (GET, runs 08:00 Santiago time)
  └─ queries all active projects with numero_expediente (already exists)
  └─ for each: POST /api/scraper/dom-en-linea (already exists)
  └─ if scraperData.estado !== p.estado:
      ├─ UPDATE proyectos SET estado=estadoNuevo (ALREADY EXISTS, line 149)
      └─ [NEW] if estadoNuevo === 'con_observaciones' && scraperData.descripcion:
            INSERT INTO observaciones { proyecto_id, texto: scraperData.descripcion,
                                        numero: 'DOM-AUTO', fecha: today, estado: 'pendiente',
                                        fuente: 'scraper' }
```

The `fuente: 'scraper'` field lets the UI distinguish auto-created vs manual observations. Add this column to the `observaciones` table migration if it doesn't exist.

### Patente SII Auto-Enrich Flow

```
POST /api/proyectos (create new project)
  └─ if body.tipo === 'patente_comercial' && body.rol_sii:
      ├─ INSERT proyectos (existing logic)
      └─ [NEW] fetch POST /api/enrich/sii { rol: body.rol_sii }
           └─ if ok: UPDATE proyectos SET giro_sii=data.destino, ... WHERE id=newProject.id
           └─ if error: continue, return sii_enriched: false in response
```

Internal fetch uses `process.env.NEXT_PUBLIC_APP_URL` + path, same pattern as `daily-check/route.ts` line 129.

---

## Build Order

The 4 new capabilities have these dependencies:

```
lib/copiloto-prompts.ts          (no deps — build first)
      ↓
app/api/ai/analyze-project/      (depends on prompts lib)
      ↓
components/copiloto/drawer.tsx   (depends on API being defined)
      ↓
proyectos/[id]/page.tsx patch    (depends on drawer component existing)
```

Cron and patente enrichment are independent of the copiloto chain.

### Step 1 — Prompt library
Create `lib/copiloto-prompts.ts`. Define the 4 prompt builder functions. No runtime dependencies — can be built and tested in isolation by calling functions directly.

### Step 2 — API route
Create `app/api/ai/analyze-project/route.ts`. Uses the prompt library + existing `aiComplete` + existing Supabase client pattern. Test with curl/Postman before building UI. Include the dev mock fallback.

### Step 3 — Drawer component
Create `components/copiloto/copiloto-drawer.tsx`. Hardcode the `proyectoId` to a known mock ID during development, verify tab switching and API integration independently.

### Step 4 — Page integration
Add the "Copiloto" button to `proyectos/[id]/page.tsx` and wire the drawer. This is a 3-line change to the existing Herramientas IA card plus a `<CopilotoDrawer>` mount at the bottom.

### Step 5 — Daily cron observaciones write-back
Modify `app/api/cron/daily-check/route.ts` to insert auto-observations on state change. Verify the `observaciones` table schema supports a `fuente` column. If not, add migration first.

### Step 6 — Patente SII auto-enrich
Modify `app/api/proyectos/route.ts` POST handler. The enrichment is a best-effort side effect; no UI changes needed since the page already reads `giro_sii` from the project object.

---

## Integration Points Checklist

| Question | Answer |
|---|---|
| How does drawer get project ID? | Props from parent page — `proyecto.id` is already in state at the time the drawer renders |
| Does analyze-project stream or return JSON? | Structured JSON via `aiComplete()` — consistent with all non-chat AI routes |
| How does DOM auto-update write back to DB? | Already writes `estado` in daily-check; extend to also insert into `observaciones` on `con_observaciones` transition |
| Does weekly cron need new Vercel config? | No — `vercel.json` already has the `weekly-summary` entry and the route file already exists |
| Where do copiloto components live? | `components/copiloto/` — new subfolder, parallel to existing `components/proyecto/` and `components/cadenas/` |
| What is the Sheet vs Dialog decision? | Verify `Sheet` is in `components/ui/` before using; if not, install shadcn Sheet or use Dialog like `local-historial-drawer.tsx` does |
| How does tab state work in drawer? | Local `useState<'riesgo'|'docs'|'prediccion'|'accion'>` — fetch fires per tab on first activation, cache result in a `Record<tab, analysis>` object to avoid re-fetching |

---

## Risk Flags

**shadcn Sheet component:** Not confirmed present in `components/ui/`. Check before building the drawer. If missing, run `npx shadcn@latest add sheet` — or use Dialog with a side-panel CSS class (consistent with existing patterns, zero installation risk).

**`observaciones` table schema:** The live code reads and writes `observaciones` rows but the schema was not inspected. Verify the table has columns for `fuente` and `numero` before adding the auto-insert in daily-check. Check `supabase/migrations/` or Supabase Studio.

**`aiComplete()` timeout on Vercel:** Vercel Hobby has 10-second function timeout, Pro has 60s. `aiComplete()` with `max_tokens: 2000` typically takes 3–8 seconds for gpt-4o. The 4-tab drawer makes 4 sequential calls. Ensure the deployment plan is Pro, or batch all 4 analyses into one route call to stay under limits.

**`analyze-project` needs SUPABASE_SERVICE_ROLE_KEY:** The route will query projects by ID server-side, bypassing RLS. Existing cron routes use `NEXT_PUBLIC_SUPABASE_ANON_KEY` with cookie-based sessions. For a server-side route that doesn't have user cookies (called from client fetch), either use `createClient()` from `lib/supabase/server.ts` (which reads cookies from Next.js headers — this works since the fetch originates from an authenticated browser session) or use the service role key. Use `createClient()` first; it already handles this in every other API route.
