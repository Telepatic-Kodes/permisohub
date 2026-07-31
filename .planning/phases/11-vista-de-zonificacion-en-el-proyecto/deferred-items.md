# Deferred Items — Phase 11 (Vista de Zonificación en el Proyecto)

## `supabase/migrations/20260705_proyectos_sii.sql` never applied to the live Supabase project — RESOLVED

**Resolution (orchestrator, same session, before Wave 4):** Applied via `mcp__supabase__apply_migration` (idempotent, `ADD COLUMN IF NOT EXISTS` on all 7 columns) and verified live: `SELECT ... rol_sii, lat, lng FROM proyectos` now returns without error (previously `42703`). Restored `app/api/proyectos/[id]/zonificacion/route.ts`'s intended `proyecto.lat`/`proyecto.lng` fallback (the 11-06 workaround that dropped them from the `select()` is no longer necessary — reverted). Did not run a full end-to-end SII-enrichment smoke test (create a `patente_comercial` project with `numero_expediente` and confirm `after()` persists `rol_sii`/`superficie_terreno_m2`) — the schema-level fix is confirmed and in scope; the behavioral smoke test is a Phase-9-adjacent follow-up, not blocking Phase 11.

<details>
<summary>Original finding (11-06)</summary>

**Found during:** 11-06, Task 2 (live verification of the new `GET/POST /api/proyectos/[id]/zonificacion` route)

**Issue:** The migration file `supabase/migrations/20260705_proyectos_sii.sql` (adds `proyectos.rol_sii`, `destino_sii`, `avaluo_fiscal_clp`, `superficie_terreno_m2`, `superficie_construida_m2`, `lat`, `lng`) exists in the repo and is referenced by live code — `types/index.ts`'s `Proyecto` interface declares all 7 fields, `app/api/proyectos/route.ts` writes `lat`/`lng`/`rol_sii`/`superficie_terreno_m2` on creation when SII data is present, and several AI routes (`due-diligence`, `copiloto`, `pre-revision`) read `rol_sii`/`superficie_terreno_m2` — but the columns do not exist on the live Supabase project (confirmed via direct query with the service-role key: `SELECT id, rol_sii, ... FROM proyectos` returns Postgres error `42703 column proyectos.rol_sii does not exist`).

**Impact:** Any live write to these columns (e.g. the SII-enrichment `after()` block in `POST /api/proyectos`) has been silently failing in production since it shipped (09-02, documented as "live" in STATE.md) — writes to nonexistent columns error out, and if that error isn't surfaced/logged distinctly from other failure modes, this could be invisible. This is a separate, older gap than anything Phase 10/11 introduced.

**Why deferred, not fixed here:** Out of scope for 11-06 (SCOPE BOUNDARY — only fix issues directly caused by the current task's changes; this predates Phase 10 entirely). Also outside this executor session's reach: no `mcp__supabase__*` tools bound in this session (same recurring gap documented in STATE.md for 11-01/11-05) and no direct Postgres connection string in `.env.local` to apply DDL another way.

**Workaround applied in 11-06:** `app/api/proyectos/[id]/zonificacion/route.ts`'s `ownedProject()` does NOT select `proyectos.lat`/`proyectos.lng` (would break the entire query for every request, turning legitimate owners into false 404s). `GET`'s `lat`/`lng` fallback comes only from `zonificacion_cache.lat_r`/`lng_r` — correct for this route's actual need (polygon confirmation map), but doesn't fix the underlying drift.

**Recommended fix:** Orchestrator should apply `20260705_proyectos_sii.sql` directly via `mcp__supabase__apply_migration` (idempotent — every column is `ADD COLUMN IF NOT EXISTS`), the same way `20260730_zonificacion_v2.sql` and `20260731_zonificacion_codigo.sql` were applied in this phase. After applying, worth a quick smoke test that SII enrichment (`POST /api/proyectos` with a `numero_expediente`) actually persists `rol_sii`/`superficie_terreno_m2`/`lat`/`lng` end-to-end.

</details>
