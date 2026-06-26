---
phase: 07-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, rls, ddl, migration]

# Dependency graph
requires:
  - phase: 07-foundation
    provides: supabase/schema.sql with proyectos table and set_updated_at() function
provides:
  - document_checklist_items table DDL in supabase/schema.sql
  - RLS policy checklist_items_own (owner-only access via proyectos.user_id)
  - idx_checklist_items_proyecto_id index
  - trg_checklist_items_updated_at trigger
affects:
  - 08-copiloto-core (SKILL-04 checklist copiloto — requires this table to INSERT)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS via EXISTS subquery on proyectos.user_id = auth.uid() (same as etapas, documentos, comunicaciones)"
    - "CHECK constraints for enum values instead of Postgres ENUM types (avoids migration complexity)"

key-files:
  created: []
  modified:
    - supabase/schema.sql

key-decisions:
  - "item_key is NOT UNIQUE — multiple items with same key can coexist (e.g., after AI regeneration)"
  - "articulo_oguc is nullable — not all items reference a specific OGUC article"
  - "CHECK constraints on estado/source instead of ENUM types to avoid migration complexity"
  - "RLS follows exact pattern of etapas/documentos/comunicaciones (EXISTS subquery on proyectos)"

patterns-established:
  - "New tables linked to proyectos use EXISTS subquery RLS pattern, not direct user_id column"

# Metrics
duration: 5min
completed: 2026-06-25
---

# Phase 7 Plan 02: document_checklist_items Schema Summary

**DDL for document_checklist_items table added to supabase/schema.sql — enables SKILL-04 (AI checklist copiloto) persistence layer, with RLS, index, and updated_at trigger**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-25T00:00:00Z
- **Completed:** 2026-06-25T00:05:00Z
- **Tasks:** 1 auto (Task 2 paused at checkpoint)
- **Files modified:** 1

## Accomplishments
- Appended `document_checklist_items` DDL block (38 lines) to `supabase/schema.sql`
- RLS enabled with `checklist_items_own` policy (USING + WITH CHECK) following same pattern as etapas/documentos/comunicaciones
- Index `idx_checklist_items_proyecto_id` added for query performance
- Trigger `trg_checklist_items_updated_at` wired to existing `set_updated_at()` function

## Task Commits

1. **Task 1: Append document_checklist_items DDL to supabase/schema.sql** - `c0121e5` (feat)

## Files Created/Modified
- `supabase/schema.sql` - Appended document_checklist_items table, RLS policy, index, and trigger

## Decisions Made
- item_key is NOT UNIQUE to allow multiple AI generations to coexist for the same conceptual item
- articulo_oguc is nullable since not every checklist item maps to a specific OGUC article
- Used CHECK constraints (not ENUM types) on estado/source to avoid migration complexity in Supabase
- RLS policy uses EXISTS subquery via proyectos.user_id — exact same pattern as etapas, documentos, comunicaciones

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

**Task 2 (checkpoint:human-verify) — Apply migration manually in Supabase SQL Editor.**

The DDL is in `supabase/schema.sql` but has NOT been applied to the live database yet. This project does not use `supabase db push` or migrations — DDL is applied manually from the Supabase Dashboard SQL Editor.

**Steps to apply:**

1. Open your Supabase Dashboard for this project
2. Go to **SQL Editor > New Query**
3. Paste ONLY the new block below (do NOT re-run the full schema.sql — existing tables are already live):

```sql
-- ----------------------------------------------------------------------------
-- document_checklist_items (AI-generated + manual document checklist per project)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  item_key      text NOT NULL,
  label         text NOT NULL,
  articulo_oguc text,
  estado        text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'ok')),
  source        text NOT NULL DEFAULT 'ai'       CHECK (source IN ('ai', 'manual')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
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

CREATE TRIGGER trg_checklist_items_updated_at
  BEFORE UPDATE ON document_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

4. Run the query — expect: "Success. No rows returned."
5. Go to **Table Editor** — confirm `document_checklist_items` appears with 9 columns
6. Go to **Authentication > Policies** — confirm `checklist_items_own` policy is listed
7. Run this INSERT test in SQL Editor:

```sql
INSERT INTO document_checklist_items (proyecto_id, item_key, label)
SELECT id, 'test_item', 'Test label'
FROM proyectos LIMIT 1;
```

8. Then clean up:

```sql
DELETE FROM document_checklist_items WHERE item_key = 'test_item';
```

Both statements must succeed. Then reply "done" to continue.

## Next Phase Readiness
- `supabase/schema.sql` has the canonical DDL — Phase 8 SKILL-04 can reference it
- Once user applies the migration, the table is live and Phase 8 can INSERT checklist items
- Blocker FOUND-02 will be resolved once Task 2 checkpoint is confirmed

---
*Phase: 07-foundation*
*Completed: 2026-06-25*
