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

- **Duration:** ~10 min (Task 1 automated, Task 2 manual checkpoint by user)
- **Started:** 2026-06-25T00:00:00Z
- **Completed:** 2026-06-25 (user confirmed checkpoint)
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify — both complete)
- **Files modified:** 1

## Accomplishments
- Appended `document_checklist_items` DDL block (38 lines) to `supabase/schema.sql`
- RLS enabled with `checklist_items_own` policy (USING + WITH CHECK) following same pattern as etapas/documentos/comunicaciones
- Index `idx_checklist_items_proyecto_id` added for query performance
- Trigger `trg_checklist_items_updated_at` wired to existing `set_updated_at()` function
- **Table applied to live Supabase instance** — user confirmed via SQL Editor (Task 2 checkpoint complete)
- Test INSERT with real `proyecto_id` succeeded and cleaned up
- **FOUND-02 resolved** — table is live; SKILL-04 (Phase 8) is now unblocked

## Task Commits

1. **Task 1: Append document_checklist_items DDL to supabase/schema.sql** - `c0121e5` (feat)
2. **Task 2: Apply migration in Supabase SQL Editor** - checkpoint:human-verify confirmed by user (no code commit — manual Supabase Dashboard action)

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

Task 2 was a checkpoint:human-verify. The user applied the migration manually in the Supabase Dashboard SQL Editor and confirmed:
- `document_checklist_items` visible in Table Editor with 9 columns
- `checklist_items_own` policy listed in Authentication > Policies
- Test INSERT with real `proyecto_id` succeeded and was cleaned up

No further setup required.

## Next Phase Readiness
- `supabase/schema.sql` has the canonical DDL for reference
- Table is live — Phase 8 SKILL-04 can INSERT checklist items immediately
- FOUND-02 resolved — no outstanding blockers for Phase 8 from this plan

---
*Phase: 07-foundation*
*Completed: 2026-06-25*
