# Research Summary — v1.3 Army of Skills

**Synthesized:** 2026-06-25
**Sources:** STACK.md (HIGH), FEATURES.md (MEDIUM-HIGH), ARCHITECTURE.md (HIGH — codebase-verified), PITFALLS.md (HIGH)

---

## Stack Additions

One UI component to scaffold, zero new npm dependencies.

| What | How | Why |
|------|-----|-----|
| `shadcn Sheet` | `npx shadcn@latest add sheet` | Copiloto drawer primitive. Not installed yet — run before building `CopilotoDrawer`. |
| `lib/supabase/service.ts` | New file, `createClient` with `SUPABASE_SERVICE_ROLE_KEY` | Cron routes use `anon` client — silently returns 0 rows on RLS-protected tables (CRIT-1). |
| `lib/copiloto-prompts.ts` | New file, 4 exported prompt builder functions | Keeps `analyze-project` route thin; follows `lib/inteligencia-dom.ts` pattern. |
| `lib/ai-anthropic.ts` | New file only if Anthropic SDK is activated | `isAnthropicAvailable()` + `getAnthropicClient()` — do NOT modify existing `lib/ai.ts`. |

**Do NOT add:** Vercel AI SDK, `marked`/`remark`, `vaul`, `bull`/`inngest`, `eventsource`. The existing SSE pattern in `app/api/ai/chat/route.ts` is the reference — replicate it, don't replace it.

**Provider decision (unresolved — requires decision before Phase 2):** `lib/ai.ts` uses OpenAI GPT-4o. `@anthropic-ai/sdk` is installed but `ANTHROPIC_API_KEY` is not set. "Claude Sonnet 4.6 already integrated" means the SDK is installed, not active. The analysis API can ship with OpenAI (zero risk, key already configured). Migrate to Anthropic only as a deliberate decision — not incidentally during this milestone.

**Env vars to confirm in Vercel before deploy:**
- `SUPABASE_SERVICE_ROLE_KEY` — no `NEXT_PUBLIC_` prefix (exposing it client-side is a critical security hole)
- `OPENAI_API_KEY` — already set, confirm it is on the production environment
- `ANTHROPIC_API_KEY` — add only if provider migration is decided

---

## Feature Table Stakes

Every professional B2B AI copilot requires these. Skipping any one makes the tool feel broken to architects.

**Copiloto Drawer UX:**
- Context-aware on open — drawer must know `proyecto_id`, `tipo`, `municipio`, `estado` without user re-entry. Pass as props from `proyectos/[id]/page.tsx` where data is already in state.
- Task cards on first open — 3–4 suggested prompts per module (Diagnóstico OGUC / Predicción Observaciones / Checklist / Estimación). Blank box equals abandonment.
- Persistent session state — closing the drawer does not reset the conversation. Sheet unmounts children by default; lift analysis state to parent or use `key={proyecto_id}` for intentional reset on project switch.
- Skeleton on load, not spinner-and-wait — architecture decision: return structured JSON (not SSE) to stay consistent with all other non-chat AI routes. Show skeleton while `fetch` resolves (~2–4s is acceptable UX).
- Source citations with article numbers — architects cannot act on advice without knowing which OGUC article to cite. The `fuente` field in observation outputs is mandatory.

**4 Analysis Types (ranked by dependency and delivery order):**
1. Diagnóstico OGUC — project-specific numbers inside regulatory formulas, not generic alerts. HIGH hallucination risk on article numbers: restrict model to a curated article corpus in the system prompt, not free recall.
2. Predicción de Observaciones — each prediction needs: (a) observation category, (b) probability signal, (c) specific trigger from this expediente's data, (d) preventive action. Always surface confidence level. Generic "may have setback issues" is useless.
3. Checklist de Documentos — **persisted to Supabase** (`document_checklist_items` table, NEW). This is the most consequential architectural decision for this feature: architects return across sessions, checklists are collaborative, local state is unacceptable.
4. Estimación de Tiempo y Derechos — reuse existing `calculadora de derechos` (v1.0). Show ranges (X–Y days), never point estimates. Fabricated-feeling time estimates destroy trust faster than no estimate.

