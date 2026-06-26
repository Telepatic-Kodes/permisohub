# Pitfalls Research — v1.3 Army of Skills

**Domain:** Adding AI copilot drawer + background automations to existing Next.js 15 + Supabase SaaS
**Researched:** 2026-06-25
**Overall confidence:** HIGH (all critical findings verified against official docs and live issues)

---

## Critical (must address in Phase 7 — before any feature ships)

---

### CRIT-1: Both cron routes use `anon_key` with `createServerClient` — they will silently fail or return wrong data

**What goes wrong:** Both `/api/cron/daily-check` and `/api/cron/weekly-summary` initialize Supabase via `createServerClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Cron invocations from Vercel carry **no user session cookies**. The result: the `auth.uid()` used in RLS policies resolves to `null`, so any table with `SELECT` policies keyed to `auth.uid()` returns zero rows or an RLS error. Queries appear to succeed (no JS error) but return empty data. This is silent — there is no 401 from Supabase.

**Why it happens now but will get worse:** The existing cron already runs scrapers and sends emails. Adding a DOM state write-back and a weekly AI digest will query more tables. Any new table with RLS (which is the correct default) will also silently return nothing.

**Official source:** Supabase explicitly warns: "You cannot use SSR clients with service_role as the cookie would replace the default role with a user session." The inverse is also true: SSR clients in cookie-less contexts get `anon` role, not the intended admin role.

**Prevention — create a dedicated service client factory:**
```typescript
// lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // NOT NEXT_PUBLIC_
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

Use this in every cron route. Never pass cookies to this client. Apply manual `.eq('workspace_id', ...)` filters in queries — RLS is bypassed entirely by service_role, so application code is the only filter.

**Detection:** Query a table with RLS enabled using the existing cron, log the row count. If it returns 0 on production but data exists in the dashboard, this pitfall is active.

---

### CRIT-2: SSE stream in the copilot drawer is not aborted on unmount — leaks backend computation and causes `ResponseAborted` unhandled rejections

**What goes wrong:** The existing `/api/ai/chat` route uses a `ReadableStream` but has no abort handling. When the Sheet drawer closes (`onOpenChange(false)`), the React component unmounts and the `fetch()` call is garbage-collected, but the server-side `for await` loop over the Claude stream continues running until the response body errors out. Next.js App Router throws `unhandledRejection: Error: aborted` (ECONNRESET) to the server console with every drawer close. At scale this exhausts Vercel function concurrency.

**Source:** Next.js issue #56529 and discussion #61972 both document this exact pattern. The PR #94658 adds framework-level handling but has not shipped as of research date.

**Prevention — wire `request.signal` on the server, `AbortController` on the client:**

Server route:
```typescript
export async function POST(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      // Register abort handler BEFORE starting the AI stream
      request.signal.addEventListener('abort', () => {
        controller.close()
        // If you have a reference to the Anthropic stream, call stream.controller.abort()
      })

      try {
        const anthropicStream = client.messages.stream({ ... })
        for await (const chunk of anthropicStream) {
          if (request.signal.aborted) break
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        if (!request.signal.aborted) {
          // Only log unexpected errors, not intentional aborts
          console.error('AI stream error:', err)
        }
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
}
```

Client hook (inside the drawer component):
```typescript
useEffect(() => {
  if (!open) return  // Don't start when drawer is closed
  const controller = new AbortController()

  fetch('/api/ai/copilot', {
    method: 'POST',
    signal: controller.signal,
    body: JSON.stringify({ proyecto_id }),
  }).then(async (res) => {
    const reader = res.body!.getReader()
    // ... read loop ...
  }).catch((err) => {
    if (err.name !== 'AbortError') setError(err.message)
    // AbortError is expected on drawer close — swallow it
  })

  return () => controller.abort()  // Fires when drawer closes or component unmounts
}, [open, proyecto_id])
```

**React Strict Mode double-mount:** In development, React Strict Mode mounts → unmounts → remounts every component. Without the `return () => controller.abort()` cleanup, two simultaneous streams will start on every drawer open in dev. This does not happen in production but hides bugs during development.

---

### CRIT-3: The 4-analysis structured JSON call will hit Tier 1 OTPM limits if run as 4 parallel requests

**What goes wrong:** The milestone calls for one POST to return a JSON object with 4 analysis types. If implemented as `Promise.all([call1, call2, call3, call4])`, each Claude Sonnet 4.6 request generating ~500 output tokens simultaneously fires 4 requests. Tier 1 OTPM for Claude Sonnet 4.x is **8,000 tokens/minute** and RPM is **50 requests/minute**. Four concurrent 500-token responses consume 2,000 OTPM (fine) but if the system prompt is large (e.g., full proyecto context at ~3,000 input tokens each), 4 × 3,000 = 12,000 ITPM against a Tier 1 limit of **30,000 ITPM** — tight but not a blocker.

