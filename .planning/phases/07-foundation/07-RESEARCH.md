# Phase 7: Foundation - Research

**Researched:** 2026-06-25
**Domain:** Supabase service role client, PostgreSQL migration, shadcn/ui Sheet component
**Confidence:** HIGH (all findings verified directly from codebase)

---

## Summary

Phase 7 has three independent, surgical fixes. Each is self-contained and fully confirmed by reading the actual source files.

**FOUND-01** is a confirmed bug: both cron routes use `createServerClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` and a `cookies()` shim. In a cron context there is no browser session, so `auth.uid()` resolves to `null` and every RLS-protected query silently returns 0 rows. A working precedent already exists in the codebase: `app/api/billing/webhook/route.ts` uses `createClient` from `@supabase/supabase-js` directly with `SUPABASE_SERVICE_ROLE_KEY`. Replication of that exact pattern is the fix.

**FOUND-02** is a pure SQL addition. The schema file `supabase/schema.sql` is the single source of truth — there are no versioned migration files, no `supabase/migrations/` directory. The `document_checklist_items` table does not exist anywhere in the schema or the codebase. The table must be added to `supabase/schema.sql` and executed directly against the Supabase project via the dashboard SQL editor.

**FOUND-03** is a shadcn CLI scaffolding step. The project uses shadcn v4.11.0 with `style: "base-nova"` and `@base-ui/react` primitives instead of Radix UI. The `components/ui/sheet.tsx` file does not exist. Standard `npx shadcn@latest add sheet` will scaffold it. Whether it uses the `base-nova` base-ui primitive or falls back to Radix needs one verification step after the CLI runs.

**Primary recommendation:** Fix the three items in order: service client first (FOUND-01), then the migration (FOUND-02), then the Sheet scaffold (FOUND-03). All three are independent.

---

## FOUND-01: Cron Service Role Fix

### Current State (confirmed by reading source)

**`app/api/cron/daily-check/route.ts` — lines 1-27:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
// ...
const cookieStore = await cookies()
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,   // <-- bug
  {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  }
)
```

**`app/api/cron/weekly-summary/route.ts` — lines 1-26:** Identical pattern. Same import, same key, same cookie shim.

### Working Precedent in the Codebase

`app/api/billing/webhook/route.ts` already solves this identically:
```typescript
import { createClient as createServiceClient } from "@supabase/supabase-js"
// ...
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase admin credentials not set")
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

### New File to Create: `lib/supabase/service.ts`

The existing `lib/supabase/server.ts` uses `createServerClient` from `@supabase/ssr` (cookie-based). The new service client must use `createClient` from `@supabase/supabase-js` directly (no cookies, no session, bypasses RLS via service role):

```typescript
import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase admin client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS. Must NEVER be used in
 * client components or routes accessible from the browser. Safe for crons,
 * webhooks, and background jobs where there is no user session.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

### Exact Change in Each Cron File

Replace the entire Supabase client block in both files:

**Remove:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
// ...
const cookieStore = await cookies()
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { getAll: ..., setAll: ... } }
)
```

**Add:**
```typescript
import { createServiceClient } from '@/lib/supabase/service'
// ...
const supabase = createServiceClient()
```

The `cookies` import from `next/headers` is no longer needed and must be removed from both files.

### Environment Variable Notes

- `SUPABASE_SERVICE_ROLE_KEY` — must NOT have `NEXT_PUBLIC_` prefix (server-only secret)
- It is already referenced in `app/api/billing/webhook/route.ts`, so it is present in the Vercel environment
- It must also be in `.env.local` for local testing

---

## FOUND-02: document_checklist_items Migration

### Current State

- No `supabase/migrations/` directory exists — the project uses a single `supabase/schema.sql` file
- There is no migration tooling or numbered file naming convention
- The `document_checklist_items` table does not exist anywhere in `supabase/schema.sql` or any other file
- The existing schema file is the canonical reference applied directly to Supabase

### How Migrations Work in This Project

**Pattern:** Edit `supabase/schema.sql` to add the new DDL, then execute the new statements directly in the Supabase dashboard SQL editor. There is no `supabase db push` pipeline or `supabase migration new` workflow in use.

