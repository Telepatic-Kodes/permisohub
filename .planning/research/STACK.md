# Stack Research — v1.3 Army of Skills

**Project:** PermisoHub — AI Copilot Skills milestone
**Researched:** 2026-06-25
**Confidence:** HIGH (all key findings verified against official docs + current source code)

---

## Copiloto Drawer

### Use `Sheet` from shadcn/ui — no new dependency needed

**Recommendation:** `Sheet` (side=right), not `Drawer`, not `@base-ui/react Dialog`.

**Rationale from official shadcn/ui docs and GitHub discussion #3043:**

- `Sheet` extends `Dialog` and overlays the main content from any edge. It is the correct choice for a persistent desktop side panel.
- `Drawer` is built on `vaul` and is optimized for touch/swipe mobile interfaces. It slides from the bottom by default and is designed for mobile gesture interaction — not the right primitive for a desktop copilot tray.
- `@base-ui/react` is already installed (`^1.6.0`) but is a low-level headless library. Using it for a copilot drawer means writing all animation, focus-trap, and escape-key handling from scratch. The shadcn `Sheet` wraps Radix Dialog and provides all of that for free.

**`Sheet` is not yet scaffolded in `components/ui/`.** Run:
```bash
npx shadcn@latest add sheet
```

This adds `components/ui/sheet.tsx` — the only file change needed.

**Component structure for the copiloto:**
```
components/copiloto/CopilotoDrawer.tsx   ← "use client", Sheet wrapper
components/copiloto/CopilotoChat.tsx     ← streaming display, input box
```

The drawer mounts as a sibling in the module page layout, not inside a modal stack. Keep it portal-based (default Sheet behavior) so it renders above the sidebar without z-index conflicts.

### Streaming: use the same SSE/ReadableStream pattern already in the codebase

**Finding:** The existing `app/api/ai/chat/route.ts` already implements the correct pattern:
- `ReadableStream` with a `TextEncoder`
- SSE framing: `data: ${JSON.stringify({ text })}\n\n`
- `'Content-Type': 'text/event-stream'`
- `export const dynamic = 'force-dynamic'` (critical — without it Vercel caches the route)

**For the new copiloto endpoint** (`app/api/ai/copiloto/route.ts`), use the exact same pattern. No new library needed. The client reads chunks with:
```typescript
const reader = res.body!.getReader()
const decoder = new TextDecoder()
// parse SSE lines, append to state
```

**Do NOT add the Vercel AI SDK.** It adds 40KB+ to the bundle and the existing hand-rolled pattern works identically. The benefit of the Vercel AI SDK is its `useChat` hook, which is overkill for a single-purpose drawer that doesn't need conversation history management.

**Confidence:** HIGH — verified against current route.ts implementation and Next.js 16.2.9 App Router docs.

---

## AI Analysis API

### Structured outputs: use `output_config.format` with JSON schema — no beta header

**Finding:** Anthropic's structured outputs are now **generally available** with no beta header required. The old `anthropic-beta: structured-outputs-2025-11-13` header still works but is deprecated. The current parameter is `output_config.format`.

Claude Sonnet 4.6 (the model in use per milestone context) supports structured outputs.

**CRITICAL discovery:** The current codebase does NOT use the Anthropic SDK for any live AI calls. `lib/ai.ts` wraps OpenAI (GPT-4o) and uses `OPENAI_API_KEY`. The `@anthropic-ai/sdk` is installed but no `ANTHROPIC_API_KEY` is set. The milestone context statement "Claude Sonnet 4.6 already integrated" appears to mean the SDK is installed and ready, not that it is in active use.

**For the analysis API, two options:**

**Option A — Use OpenAI with JSON schema (current provider):**
```typescript
const response = await ai.chat.completions.create({
  model: 'gpt-4o',
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'analisis_proyecto', schema: SCHEMA }
  },
  messages: [...]
})
const result = JSON.parse(response.choices[0].message.content!)
```
OpenAI's structured outputs are stable and the key is already set. Zero provider migration risk.

**Option B — Migrate to Anthropic SDK with structured outputs:**
```typescript
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  output_config: {
    format: {
      type: 'json_schema',
      schema: ANALYSIS_SCHEMA
    }
  },
  messages: [...]
})
```

**Recommendation: Option A for the analysis API, keep the existing OpenAI provider.** The analysis endpoint returns non-streamed JSON — latency is acceptable, no streaming complexity. Switching providers mid-milestone adds deployment risk (new env var, new error surfaces). The architect can plan a full Anthropic migration as a separate task if desired.

### Single prompt with JSON schema vs chained prompts