The real risk is sequential timeout: a single Vercel serverless function handling 4 sequential Claude calls each taking 5-15 seconds = 20-60 seconds. The Pro plan default maxDuration is 60 seconds. If any call is slow (network, Claude latency spike), the function times out and returns 504 with partial data.

**Prevention:**
- Use `Promise.all` (parallel), not sequential `await` chains
- Cap each individual call at `max_tokens: 400` — enough for 4 structured analysis fields
- Set `maxDuration = 90` in the route segment config (requires Vercel Pro, not Hobby)
- Use prompt caching: add `cache_control: { type: 'ephemeral' }` to the shared system prompt across all 4 calls. The Anthropic docs confirm cached tokens do NOT count against ITPM, effectively giving you higher throughput

```typescript
// app/api/proyectos/[id]/analisis/route.ts
export const maxDuration = 90  // seconds — set at route segment level

export async function POST(request: Request, { params }: ...) {
  const [analisis1, analisis2, analisis3, analisis4] = await Promise.all([
    callClaude('riesgos', proyectoContext),
    callClaude('prioridad', proyectoContext),
    callClaude('proximos_pasos', proyectoContext),
    callClaude('observaciones', proyectoContext),
  ])
  return Response.json({ analisis1, analisis2, analisis3, analisis4 })
}
```

---

### CRIT-4: Migrating from OpenAI SDK to Anthropic SDK — strict TypeScript will break on content block access

**What goes wrong:** The existing `lib/ai.ts` uses `response.choices[0].message.content`. The Anthropic SDK returns `response.content[0]` which is typed as `ContentBlock` — a union of `TextBlock | ToolUseBlock`. Accessing `.text` on a `ContentBlock` without a type guard fails TypeScript strict mode compilation.