### SQL to Add

Append to `supabase/schema.sql` after the enterprise tables section:

```sql
-- ----------------------------------------------------------------------------
-- document_checklist_items (AI-generated + manual document checklist per project)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_checklist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  item_key     text NOT NULL,
  label        text NOT NULL,
  articulo_oguc text,
  estado       text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'ok')),
  source       text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE document_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_own" ON document_checklist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = proyecto_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proyectos p
      WHERE p.id = proyecto_id AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_checklist_items_proyecto_id
  ON document_checklist_items(proyecto_id);

CREATE OR REPLACE TRIGGER trg_checklist_items_updated_at
  BEFORE UPDATE ON document_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Design Notes

- RLS policy mirrors the pattern used for `etapas`, `documentos`, and `comunicaciones` — access via the parent `proyectos` row, scoped to `auth.uid()`
- `set_updated_at()` function is already defined in the schema (line 269-275), the trigger can reference it directly
- `item_key` is a non-unique free-text key (e.g. `"memoria_de_calculo"`) — no UNIQUE constraint since multiple items with the same key could exist in different states
- `articulo_oguc` is nullable — not all checklist items reference a specific OGUC article

---

## FOUND-03: Sheet Component

### Current State

- `components/ui/sheet.tsx` does NOT exist
- Existing UI components: `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `input`, `label`, `progress`, `select`, `sonner`, `table`, `textarea`, `upgrade-prompt`

### shadcn Configuration (from `components.json`)

```json
{
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": { "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "ui": "@/components/ui", "utils": "@/lib/utils" }
}
```

**Critical detail:** `"style": "base-nova"` — this is NOT the standard `default` or `new-york` style. It uses `@base-ui/react` primitives instead of Radix UI, as confirmed by `dialog.tsx` (`import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"`).

### Install Command

```bash
npx shadcn@latest add sheet
```

Run from `/Users/tomas/Estefanía/permisohub`.

**shadcn version:** `"shadcn": "^4.11.0"` in package.json — `npx shadcn@latest` will use the correct version.

### Post-Install Verification Required

After running the CLI, open `components/ui/sheet.tsx` and check which primitive it uses:
- If it imports from `@base-ui/react/...` — matches the project style, no changes needed
- If it imports from `radix-ui` — the CLI may have fallen back to a Radix-based implementation; this still works but is stylistically inconsistent with the rest of the UI components

The Sheet component is used for the copiloto drawer (slide-in panel), so it needs to be importable as `import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| RLS bypass for server jobs | Custom middleware or anon+service_role mixing | `createClient` from `@supabase/supabase-js` with service role key |
| Slide-in drawer panel | Custom CSS transform + z-index stacking | `Sheet` from shadcn/ui (handles focus trap, accessibility, animation) |
| Auth context in cron | Cookie parsing, JWT decoding | Service client bypasses auth entirely — correct approach for crons |

---

## Common Pitfalls

### Pitfall 1: Leaving the `cookies` import in cron files after the fix
**What goes wrong:** `import { cookies } from 'next/headers'` is no longer needed after removing `createServerClient`. Leaving it is dead code and may cause a TypeScript warning or confusion for the next reader.
**How to avoid:** Remove the `cookies` import line when removing the `createServerClient` block.

### Pitfall 2: Naming the service client export `createClient` (conflicts with server.ts)
**What goes wrong:** Both `lib/supabase/server.ts` and the new `lib/supabase/service.ts` would export a function named `createClient`. Any file that imports both would have a naming collision.
**How to avoid:** The billing webhook uses `import { createClient as createServiceClient } from "@supabase/supabase-js"` as a local alias. The new `lib/supabase/service.ts` should export `createServiceClient` directly as its export name — no aliasing needed at call sites.

### Pitfall 3: Running the migration SQL when `set_updated_at` function doesn't exist yet
**What goes wrong:** The trigger `trg_checklist_items_updated_at` references `set_updated_at()`. If the new SQL is run in isolation (not as part of the full schema), it will fail with "function does not exist."
**How to avoid:** The function is already in the live Supabase database (it was applied with the full schema.sql). Only the new table DDL needs to be run in the SQL editor — the function is already there.

### Pitfall 4: shadcn `base-nova` style — Sheet may not use @base-ui primitives
**What goes wrong:** The `sheet` component in the shadcn registry may not have a `base-nova` variant, causing the CLI to scaffold a Radix-based Sheet instead. It will still work, but imports from `radix-ui` packages not in package.json may cause install prompts.
**How to avoid:** Run the CLI and verify the output immediately. If it adds new dependencies, accept them — they are needed and correct.

---

## Architecture Patterns

### Service Client Pattern (verified from billing webhook)

For any Route Handler that runs without a user session (crons, webhooks, background jobs):
```typescript
// lib/supabase/service.ts — server-only
import { createClient } from "@supabase/supabase-js"
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
```

### Schema Extension Pattern (verified from schema.sql)

All tables follow:
1. `CREATE TABLE IF NOT EXISTS` with `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. `CREATE POLICY` with `FOR ALL TO authenticated USING (...)`
4. `CREATE INDEX IF NOT EXISTS` for FK columns
5. `CREATE OR REPLACE TRIGGER ... EXECUTE FUNCTION set_updated_at()` if the table has `updated_at`

