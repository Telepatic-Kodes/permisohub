# Phase 9: Automatizaciones - Research

**Researched:** 2026-06-26
**Domain:** Vercel Cron Jobs, Next.js `after()`, Supabase atomic writes, AI-generated email content
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 9 patches four automation systems that already exist in skeletal form. No new architecture is needed — all files, libraries, and infrastructure are in place. The work is surgical: fix three bugs in `daily-check/route.ts`, add `after()` in `proyectos/route.ts`, and extend `weekly-summary/route.ts` with an AI tip plus a schedule correction.

The most important correctness fix is decoupling DOM scraping from the WhatsApp availability guard (AUTO-02). Currently the entire scraper block sits inside `if (isWhatsAppAvailable())`, meaning estado changes are never recorded in the DB if Twilio is not configured. This is a data integrity bug, not a feature gap.

The second critical finding is a response shape mismatch in the SII enrichment flow (AUTO-03). The pre-gathered context assumes `POST /api/enrich/sii` returns a flat `{ ok, giro, superficieTerreno }` object. The actual route at `app/api/enrich/sii/route.ts` returns `{ ok, rol, data: { superficieTerreno, superficieConstruida, destino, ... } }` — nested under `data`. There is no `giro` field at all in that endpoint. Giro is entered manually by Estefanía on the patentes page. The `after()` callback must read `siiData.data.superficieTerreno`, not `siiData.superficieTerreno`.

**Primary recommendation:** Implement all four AUTOs in a single wave. They touch independent files, have no inter-dependencies, and the changes are small enough to review together.

---

## Standard Stack

### Libraries already in use — no new installs required

| Library | Version (from codebase) | Purpose in this phase |
|---------|------------------------|----------------------|
| `next/server` (`after`) | Next.js 15+ | Fire-and-forget post-response work in AUTO-03 |
| `@supabase/supabase-js` | installed | DB writes with `.neq()` filter |
| `openai` | installed | `aiComplete()` for weekly tip in AUTO-04 |
| `twilio` | installed | WhatsApp delivery in AUTO-02 |
| `resend` | installed | Email delivery in AUTO-04 |

**No new packages needed.**

---

## Architecture Patterns

### AUTO-01: Idempotent DB write in cron

**Pattern:** Supabase update with `.neq()` guard to make the write a no-op if the state already matches. Prevents double-update from Vercel cron double-invocation.

**File:** `app/api/cron/daily-check/route.ts`, lines 139-142

**Current code (buggy):**
```typescript
await supabase
  .from('proyectos')
  .update({ estado: estadoNuevo, updated_at: new Date().toISOString() })
  .eq('id', p.id)
```

**Corrected code:**
```typescript
await supabase
  .from('proyectos')
  .update({
    estado: estadoNuevo,
    etapa_actual: scraperData.descripcion ?? null,
    updated_at: new Date().toISOString(),
  })
  .eq('id', p.id)
  .neq('estado', estadoNuevo)  // no-op if already at this estado
```

Two bugs fixed simultaneously: (1) idempotency via `.neq()`, (2) missing `etapa_actual` field that was already being passed to the WhatsApp call but never persisted.

---

### AUTO-02: Decouple DOM scraping from WhatsApp guard

**Pattern:** Move the `if (isWhatsAppAvailable())` guard inward so it wraps only the `enviarWhatsApp()` call. DOM scraping and DB writes always run.

**File:** `app/api/cron/daily-check/route.ts`, lines 104-169

**Current structure (buggy):**
```typescript
// Entire scraper block — including DB update — is inside this guard:
if (isWhatsAppAvailable()) {
  // fetch activeProjects
  // scrape DOM
  // update DB  ← THIS NEVER RUNS IF TWILIO NOT CONFIGURED
  // send WhatsApp
}
```