**Source:** Anthropic SDK TypeScript README documents this. The SDK also has a known issue where new API features arrive before TypeScript type definitions (confirmed in anthropic-sdk-typescript issues #864, #939, #996).

**Prevention — always narrow the union before accessing `.text`:**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const response = await client.messages.create({ ... })
const textBlock = response.content.find(
  (block): block is Anthropic.TextBlock => block.type === 'text'
)
const text = textBlock?.text ?? ''
```

For streaming, `stream.finalMessage()` returns a complete `Anthropic.Message` — use that instead of accumulating stream events manually, because the type of individual `MessageStreamEvent` deltas are harder to work with under strict mode.

Do not add `as any` casts as a workaround. If the TypeScript type doesn't exist yet for a new API feature, use `// @ts-expect-error` with a comment explaining why, so it becomes a visible TODO.

---

## Important (address before shipping)

---

### IMP-1: The weekly-summary cron adding Claude generation will exceed the 60s Vercel function timeout on Hobby plan

**What goes wrong:** The current `weekly-summary` route reads projects and calls `sendResumenSemanal`. Adding a Claude call to generate an AI narrative per project (e.g., 10 projects × 1 Claude call each) at 3-8 seconds per call = 30-80 seconds. On Vercel Hobby, functions timeout at 10 seconds. On Pro, the default is 60 seconds, but fluid compute raises it to 800 seconds (GA on Pro).

**Rate limit math for the weekly cron scenario:** If Estefanía manages 20 active projects and the digest generates 1 Claude call per workspace (not per project), the weekly cron makes 1-3 Claude calls total. This is safe within any tier. The mistake is designing it as per-project calls.

**Prevention:**
1. Design the weekly digest as **one Claude call** that receives a JSON summary of all projects, not N calls
2. Add `export const maxDuration = 120` to the route
3. Structure the prompt: pass the full `proyectosResumen` array as JSON in a single message, ask Claude to write the narrative for all of them

```typescript
// Single call covering all projects
const narrative = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 800,
  messages: [{
    role: 'user',
    content: `Genera un resumen ejecutivo semanal en español para Estefanía Parada sobre estos proyectos de gestión de permisos:\n${JSON.stringify(proyectosResumen, null, 2)}`
  }]
})
```

---

### IMP-2: Anthropic SDK streaming can hang indefinitely if the server stalls mid-stream — no built-in idle timeout

**What goes wrong:** The Anthropic SDK TypeScript has a documented open issue (#867) where streaming connections that stall (server sends no more events but doesn't close the connection) will hang the client forever. The 10-minute SDK default timeout only fires if no response starts — once streaming begins, the timeout resets. This matters for the copilot drawer: a user sees the spinner forever with no error if Claude's infrastructure stalls.

**Prevention:** Implement a per-event idle watchdog manually until the SDK ships `idleTimeout` support:
```typescript
let lastEventAt = Date.now()
const IDLE_LIMIT_MS = 30_000  // 30 seconds without a new chunk = stall

const watchdog = setInterval(() => {
  if (Date.now() - lastEventAt > IDLE_LIMIT_MS) {
    controller.close()
    clearInterval(watchdog)
  }
}, 5_000)

for await (const chunk of anthropicStream) {
  lastEventAt = Date.now()
  // ... enqueue chunk
}
clearInterval(watchdog)
```

---

### IMP-3: SII enrichment triggered on patente form submit — double-submission race condition creates duplicate external calls

**What goes wrong:** If the "autofill from SII" button (or form submit) triggers an API call and the user clicks twice (or the network is slow), two simultaneous requests to SII's website fire. SII's site may block the second request or return inconsistent data. The second response may overwrite the first if both race to `supabase.update()`.

**Source:** Next.js race condition analysis confirms Server Actions do not automatically prevent double submissions. React 19's `useFormStatus` only disables the button if using a `<form action={serverAction}>` pattern — not with `onClick` handlers.

**Prevention:**
1. Disable the trigger button immediately on first click (set `isPending = true` before the `await`)
2. On the API route: check if `sii_data_fetched_at` is within the last 5 minutes — return cached data instead of re-fetching
3. On the DB write: use `upsert` with a unique constraint, not separate insert + update

```typescript
// Client: disable button before async call
const [pending, setPending] = useState(false)

async function handleSIIEnrich() {
  if (pending) return  // hard guard, not just UI
  setPending(true)
  try {
    await enrichFromSII(patente_id)
  } finally {
    setPending(false)
  }
}
```

---

### IMP-4: Structured JSON output from Claude — `JSON.parse` will fail if Claude appends explanatory text

**What goes wrong:** When asking Claude to return JSON without using the official `output_format` structured outputs API, Claude sometimes prepends "Aquí está el análisis:" or appends "Espero que esto sea útil." The `JSON.parse()` call throws `SyntaxError` and the route returns 500.

**Two prevention strategies:**

Option A (simpler, works now): Extract JSON from the response with a regex before parsing:
```typescript
const raw = textBlock?.text ?? ''
const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/)
const parsed = JSON.parse(jsonMatch?.[1] ?? raw) as AnalisisResult
```

Option B (robust, requires beta header): Use Anthropic's structured outputs API with `output_config.format`:
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  // output_config with JSON schema guarantees valid JSON — no parsing errors
  // Requires anthropic-beta: structured-outputs-2025-11-13 header
  // Schema complexity limit: 24 optional parameters total across all schemas
})
```

Option B is preferred for the 4-analysis route because it eliminates the parse failure path entirely. Option A is the fallback.

---

### IMP-5: Daily cron writes DOM state back to Supabase without idempotency — duplicate state changes fire multiple WhatsApp messages

**What goes wrong:** The existing `daily-check` cron already compares `scraperData.estado !== p.estado` before writing. But if Vercel triggers the cron twice at the same minute (documented: EventBridge can occasionally double-invoke), two scraper calls for the same project run concurrently. Both see the old state, both detect a change, both write and both fire a WhatsApp message.

**Prevention — use a Postgres `UPDATE ... WHERE estado != $newEstado` pattern:**
```typescript
// This is idempotent: only updates if the state actually differs at DB time
const { count } = await supabaseService
  .from('proyectos')
  .update({ estado: estadoNuevo, updated_at: new Date().toISOString() })
  .eq('id', p.id)
  .neq('estado', estadoNuevo)  // Only update if different in DB, not just in memory
  .select('id', { count: 'exact', head: true })