**Recommendation: single prompt, structured JSON output.** The 4 analysis types (OGUC diagnostic, observation prediction, document checklist, time/fee estimate) are strongly interdependent — the OGUC diagnosis informs which documents are required and what observations are likely. Sending them as a single prompt with a nested schema:
1. Gives the model full context for each sub-analysis
2. Uses one API call (cost + latency savings)
3. Is simpler to cache (schema compiled once per endpoint)

**Schema shape recommendation:**
```typescript
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    oguc: {
      type: 'object',
      properties: {
        cumplimiento: { type: 'string', enum: ['cumple', 'observaciones_menores', 'no_cumple'] },
        articulos: { type: 'array', items: { type: 'string' } },
        resumen: { type: 'string' }
      },
      required: ['cumplimiento', 'articulos', 'resumen'],
      additionalProperties: false
    },
    observaciones_predichas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string' },
          descripcion: { type: 'string' },
          probabilidad: { type: 'string', enum: ['alta', 'media', 'baja'] }
        },
        required: ['tipo', 'descripcion', 'probabilidad'],
        additionalProperties: false
      }
    },
    checklist_documentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          documento: { type: 'string' },
          requerido: { type: 'boolean' },
          estado: { type: 'string', enum: ['pendiente', 'en_revision', 'ok'] }
        },
        required: ['documento', 'requerido', 'estado'],
        additionalProperties: false
      }
    },
    estimacion: {
      type: 'object',
      properties: {
        plazo_semanas: { type: 'number' },
        derechos_municipales_uf: { type: 'number' },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] }
      },
      required: ['plazo_semanas', 'derechos_municipales_uf', 'confianza'],
      additionalProperties: false
    }
  },
  required: ['oguc', 'observaciones_predichas', 'checklist_documentos', 'estimacion'],
  additionalProperties: false
}
```

**Schema constraints to respect:**
- No recursive schemas
- No `$ref` references
- Max 20 tool definitions per request (not relevant here — using `output_config`)
- `additionalProperties: false` required on every object

**Streaming + structured outputs cannot be combined.** Structured output requires the full response before the JSON can be validated. For the analysis endpoint this is fine — it is not a streaming endpoint. Return `Response.json(parsedResult)` synchronously after the model call.

**Confidence:** HIGH — verified against official Anthropic structured outputs docs (last updated 2026).

---

## Background Automations

### Auto DOM update cron

**Finding:** The cron in `app/api/cron/daily-check/route.ts` already writes DOM state back to Supabase (section 4 of the route, lines 116–179). The `results.domStatusChanges` counter and the `supabase.update()` call are present. The milestone context says "extend cron to write state back to DB" — this is already done. Confirm with the architect whether there is a specific gap (e.g., the update is missing for certain estado transitions) rather than a full implementation.

**No new library or pattern needed here.** The existing cron pattern is correct.

### Weekly AI email cron

**Finding:** `app/api/cron/weekly-summary/route.ts` already exists, running every Monday at 12:00 UTC (`0 12 * * 1`). It currently sends a static template via `sendResumenSemanal`. The milestone adds AI-generated content to this email.

**Vercel Cron limits (Pro plan — confirmed from official Vercel docs, updated 2026-06-19):**

| Limit | Value |
|-------|-------|
| Max function duration (default) | 300 seconds |
| Max function duration (configurable) | 800 seconds |
| Memory | 2 GB / 1 vCPU (default), 4 GB / 2 vCPU (max) |
| Cron frequency | Minute-level cadence allowed on Pro |
| Cron jobs per project | 100 (on all plans) |
| CPU billing | Active CPU time only — waiting for AI model response does NOT count |

**For the weekly AI email, the critical constraint is the 300s default timeout.** A weekly summary across many projects that calls GPT-4o (or Claude) to generate personalized content could take 30–90 seconds. This is well within 300s even for 50 projects.

**If generating one AI call per user/architect (personalized emails), add `export const maxDuration = 300` to the route to be explicit.** Do NOT set it higher unless you've measured that 300s is insufficient.

**Pattern for the AI-generated email:**
```typescript
// In weekly-summary/route.ts
export const maxDuration = 300 // explicit, matches default

// Generate markdown summary with a single AI call
const markdownContent = await aiComplete([
  { role: 'system', content: WEEKLY_SUMMARY_SYSTEM_PROMPT },
  { role: 'user', content: buildProjectsContext(proyectos) }
], { max_tokens: 2000 })

// Convert markdown to HTML (no library needed — use a simple regex or the existing email template)
await sendResumenSemanal({ to: ..., htmlContent: markdownToHtml(markdownContent) })
```

**Do NOT add a markdown-to-HTML library** (e.g., `marked`, `remark`). The email template in `lib/email.ts` likely already uses inline HTML. A lightweight helper function that converts `**bold**`, `# headers`, and `- lists` to `<strong>`, `<h2>`, and `<ul>` is 20 lines and sufficient for email content. External parsers add bundle size and another dep to maintain.

