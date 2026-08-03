# Deferred Items — Phase 18 (competencia-por-formato)

Items discovered during plan execution that are out of scope for the
current plan (pre-existing, caused by a different plan's in-progress
work) — logged, not fixed, per execution deviation rules.

## Found during 18-02 execution (2026-08-02)

- **`npm run typecheck` fails on `tests/unit/competencia-formato.test.ts`**
  — references `@/lib/competencia-formato`, a module not yet created.
  This is plan 18-05's TDD RED commit (`3286596 test(18-05): add failing
  test for calcularResultadoCompetencia()`), already present in git
  history before 18-02 execution started (likely a parallel wave
  execution that stopped mid-TDD-cycle). Not caused by 18-02's changes —
  `lib/overpass-competencia.ts` does not touch `lib/competencia-formato.ts`
  or its test. Will resolve naturally when plan 18-05 executes its GREEN
  step (creates `lib/competencia-formato.ts`).
  **Resolved** — plan 18-05 completed in parallel during 18-02 execution
  (commit `3eae0aa`); `npm run typecheck` is clean again.