**Background Automations:**
- DOM auto-update: `estado` write-back already exists at line 149 of `daily-check`. The actual gap is inserting into `observaciones` when transition is `con_observaciones`. Add `fuente: 'scraper'` column to distinguish auto vs manual.
- SII auto-fill: non-blocking via `after()` from `next/server`. Form saves immediately, enrichment fires in background. Never block the save action on an external API.
- Weekly email: AI generates Section 3 tip only (one Claude call receiving all projects as JSON). Sections 1–2 are templated from real DB data. Generating factual statuses with AI introduces hallucinated deadlines — professionally unacceptable.

---

## Critical Discoveries

These findings change the implementation plan or require a decision before coding starts.

**1. Cron routes silently return empty data in production (live bug)**
Both `daily-check` and `weekly-summary` use `createServerClient` with the anon key. Vercel cron invocations carry no session cookies, so `auth.uid()` resolves to null and all RLS-protected queries return 0 rows with no error thrown. This bug is already live. Fix first: create `lib/supabase/service.ts` with `createServiceClient()` using `SUPABASE_SERVICE_ROLE_KEY` and use it in all cron routes. Apply manual `workspace_id`/`user_id` filters — RLS is bypassed by service_role, so application code is the only filter.

**2. The AI provider is OpenAI, not Anthropic (contradicts milestone brief)**
All AI calls route through `aiComplete()` in `lib/ai.ts` which wraps OpenAI GPT-4o. The `@anthropic-ai/sdk` is installed (`^0.105.0`) but dormant — no `ANTHROPIC_API_KEY` in environment. Decision needed before Phase B: ship analysis API on OpenAI (zero risk, key set) or activate Anthropic SDK now. Recommendation: OpenAI for this milestone. Plan Anthropic as a standalone migration with its own TypeScript type guard work.

**3. DOM write-back is partially done, not missing**
The cron already writes `estado` to `proyectos` (line 149). The actual gap is a 2-line addition: INSERT into `observaciones` when `estadoNuevo === 'con_observaciones'` and `scraperData.descripcion` is present. Check `supabase/migrations/` for `fuente` and `numero` columns before writing the INSERT.

**4. `document_checklist_items` table does not exist yet**
Type 3 (Document Checklist) requires a new Supabase table. Migration needed before the feature can be built. Schema: `id uuid`, `proyecto_id uuid REFERENCES proyectos(id)`, `item_key text`, `label text`, `estado text` (`ok|pendiente|no_aplica`), `updated_at timestamptz`, `updated_by uuid`, `notas text`.

**5. 4 parallel Claude calls will timeout on a naive sequential implementation**
Sequential `await` on 4 `aiComplete()` calls = 20–60s wall time against a 60s Pro function default. Use `Promise.all`. Set `export const maxDuration = 90` at route segment level. Cap each call at `max_tokens: 400`. Use prompt caching (`cache_control: { type: 'ephemeral' }`) on the shared system prompt across all 4 calls.

**6. `observaciones` table schema is unverified**
Both the cron extension and the document checklist touch this table, but schema was not inspected during research. Verify `fuente`, `numero`, and `documento_id` columns in Supabase Studio or `supabase/migrations/` before coding. Inserting into missing columns throws silently in some Supabase client configurations.

---

## Watch Out For

Ordered by severity.

**1. [CRIT] Cron service client missing → silent empty queries on all RLS tables**
Already live. Fix before extending either cron. Detection: log row count from a protected table query in the cron on production — if it returns 0 when data exists in dashboard, this is active. Fix: `lib/supabase/service.ts` with `SUPABASE_SERVICE_ROLE_KEY`.