### SII auto-fill on patente creation

**Recommendation: use `after()` from `next/server` — stable since Next.js 15.1.**

**Finding:** This app runs Next.js 16.2.9, which fully supports `after()` in Route Handlers (confirmed from official docs at version 16.2.9).

**Pattern for the patente creation route:**
```typescript
import { after } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  
  // 1. Create the patente record immediately
  const { data: patente, error } = await supabase
    .from('proyectos')
    .insert({ ...body })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 2. Fire SII enrichment AFTER the response — does not block the UI
  if (patente.rol_sii) {
    after(async () => {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
      const siiRes = await fetch(`${baseUrl}/api/enrich/sii`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: patente.rol_sii })
      })
      if (!siiRes.ok) return
      
      const { data } = await siiRes.json()
      await supabase
        .from('proyectos')
        .update({ sii_data: data, sii_enriched_at: new Date().toISOString() })
        .eq('id', patente.id)
    })
  }

  // 3. Return immediately — SII call happens in background
  return Response.json({ ok: true, patente })
}
```

**Why `after()` over a manual `Promise` without `await`:**
- On Vercel serverless, a dangling `Promise` is killed the moment the response is sent. `after()` uses Vercel's `waitUntil` primitive, which extends the function lifetime until the promise settles. This is the only safe way to do fire-and-forget on serverless.
- `after()` also executes even if the response threw an error, which is useful for audit logging.

**Timeout consideration:** The SII fetch in `after()` shares the route's `maxDuration`. The SII endpoint itself uses a 12-second timeout (`fetchWithTimeout`). The route response returns in ~100ms. Total wall time is under 15 seconds — no timeout issue.

**Confidence:** HIGH — verified from Next.js 16.2.9 official docs for `after()`.

---

## Dependencies to Add / NOT Add

### TO ADD (one item)

| Package | Command | Reason |
|---------|---------|--------|
| `sheet` component | `npx shadcn@latest add sheet` | Copiloto drawer primitive. Not a npm dep — scaffolds `components/ui/sheet.tsx`. |

### NOT TO ADD

| Package | Why Not |
|---------|---------|
| `@vercel/ai` / Vercel AI SDK | The existing hand-rolled SSE streaming pattern is sufficient. The SDK's main value is `useChat` hook, which is overkill for a single-purpose copilot drawer. Adds bundle weight. |
| `marked` / `remark` / `rehype` | For email-only markdown rendering, a 20-line inline converter is sufficient. Don't add a full markdown pipeline. |
| `vaul` (Drawer dependency) | Shadcn's `Drawer` wraps `vaul`. We're using `Sheet` instead. |
| `@base-ui/react` (additional usage) | Already installed but should remain a fallback low-level primitive only. Use shadcn components for new UI. |
| Any job queue (`bull`, `inngest`, `trigger.dev`) | Not needed. `after()` covers the SII auto-fill use case. Cron routes cover the scheduled use cases. A queue would be appropriate only if you need retry logic, failure persistence, or fan-out to >100 jobs. |
| Streaming-specific libraries (`eventsource`, `@microsoft/fetch-event-source`) | The client-side SSE consumer can use native `ReadableStream` + `getReader()`, matching the pattern implied by the existing chat page. |

### EXISTING — CONFIRM KEYS ARE SET IN VERCEL

The analysis API and weekly AI email both require `OPENAI_API_KEY` (already used). If the architect decides to migrate AI calls to Anthropic, `ANTHROPIC_API_KEY` must be added to Vercel environment variables. The `@anthropic-ai/sdk` is already installed (`^0.105.0`).

---

## Sources

- [Next.js `after()` function API reference (v16.2.9)](https://nextjs.org/docs/app/api-reference/functions/after) — HIGH confidence
- [Vercel Functions Limits (updated 2026-06-19)](https://vercel.com/docs/functions/limitations) — HIGH confidence
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — HIGH confidence
- [shadcn/ui Sheet vs Drawer discussion #3043](https://github.com/shadcn-ui/ui/discussions/3043) — HIGH confidence
- [shadcn/ui Sheet component docs](https://ui.shadcn.com/docs/components/radix/sheet) — HIGH confidence
- [Next.js SSE streaming pattern](https://upstash.com/blog/sse-streaming-llm-responses) — MEDIUM confidence (verified against existing codebase pattern)
- Existing source: `app/api/ai/chat/route.ts` — PRIMARY reference for streaming pattern
- Existing source: `app/api/cron/daily-check/route.ts` — PRIMARY reference for cron + DB write pattern
- Existing source: `app/api/enrich/sii/route.ts` — PRIMARY reference for SII enrichment
