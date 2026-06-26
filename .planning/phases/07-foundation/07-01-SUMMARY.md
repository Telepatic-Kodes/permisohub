---
phase: 07-foundation
plan: "01"
subsystem: supabase-cron
tags: [supabase, rls, cron, service-role, bug-fix]
dependency_graph:
  requires: []
  provides:
    - createServiceClient() in lib/supabase/service.ts
  affects:
    - app/api/cron/daily-check/route.ts
    - app/api/cron/weekly-summary/route.ts
    - Phase 9 AUTO-01, AUTO-02, AUTO-04
tech_stack:
  added:
    - "@supabase/supabase-js createClient (service role pattern)"
  patterns:
    - "Service role client: no session, no cookies, bypasses RLS"
key_files:
  created:
    - lib/supabase/service.ts
  modified:
    - app/api/cron/daily-check/route.ts
    - app/api/cron/weekly-summary/route.ts
decisions:
  - "Use @supabase/supabase-js createClient (not @supabase/ssr) for service role — no cookie adapter needed"
  - "Throw hard error if env vars missing — no silent anon fallback"
  - "auth.persistSession: false, autoRefreshToken: false — fully stateless"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-25"
  tasks_completed: 2
  files_changed: 3
---

# Phase 7 Plan 01: Supabase Service Client for Crons Summary

**One-liner:** Service role Supabase client extracted to lib/supabase/service.ts; both cron routes patched from anon cookie client to RLS-bypassing admin client.

## What Was Built

Production bug fix: both cron routes (`daily-check`, `weekly-summary`) were using `createServerClient` from `@supabase/ssr` with the anon key and a cookie adapter. In a cron context there is no browser session, so `auth.uid()` resolved to `null` and every RLS-protected query silently returned 0 rows — no errors, no data, no alerts sent.

Fix: created `lib/supabase/service.ts` exporting `createServiceClient()` which uses `SUPABASE_SERVICE_ROLE_KEY` via `@supabase/supabase-js` with sessions disabled. Both cron routes now import and call `createServiceClient()` instead.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create lib/supabase/service.ts | 30a88b2 | lib/supabase/service.ts (created) |
| 2 | Patch both cron route files | 775e417 | app/api/cron/daily-check/route.ts, app/api/cron/weekly-summary/route.ts |

## Verification Results

```
grep -rn "createServerClient|NEXT_PUBLIC_SUPABASE_ANON_KEY|cookieStore" app/api/cron/
# → no output (clean)

grep -n "createServiceClient" lib/supabase/service.ts app/api/cron/daily-check/route.ts app/api/cron/weekly-summary/route.ts
# → 5 matches: 1 export + 2 imports + 2 usages

npx tsc --noEmit
# → exit 0 (zero errors)
```

## Deviations from Plan

None — plan executed exactly as written.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` is NOT present in `.env.local`. This is expected for local dev (crons are not run locally). The key must be set in Vercel Dashboard > Settings > Environment Variables before production crons execute. Without it, `createServiceClient()` will throw a clear error: "Missing Supabase service credentials...".
- This fix unblocks Phase 9 AUTO-01, AUTO-02, and AUTO-04 which require crons to read real project data.

## Self-Check: PASSED

- [x] lib/supabase/service.ts exists at expected path
- [x] Commits 30a88b2 and 775e417 verified in git log
- [x] npx tsc --noEmit exits 0
- [x] No banned strings in cron files