**Corrected structure:**
```typescript
// Section 4 — DOM scraper loop (always runs)
const { data: activeProjects } = await supabase
  .from('proyectos')
  .select('*, clientes(*)')
  .not('numero_expediente', 'is', null)
  .not('estado', 'in', '("aprobado","rechazado","borrador")')

if (activeProjects) {
  for (const p of activeProjects) {
    if (!p.numero_expediente || !p.municipio) continue

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
      const scraperRes = await fetch(`${baseUrl}/api/scraper/dom-en-linea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expediente: p.numero_expediente, municipio: p.municipio }),
      })

      if (!scraperRes.ok) continue

      const scraperData = await scraperRes.json() as {
        ok: boolean
        estado?: string
        descripcion?: string
      }

      if (!scraperData.ok || !scraperData.estado) continue

      const estadoNuevo = scraperData.estado
      if (estadoNuevo === p.estado) continue

      results.domStatusChanges++

      // DB write — idempotent (AUTO-01 fix included)
      await supabase
        .from('proyectos')
        .update({
          estado: estadoNuevo,
          etapa_actual: scraperData.descripcion ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)
        .neq('estado', estadoNuevo)

      // WhatsApp — only if configured (guard moved here)
      if (isWhatsAppAvailable()) {
        const telefono = p.clientes?.telefono
        if (!telefono) continue

        const tipoWA = estadoNuevo === 'aprobado' ? 'aprobado'
          : estadoNuevo === 'con_observaciones' ? 'con_observaciones'
          : estadoNuevo === 'en_revision' ? 'en_revision'
          : null

        if (!tipoWA) continue

        const waResult = await enviarWhatsApp(telefono, tipoWA, {
          proyectoNombre: p.nombre,
          municipio: p.municipio,
          etapa: scraperData.descripcion,
          arquitecta: 'Estefanía Parada',
        })

        if (waResult.ok) results.whatsappSent++
        else results.errors.push(`WA for ${p.id}: ${waResult.error}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'scraper error'
      results.errors.push(`scraper ${p.numero_expediente}: ${msg}`)
    }
  }
}
```

---

### AUTO-03: `after()` for SII enrichment on patente_comercial creation

**Pattern:** Next.js `after()` schedules async work to execute after the response has been sent to the client. Inside `after()` there is no request context — cannot use `createClient()` (requires cookies). Must use `createServiceClient()`.

**File:** `app/api/proyectos/route.ts`

**Critical finding — SII endpoint response shape (verified from source):**

The correct internal endpoint to call is `GET /api/sii/lookup?rol=XXX`, NOT `POST /api/enrich/sii`. The `enrich/sii` route returns `{ ok, rol, data: { superficieTerreno, ... } }` (nested, strings) while `sii/lookup` returns `{ ok, data: { superficie_terreno_m2: number | null, superficie_construida_m2: number | null, destino: string, ... } }` (already-parsed numbers, matching the DB column types exactly).

There is no `giro` field from any SII API endpoint. `giro_sii` on patentes is entered manually via the patentes page UI — it is not scraped. Do not attempt to populate `giro_sii` from SII enrichment.

**Corrected `after()` pattern (using `sii/lookup`):**
```typescript
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Inside POST handler, after successful insert and before return:
if (body.tipo === 'patente_comercial' && proyecto?.id && body.numero_expediente) {
  const proyectoId = proyecto.id
  const rol = body.numero_expediente  // ROL SII format: XXXX-X or XXXX-XXX

  after(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
      const siiRes = await fetch(
        `${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(rol)}`,
        { method: 'GET' }
      )
      if (!siiRes.ok) return

      const siiData = await siiRes.json() as {
        ok?: boolean
        data?: {
          superficie_terreno_m2: number | null
          superficie_construida_m2: number | null
          destino: string
          direccion_normalizada?: string
        }
      }
      if (!siiData.ok || !siiData.data) return

      const supabase = createServiceClient()
      await supabase
        .from('proyectos')
        .update({
          superficie_terreno_m2: siiData.data.superficie_terreno_m2 ?? null,
          superficie_construida_m2: siiData.data.superficie_construida_m2 ?? null,
          destino_sii: siiData.data.destino ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', proyectoId)
    } catch {
      // Fire-and-forget — non-blocking, errors are silent
    }
  })
}

return Response.json({ ok: true, id: proyecto.id })
```

**Required import addition at top of file:**
```typescript
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
```

**Dev mode caveat:** The `sii/lookup` route returns simulated data in `NODE_ENV !== 'production'`, so `after()` will silently update with mock values in dev. This is acceptable — fire-and-forget means no dev breakage.

**Vercel function timeout:** `after()` callbacks run up to the function's max duration. For Hobby plan, this is 10s. The SII lookup has a 15s internal timeout — lower it or accept that on Hobby the SII call may be cut short. On Pro plan (60s) this is fine.

---

### AUTO-04: AI tip in weekly summary + schedule fix

**Pattern A — Generate tip before calling `sendResumenSemanal`.**

**File:** `app/api/cron/weekly-summary/route.ts`

Add at top:
```typescript
import { aiComplete, isAIAvailable } from '@/lib/ai'
```

Replace the current `sendResumenSemanal` call block with:
```typescript
let tipSemanal = ''
if (isAIAvailable()) {
  try {
    const resumenTexto = proyectosResumen
      .map(p =>
        `${p.nombre} (${p.municipio}): ${p.estado}${p.tieneAlerta ? ' — ALERTA' : ''}`
      )
      .join('\n')
    tipSemanal = await aiComplete(
      [{
        role: 'user',
        content: `Eres un experto en tramitación DOM chilena. Analiza estos proyectos activos y entrega UN consejo práctico breve (2-3 oraciones) para la semana:\n\n${resumenTexto}\n\nEl consejo debe ser específico y accionable para la arquitecta.`,
      }],
      { max_tokens: 200 }
    )
  } catch {
    tipSemanal = ''
  }
}

const result = await sendResumenSemanal({
  to: ESTEFANIA_EMAIL,
  clienteNombre: 'Estefanía Parada',
  proyectos: proyectosResumen,
  tipSemanal,
})
```

**Pattern B — Extend `sendResumenSemanal` signature.**

**File:** `lib/email.ts`, function `sendResumenSemanal` (line 253)

Add `tipSemanal?: string` to the params type and render it above the project table:
```typescript
export async function sendResumenSemanal(params: {
  to: string
  clienteNombre: string
  proyectos: Array<{
    nombre: string
    municipio: string
    estado: string
    etapa: string
    fechaEstimada?: string
    tieneAlerta?: boolean
  }>
  tipSemanal?: string  // ← add this
}): Promise<EmailResult> {

  // Add this block before the rows/table HTML:
  const tipBlock = params.tipSemanal
    ? `<div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin: 20px 0;">
         <p style="color: #1E40AF; font-weight: 600; margin: 0 0 8px; font-size: 13px;">Consejo de la semana</p>
         <p style="color: #1E3A8A; margin: 0; font-size: 14px; line-height: 1.5;">${escapeHtml(params.tipSemanal)}</p>
       </div>`
    : ''

  // Insert tipBlock into the content string, between the intro paragraph and the table
```

**Pattern C — Fix vercel.json schedule.**

**File:** `vercel.json`

Current: `"0 12 * * 1"` → 09:00 Santiago (UTC-3 in winter / UTC-4 in summer — inconsistent)
Required: `"0 11 * * 1"` → 08:00 Santiago (same as daily-check convention)

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-check",
      "schedule": "0 11 * * *"
    },
    {
      "path": "/api/cron/weekly-summary",
      "schedule": "0 11 * * 1"
    }
  ]
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Post-response async work | Custom webhook or background job | `after()` from `next/server` | Native Next.js 15 primitive, no extra infrastructure |
| Atomic conditional DB update | Application-level check-then-update | `.neq()` Supabase filter | DB-level atomicity, no race conditions |
| AI text generation | Custom prompt management | `aiComplete()` in `lib/ai.ts` | Already abstracted, includes `isAIAvailable()` guard |
| SII property data | Manual scraping inside cron | `GET /api/sii/lookup` | Already implemented, handles dev simulation, error fallback |

---

## Common Pitfalls

### Pitfall 1: `after()` using request-scoped Supabase client
**What goes wrong:** Calling `await createClient()` inside `after()` throws "cookies() called outside request context" because the request has already been responded to.
**Why it happens:** `createClient()` in `lib/supabase/server.ts` reads cookies from the active Next.js request context, which no longer exists inside `after()`.
**How to avoid:** Always use `createServiceClient()` from `lib/supabase/service.ts` inside `after()`. This client takes credentials from env vars only — no request context needed.
**Warning signs:** Runtime error containing "cookies" or "headers" called from `after()` callback.

### Pitfall 2: Wrong SII endpoint / response shape
**What goes wrong:** Calling `POST /api/enrich/sii` and reading `siiData.giro` or `siiData.superficieTerreno` returns `undefined` — the data is nested under `siiData.data` and there is no `giro` field.
**Why it happens:** Two separate SII routes exist: `app/api/enrich/sii/route.ts` (POST, returns nested strings) and `app/api/sii/lookup/route.ts` (GET, returns nested parsed numbers). The correct one for AUTO-03 is `GET /api/sii/lookup`.
**How to avoid:** Use `GET /api/sii/lookup?rol=XXX` and read from `siiData.data.superficie_terreno_m2` (already a `number | null`, no `parseFloat` needed). Do not populate `giro_sii` — it is manually entered.
**Warning signs:** `superficie_terreno_m2` stays `null` in DB after patente creation even though SII has the property.

### Pitfall 3: Scraper block accidentally removed or reorganized
**What goes wrong:** When restructuring the `if (isWhatsAppAvailable())` block, forgetting to keep the `results.domStatusChanges++` counter outside the WhatsApp guard.
**Why it happens:** The counter tracks scraper activity, not WA activity. If it moves inside the WA guard, the cron response will report 0 domStatusChanges even when scraping worked.
**How to avoid:** `results.domStatusChanges++` stays immediately after the `if (estadoNuevo === p.estado) continue` check, before any WA code.

### Pitfall 4: `tipSemanal` passed as `undefined` vs `''`
**What goes wrong:** The `tipBlock` in email.ts renders an empty blue box if `tipSemanal` is an empty string but `aiComplete()` returned `''`.
**Why it happens:** The check `if (params.tipSemanal)` is falsy for `''`, so this is actually safe. But if someone changes the guard to `!== undefined`, an empty tip box renders.
**How to avoid:** Always initialize `tipSemanal = ''` (not `undefined`) and keep the falsy check `if (params.tipSemanal)` in the email template.

### Pitfall 5: Schedule timezone drift (DST)
**What goes wrong:** `"0 12 * * 1"` fires at 09:00 Santiago in Chilean winter (UTC-3) but 08:00 in summer (UTC-4) because Chile observes DST.
**Why it happens:** Vercel cron runs in UTC. Santiago switches between UTC-3 and UTC-4 seasonally.
**How to avoid:** Use `"0 11 * * 1"` which matches the daily-check convention (`"0 11 * * *"`). This fires at 08:00 in winter, 07:00 in summer — acceptable, consistent with the rest of the app.

### Pitfall 6: `after()` import not available in older Next.js
**What goes wrong:** `import { after } from 'next/server'` throws module error.
**Why it happens:** `after()` is available in Next.js 15+. Older project setups may use Next.js 14.
**How to avoid:** The AGENTS.md confirms this project uses a breaking-changes Next.js version. Verify with `node_modules/next/package.json` if in doubt. `after` appears in Next.js 15 release notes as a stable API.

---

## File Changes Required (Complete Map)

| File | Change | AUTO |
|------|--------|------|
| `app/api/cron/daily-check/route.ts` | Add `.neq('estado', estadoNuevo)` + `etapa_actual` field to update | AUTO-01 |
| `app/api/cron/daily-check/route.ts` | Remove outer `if (isWhatsAppAvailable())` guard from scraper block; move guard to wrap only `enviarWhatsApp()` call | AUTO-02 |
| `app/api/proyectos/route.ts` | Add `after()` import + `createServiceClient` import; add `after()` block after successful insert for `patente_comercial` tipo | AUTO-03 |
| `lib/email.ts` | Add `tipSemanal?: string` to `sendResumenSemanal` params; add `tipBlock` HTML above project table | AUTO-04 |
| `app/api/cron/weekly-summary/route.ts` | Add `aiComplete`/`isAIAvailable` imports; generate `tipSemanal`; pass to `sendResumenSemanal` | AUTO-04 |
| `vercel.json` | Change weekly-summary schedule from `"0 12 * * 1"` to `"0 11 * * 1"` | AUTO-04 |

---

## Wave Grouping Recommendation

**Single wave — all four AUTOs together.**

Rationale:
- All changes are in independent files. No task blocks another.
- Total file changes: 6 edits across 6 files. Small scope.
- The bugs in AUTO-01 and AUTO-02 are in the same function in the same file — splitting them across waves would mean touching `daily-check/route.ts` twice.
- AUTO-03 and AUTO-04 each touch independent files with no shared state.

Suggested task order within the wave (for review clarity, not dependency):
1. Fix `daily-check/route.ts` — AUTO-01 + AUTO-02 together (same file, adjacent code)
2. Add `after()` to `proyectos/route.ts` — AUTO-03
3. Extend `email.ts` `sendResumenSemanal` signature — AUTO-04 part A
4. Update `weekly-summary/route.ts` — AUTO-04 part B
5. Fix `vercel.json` schedule — AUTO-04 part C

---

## Open Questions

1. **Vercel plan / `after()` timeout**
   - What we know: `after()` runs up to the function's max duration. `sii/lookup` has a 15s internal timeout for the SII HTTP call.
   - What's unclear: Whether this project runs on Hobby (10s limit) or Pro (60s limit).
   - Recommendation: If on Hobby, either accept that SII enrichment may time out silently (fire-and-forget so no user impact), or lower the SII fetch timeout inside `sii/lookup` to 8s.

2. **`numero_expediente` format validation for ROL**
   - What we know: Patentes use `numero_expediente` to store the ROL SII (`XXXX-X`). The `sii/lookup` route accepts `?rol=XXXX-X`.
   - What's unclear: Whether `numero_expediente` for patentes is always in ROL format or could be something else.
   - Recommendation: The `after()` block should fire unconditionally for `patente_comercial` tipo when `numero_expediente` is present, and let the lookup route fail gracefully if the format is wrong (it returns `ok: false` with an error, which the `after()` catch handles).

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `app/api/cron/daily-check/route.ts` — lines 104-169, exact current code verified
- `app/api/cron/weekly-summary/route.ts` — complete file, 52 lines
- `app/api/proyectos/route.ts` — POST handler lines 47-97
- `lib/email.ts` — `sendResumenSemanal` function lines 253-314
- `lib/ai.ts` — `aiComplete`, `isAIAvailable` signatures
- `lib/whatsapp.ts` — `enviarWhatsApp`, `isWhatsAppAvailable` signatures
- `lib/supabase/service.ts` — `createServiceClient` (no request context required)
- `app/api/sii/lookup/route.ts` — response shape: `{ ok, data: { superficie_terreno_m2: number|null, ... } }`
- `app/api/enrich/sii/route.ts` — response shape: `{ ok, rol, data: { superficieTerreno: string, ... } }` — NOT used for AUTO-03
- `lib/sii-lookup.ts` — `SIIData` interface confirming DB column names
- `vercel.json` — current schedules: daily `"0 11 * * *"`, weekly `"0 12 * * 1"`

---

## Metadata

**Confidence breakdown:**
- AUTO-01 fix: HIGH — bug clearly visible at line 141-142, fix is one method chain addition
- AUTO-02 fix: HIGH — structural issue clearly visible at line 105, refactor is mechanical
- AUTO-03 pattern: HIGH — `after()` usage and `createServiceClient` constraint verified; SII response shape verified from source
- AUTO-04 AI tip: HIGH — `aiComplete`/`isAIAvailable` API verified; email template extension pattern matches existing code style
- Schedule fix: HIGH — both current and target cron expressions verified in `vercel.json`

**Research date:** 2026-06-26
**Valid until:** Stable — changes only if Next.js major version bump or Supabase client API changes
