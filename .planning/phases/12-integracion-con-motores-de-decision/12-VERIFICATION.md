---
phase: 12-integracion-con-motores-de-decision
verified: 2026-07-30T19:40:00Z
status: passed
score: 4/4 must-haves verified
human_verification:
  - test: "Regenerar un informe de Due Diligence (llamada IA real, costosa) sobre un proyecto que tenga simultáneamente (a) zona utilizable (zona_status='encontrado', zona_usos_disponibles=true) y (b) un set de documentos cuyo destino declarado realmente no calce con los usos permitidos de la zona, para observar en vivo un hallazgo con refNormativa.fuente='PRC' renderizado por CitaBadges."
    expected: "El hallazgo aparece con un badge de cita 'PRC' (mismo componente genérico ya usado para OGUC/LGUC/DDU), con etiqueta 'Zona {codigo} — {nombre}' y link a zona_fuente_url."
    why_human: "Requiere una llamada real a OpenAI (costosa) y un proyecto/expediente de prueba cuyo contenido documental produzca naturalmente una incoherencia destino/zona detectable por el modelo — no se pudo montar en la sesión de checkpoint del 30/07 porque los proyectos de datos de desarrollo disponibles no tenían esa combinación exacta. NO es un déficit de código: el threading de tipos en 3 capas (route.ts → ProyectoContexto → resolverRefNormativa) fue confirmado por tsc limpio, y la rama PRC de resolverRefNormativa() y la genericidad de CitaBadges fueron leídas y confirmadas línea por línea en esta verificación (ver evidencia abajo). Este ítem es una confirmación adicional recomendada, no bloqueante."
---

# Phase 12: Integración con Motores de Decisión Verification Report

**Phase Goal:** Los motores existentes — vía de tramitación, due diligence y copiloto IA — incorporan la zonificación como señal adicional citada, de forma estrictamente aditiva: `recomendarVia()` no cambia su lógica determinista, y todo proyecto sin dato de zonificación disponible sigue funcionando exactamente igual que hoy.
**Verified:** 2026-07-30T19:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

**Note:** This is the final phase of milestone v1.4 ("Zonificación como fuente"). This verification passing closes the entire milestone.

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Alerta citada de incompatibilidad de uso en vía de tramitación, sin alterar `recomendarVia()` | ✓ VERIFIED | Code read confirms `via-decision.tsx`'s alert is a third, independent `useEffect` + a sibling JSX block gated on `compat?.estado === "no_permitido"`, never merged into `rec`/`ViaRecomendada`. `lib/via-tramitacion.ts` has zero commits during Phase 12 (`git log` shows only `1de1ed6`/`ed652b0`, both pre-phase). 14/14 determinism tests pass unmodified. Live-confirmed in 12-04's browser checkpoint: alert fires with real AI-generated citation + working decree link, zero clicks. |
| 2 | `due-diligence.ts` can cite the zone as a finding source via new `'PRC'` `FuenteHallazgo` | ✓ VERIFIED | `lib/due-diligence.ts` read directly: `FuenteHallazgo = FuenteNormativa \| 'PRC'`, `resolverRefNormativa()`'s PRC branch builds the citation directly from `proyecto.zona_codigo/zona_nombre/zona_fuente_url` (never `getArticuloById`), silently discards (`continue`) when zone isn't usable. `ProyectoContexto` and `route.ts`'s `ProyectoRow`/`proyectoContexto` are threaded in lockstep with all 7 `zona_*` fields + `destino_sii`. `npx tsc --noEmit` clean project-wide (would catch a 3-layer type mismatch). `CitaBadges` in `due-diligence-report.tsx` confirmed generic — only uses `r.fuente` as a React key (`${r.fuente}-${r.id}`), zero fuente-specific branching. Live: DD tab loads without error; a live AI-generated PRC finding was not observed end-to-end (see human_verification item — non-blocking). |
| 3 | Copiloto's OGUC-diagnostic and checklist skills receive zone usos permitidos/prohibidos as prompt context | ✓ VERIFIED | `app/api/ai/copiloto/route.ts` read directly: `seccionZonificacion(p)` (guarded by `zona_status==='encontrado' && zona_usos_disponibles===true`, applies `fixMojibakeArcGIS`) is interpolated into both `buildOgucPrompt()` (line 43) and `buildChecklistPrompt()` (line 121). Confirmed `buildObservacionesPrompt()` and `buildEstimacionPrompt()` were deliberately NOT touched (no call to `seccionZonificacion` in either). Live-confirmed in 12-04: "Diagnóstico OGUC" ran a real OpenAI call with the injected context present, returned a complete response with 4 article citations, no crash. |
| 4 | No-regression: a project without geocodable address / coverage / zonificación consulted behaves exactly as before in all 3 engines | ✓ VERIFIED | All three integrations share the exact compound guard `zona_status === 'encontrado' && zona_usos_disponibles === true` (verified textually in `via-decision.tsx:79`, `due-diligence.ts:324`/`411`, `copiloto/route.ts:22`) — none rely on `zona_status` alone, correctly excluding both the "no zone" case and the Ñuñoa case (`encontrado` but `usos_disponibles:false`). Live-confirmed in 12-04: alert absent (rest of panel byte-identical) when `zona_status !== 'encontrado'`; alert also absent for the Ñuñoa-style case, confirming the compound guard gates the UI (not just `zona_status`). |