---

## State of the Art

| Old Approach (what the crons do now) | Correct Approach | Impact |
|--------------------------------------|-----------------|--------|
| `createServerClient` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `cookies()` | `createClient` + `SUPABASE_SERVICE_ROLE_KEY` (no cookies) | RLS sees `auth.uid() = null` → 0 rows vs. service role bypasses RLS → all rows |

---

## Open Questions

1. **Does `npx shadcn@latest add sheet` produce a base-nova compatible component?**
   - What we know: The project uses `style: "base-nova"` and `@base-ui/react` primitives
   - What's unclear: Whether the shadcn registry has a `sheet` component under the `base-nova` style
   - Recommendation: Run the CLI, inspect the output, accept any new dependencies it installs. If it scaffolds a Radix-based sheet, it is still functionally correct for this milestone.

2. **Is `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`?**
   - What we know: The key is referenced in `app/api/billing/webhook/route.ts` and must be in Vercel environment. The `.env.local` only shows `NEXT_PUBLIC_SUPABASE_URL`.
   - What's unclear: Whether it was added to `.env.local` for local dev
   - Recommendation: The planner should add a verification task — if missing locally, the cron fix will throw on startup.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `/Users/tomas/Estefanía/permisohub/app/api/cron/daily-check/route.ts` — confirmed anon key usage, lines 18-27
- `/Users/tomas/Estefanía/permisohub/app/api/cron/weekly-summary/route.ts` — confirmed anon key usage, lines 17-26
- `/Users/tomas/Estefanía/permisohub/lib/supabase/server.ts` — reference pattern for cookie-based client
- `/Users/tomas/Estefanía/permisohub/lib/supabase/client.ts` — browser client pattern
- `/Users/tomas/Estefanía/permisohub/app/api/billing/webhook/route.ts` — confirmed service role pattern, lines 1-35
- `/Users/tomas/Estefanía/permisohub/supabase/schema.sql` — full schema, confirmed no `document_checklist_items`, no migrations directory
- `/Users/tomas/Estefanía/permisohub/components/ui/` directory listing — confirmed no `sheet.tsx`
- `/Users/tomas/Estefanía/permisohub/components.json` — shadcn config, style `base-nova`, aliases
- `/Users/tomas/Estefanía/permisohub/package.json` — shadcn v4.11.0, next 16.2.9, @supabase/ssr ^0.12.0

---

## Metadata

**Confidence breakdown:**
- FOUND-01 fix: HIGH — bug confirmed by reading source, fix pattern confirmed by billing webhook in same codebase
- FOUND-02 migration SQL: HIGH — schema read in full, table absent, all patterns derived from existing tables
- FOUND-03 Sheet install: MEDIUM — CLI command is correct, but base-nova compatibility is unconfirmed until CLI runs

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stable dependencies, no fast-moving ecosystem concern)