if (count && count > 0) {
  // State actually changed at DB level — safe to send notification
  await enviarWhatsApp(...)
}
```

The `.neq('estado', estadoNuevo)` condition makes the write idempotent: if a concurrent invocation already wrote the same state, this update affects 0 rows and no duplicate WhatsApp fires.

---

## Watch Out For

---

### WATCH-1: `NEXT_PUBLIC_` prefix on service_role key would expose it to the browser

The `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed `NEXT_PUBLIC_`. If it is, Next.js bundles it into client-side JS and every user can read it in DevTools. The existing `lib/supabase/server.ts` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (correct for anon). The new service client must use `process.env.SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC prefix). Verify this in Vercel dashboard env vars.

---

### WATCH-2: shadcn Sheet component re-mounts children on close by default — SSE state is lost

The `Sheet` component from shadcn/ui unmounts its children when `open` transitions to `false` (default behavior). Any React state accumulated during streaming (partial text, error state) is destroyed. This is correct behavior for the copilot drawer — each open should start fresh — but if you use a state management approach that persists outside the Sheet (e.g., Zustand store), stale streaming state from a previous session can re-appear when the drawer reopens.

Recommendation: keep all copilot state local to the drawer component (`useState` inside `CopilotDrawer`), not in a shared store. Use a `key={proyecto_id}` on the Sheet content to force a clean remount if the user switches projects without closing.

---

### WATCH-3: Vercel cron `maxDuration` is not set on existing routes — defaults to 10s on Hobby, 60s on Pro

Neither `daily-check` nor `weekly-summary` export a `maxDuration`. The daily check already loops over all active projects calling the DOM scraper (15s timeout each) plus sending emails. With more than 4 active projects, this route likely already exceeds 60 seconds on Pro and definitely exceeds 10 seconds on Hobby. Add `export const maxDuration = 300` to both cron routes.

---

### WATCH-4: The existing AI chat route uses `OPENAI_API_KEY` — migrating to Anthropic requires updating `isAIAvailable()` check

`lib/ai.ts` exports `isAIAvailable()` which checks `!!process.env.OPENAI_API_KEY`. New copilot routes using the Anthropic SDK need their own availability check. Do not change the existing `isAIAvailable()` — it may still be used by other routes. Add a parallel `isAnthropicAvailable()`:

```typescript
// lib/ai-anthropic.ts
import Anthropic from '@anthropic-ai/sdk'

export function isAnthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
```

---

### WATCH-5: Email digest sent to Estefanía only — adding external client recipients requires unsubscribe compliance

The current `weekly-summary` sends only to `ADMIN_EMAIL` (Estefanía). If the new digest expands to send to external clients (empresas), CAN-SPAM requires a visible unsubscribe mechanism and the FTC penalty is now $53,088 per violation (updated January 2025). Resend provides list management but it must be wired to a `comunicaciones_preferences` column in Supabase.

Keep the MVP digest internal-only (Estefanía only). Add external client digests only after implementing an unsubscribe flow.

---

### WATCH-6: Anthropic SDK streaming and Next.js `dynamic = 'force-dynamic'` — must be set on all new AI routes

The existing chat route sets `export const dynamic = 'force-dynamic'`. Any new route using `ReadableStream` for SSE must also export this, otherwise Next.js may attempt to statically optimize or cache the route, which breaks streaming. This is easy to forget when copy-pasting the route handler structure.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Copilot drawer (SSE) | Stream not aborted on unmount → server-side leak | Wire `request.signal` + client `AbortController` (CRIT-2) |
| Copilot drawer (SSE) | Stream stalls silently → infinite spinner | Add idle watchdog timer (IMP-2) |
| 4-analysis API | Sequential Claude calls → 504 timeout | Use `Promise.all` + `maxDuration = 90` (CRIT-3) |
| 4-analysis API | JSON parse failure on Claude response | Use structured output API or regex extraction (IMP-4) |
| 4-analysis API | TypeScript strict errors on content blocks | Use type guard `block.type === 'text'` (CRIT-4) |
| Cron DOM write-back | Dual invocation → duplicate WhatsApp | `.neq()` idempotent update (IMP-5) |
| Cron DOM write-back | RLS silently returns 0 rows | Switch to service_role client (CRIT-1) |
| SII auto-fill | Double-click → duplicate external calls | Disable button + `neq` upsert guard (IMP-3) |
| Weekly AI digest | Per-project Claude calls → timeout | One call with full JSON context (IMP-1) |
| Weekly AI digest | External recipients → CAN-SPAM risk | Internal-only until unsubscribe flow exists (WATCH-5) |

---

## Sources

- Supabase service_role discussion: https://github.com/orgs/supabase/discussions/30739
- Next.js SSE abort issue #56529: https://github.com/vercel/next.js/issues/56529
- Next.js ResponseAborted discussion #61972: https://github.com/vercel/next.js/discussions/61972
- Anthropic SDK idle timeout issue #867: https://github.com/anthropics/anthropic-sdk-typescript/issues/867
- Anthropic rate limits (official): https://platform.claude.com/docs/en/api/rate-limits
- Anthropic structured outputs (official): https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic TypeScript SDK README: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md
- Vercel cron production pitfalls (2026): https://zenn.dev/asoventure/articles/2026-05-03-vercel-cron-best-practices
- Vercel function limits: https://vercel.com/docs/functions/limitations
- Next.js race condition patterns: https://medium.com/@mehran.khanjan/3-race-conditions-hiding-in-your-next-js-server-actions-i-shipped-all-3-07a8daf7f515
- Supabase CVE-2025-48757 security retro: https://supabase.com/blog/supabase-security-2025-retro
- CAN-SPAM FTC 2025 penalty update: https://www.termsfeed.com/blog/email-newsletters-unsubscribe/