**Score:** 4/4 truths verified (truth 2 verified via strong code-level evidence + live tab-load check; full live AI-triggered PRC citation not observed — see human_verification, non-blocking)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/proyecto/via-decision.tsx` | Third useEffect + citation-backed alert, sibling to `rec` | ✓ VERIFIED | Read in full. `compat` state, third `useEffect` (lines 78-102) with compound guard + fetch to `/api/proyectos/[id]/compatibilidad`, alert block (lines 197-223) gated on `compat?.estado === "no_permitido"`, fully separate from `rec.alertas`/`rec.cita`. |
| `components/proyecto/pmo-panel.tsx` | Passes full `proyecto` object to `ViaDecision` | ✓ VERIFIED | `<ViaDecision proyecto={proyecto} />` at line 181. |
| `lib/due-diligence.ts` | `FuenteHallazgo`, `RefNormativa.fuente`, `ProyectoContexto` extension, `resolverRefNormativa` PRC branch, `buildSynthesisPrompt` zona section | ✓ VERIFIED | Read in full; all elements present exactly as planned (lines 67, 72-78, 171-185, 323-330, 408-439). |
| `app/api/ai/due-diligence/route.ts` | `ProyectoRow` + `proyectoContexto` extended with `destino_sii`+`zona_*` | ✓ VERIFIED | Read in full; `ProyectoRow` (lines 37-52) and `proyectoContexto` literal (lines 174-188) both carry all 8 new fields. |
| `app/api/ai/copiloto/route.ts` | `seccionZonificacion()` injected into `buildOgucPrompt`/`buildChecklistPrompt` | ✓ VERIFIED | Read lines 1-150; `seccionZonificacion` defined (21-28), called at line 43 (OGUC) and 121 (checklist); `buildObservacionesPrompt`/`buildEstimacionPrompt` confirmed untouched. |
| `lib/via-tramitacion.ts` | Unchanged — `recomendarVia()`/`pasoSiguiente()` signatures intact | ✓ VERIFIED | Read in full (178 lines); `git log` shows zero Phase-12 commits touching this file. |
| `tests/unit/via-tramitacion.test.ts` | Unchanged, still passes | ✓ VERIFIED | `npx vitest run` → 14/14 passed. |
| `components/proyecto/due-diligence-report.tsx` (`CitaBadges`) | Generic over `fuente`, zero changes needed | ✓ VERIFIED | Read the component: only uses `r.fuente` as part of a React `key`; no fuente-specific rendering logic. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `via-decision.tsx` | `POST /api/proyectos/[id]/compatibilidad` | third `useEffect` fetch | ✓ WIRED | Confirmed call site + response handling (`setCompat`), reuses existing Phase 11 endpoint unmodified. |
| `pmo-panel.tsx` | `via-decision.tsx` | `<ViaDecision proyecto={proyecto} />` | ✓ WIRED | Confirmed prop threading. |
| `app/api/ai/due-diligence/route.ts (procesar)` | `lib/due-diligence.ts (synthesizeDueDiligence)` | `proyectoContexto` object | ✓ WIRED | All 8 fields populated from the Supabase row and passed through; `tsc` clean confirms the types line up end-to-end. |
| `lib/due-diligence.ts (resolverRefNormativa, fuente==='PRC')` | `proyecto.zona_codigo/zona_nombre/zona_fuente_url` | direct construction (never `getArticuloById`) | ✓ WIRED | Confirmed by direct code read — PRC branch never calls the curated-corpus lookup. |
| `app/api/ai/copiloto/route.ts (buildOgucPrompt, buildChecklistPrompt)` | `seccionZonificacion(p)` | string interpolation | ✓ WIRED | Confirmed at both call sites. |
| `seccionZonificacion` (both copiloto and due-diligence versions) | `lib/zonificacion-format.ts (fixMojibakeArcGIS)` | mojibake repair before injection | ✓ WIRED | Confirmed applied to `zona_uperm`/`zona_uproh`/`zona_nombre` in both `due-diligence.ts:326-328` and `copiloto/route.ts:24-26`. |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|-----------------|
| INTEG-01 | ✓ SATISFIED | None. Note: `.planning/REQUIREMENTS.md` checkbox/status table still shows this as unchecked/"Pending" — bookkeeping only, not a code gap; recommend the orchestrator update it when closing the phase. |
| INTEG-02 | ✓ SATISFIED | None blocking. See human_verification item for an optional live-AI confirmation follow-up. Same bookkeeping note applies. |
| INTEG-03 | ✓ SATISFIED | None. Same bookkeeping note applies. |

### Anti-Patterns Found

No blocker or warning-level anti-patterns (TODO/FIXME/placeholder/stub returns/empty handlers) found in any of the 8 files read for this verification. All three new prompt/citation/alert code paths have real logic, real guards, and real fallback behavior (silent-drop / empty-string), not stubs.

Two eslint `react-hooks` warnings exist in the touched files (`via-decision.tsx:81` `setCompat(null)` inside effect, `pmo-panel.tsx:109`/`153` pre-existing) — confirmed non-blocking (0 errors, matches 12-04-SUMMARY's own accounting; `pmo-panel.tsx` warnings pre-date Phase 12).

### Human Verification Required

One optional, non-blocking follow-up (see YAML frontmatter `human_verification`): live-observe an actual AI-generated `'PRC'`-sourced finding in a regenerated Due Diligence report. This was not exercised live during the 12-04 checkpoint (no suitable test project/document combination was available without an expensive, possibly-inconclusive real OpenAI regeneration). Code-level evidence (tsc clean 3-layer type threading, direct read of `resolverRefNormativa`'s PRC branch, direct read of `CitaBadges`'s genericity) is strong enough that this does not block phase completion.

### Gaps Summary

No blocking gaps found. All 4 ROADMAP success criteria and all must_haves from the 4 PLAN frontmatters (12-01 through 12-04) are verified either by direct code reading + tsc/eslint/vitest, or by the orchestrator's live browser+Supabase-MCP checkpoint documented in 12-04-SUMMARY.md. The one item not observed live (a real AI-triggered PRC citation rendering end-to-end) is documented honestly as a non-blocking follow-up rather than fabricated, and is backed by strong code-level evidence (type-checked 3-layer threading, line-by-line confirmation of the resolution branch and the generic rendering component).

`lib/via-tramitacion.ts` — the phase's central non-negotiable constraint — was independently confirmed untouched both by direct file read and by `git log` inspection (zero Phase-12 commits), with its 14-test determinism suite passing unmodified.

Since this is the final phase of milestone v1.4, and it passes, **the entire milestone (Phases 10-12: Motor de Zonificación → Vista de Zonificación en el Proyecto → Integración con Motores de Decisión) is complete.**

---
*Verified: 2026-07-30T19:40:00Z*
*Verifier: Claude (gsd-verifier)*