**2. [CRIT] SSE stream not aborted on drawer unmount → server leak + unhandled rejections at scale**
The existing `chat/route.ts` has no abort handling. For any streaming feature in the copiloto, wire `request.signal.addEventListener('abort', ...)` on the server and `return () => controller.abort()` in client `useEffect`. Without this, closing the drawer mid-stream leaves a running server loop, logs `unhandledRejection: Error: aborted` on every close, and exhausts function concurrency. Note: if the copiloto uses JSON (not SSE) for the 4-analysis tabs as recommended, this only applies to a free-form chat tab if one is added.

**3. [CRIT] `JSON.parse` fails when Claude prepends explanatory prose**
Without structured outputs API, Claude occasionally wraps JSON in Spanish prose ("Aquí está el análisis:"). Use regex extraction as minimum: `raw.match(/\{[\s\S]*\}/)`. Prefer `output_config.format` with JSON schema (no beta header required as of 2026) to eliminate the failure path entirely.

**4. [IMP] Duplicate WhatsApp on double cron invocation**
Vercel EventBridge can double-invoke. Memory-level state comparison does not protect against concurrent runs. Use `.neq('estado', estadoNuevo)` in the Supabase update and check `count > 0` before firing WhatsApp. This makes the write idempotent at the database level.

**5. [IMP] Weekly digest must stay internal-only for MVP**
Current route sends to `ADMIN_EMAIL` only. Adding external client recipients without an unsubscribe flow triggers CAN-SPAM/FTC liability ($53,088 per violation, January 2025 rate). Keep external recipients out of scope until `comunicaciones_preferences` unsubscribe flow exists in Supabase.

---

## Build Order Recommendation

Dependencies flow in one direction: service client → prompt library → API route → drawer → page patch. Cron and patente work are independent threads.

**Phase A — Foundation (complete before writing any feature code)**
1. Create `lib/supabase/service.ts` — fixes live cron bug, unblocks all DB work
2. `npx shadcn@latest add sheet` — unblocks drawer component
3. Inspect `observaciones` table schema in `supabase/migrations/` — confirm or add `fuente`, `numero` columns
4. Create `document_checklist_items` migration — unblocks Type 3 feature

**Phase B — Copiloto Core**
5. `lib/copiloto-prompts.ts` — 4 prompt builders, no runtime deps, testable in isolation
6. `app/api/ai/analyze-project/route.ts` — `Promise.all` for 4 analyses, structured JSON, dev mock fallback, `maxDuration = 90`
7. `components/copiloto/copiloto-drawer.tsx` — Sheet, 4 tabs, `Record<tab, analysis>` cache to avoid re-fetching
8. Patch `proyectos/[id]/page.tsx` — 3-line addition to Herramientas IA card + `<CopilotoDrawer>` mount

**Phase C — Background Automations**
9. Extend `daily-check/route.ts` — add `observaciones` INSERT on `con_observaciones` + idempotent `.neq()` update + switch to `createServiceClient()`
10. Extend `weekly-summary/route.ts` — single AI call for Section 3 tip + `maxDuration = 120` + `createServiceClient()`
11. Extend `proyectos/route.ts` POST — `after()` SII enrichment for patente_comercial with `rol_sii`, disable button on client

**Research flags (need deeper investigation before coding):**
- Phase B Step 6: benchmark `Promise.all` with 4 concurrent `aiComplete()` calls under Vercel Pro before declaring `maxDuration = 90` sufficient
- Phase C Step 9: schema inspection result determines whether a migration is needed first
- Any Anthropic provider migration: separate research phase for TypeScript type guards + env var setup — do not fold into this milestone

**Standard patterns (no further research needed):**
- Drawer structure: `components/cadenas/local-historial-drawer.tsx` is the canonical existing template
- Cron auth: `validateCronSecret(request)` on every cron GET — do not skip
- Dev mock fallback: `if (NODE_ENV !== 'production') return mock` required in all new routes
- `export const dynamic = 'force-dynamic'` on any route using `ReadableStream`
- `after()` for fire-and-forget: stable in Next.js 16.2.9, confirmed in STACK.md
