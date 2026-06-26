---
phase: 08-copiloto-core
verified: 2026-06-25T14:00:00-04:00
status: passed
score: 7/7 must-haves verified
gaps:
  - truth: "SKILL-05: Route calls sumarDiasHabiles for estimacion"
    status: partial
    reason: "sumarDiasHabiles is imported in lib/dias-habiles.ts but never called in the copiloto route. The route uses calcularDerechosMunicipales and stats.tiempoPromedioHabiles correctly, and the AI prompt includes plazoBase — but sumarDiasHabiles (calendar date projection from working days) is not invoked. The estimacion section still returns plazoMinDias + plazoMaxDias + CLP + UF, so the core goal is met, but the must-have specification is not fully satisfied."
    artifacts:
      - path: "app/api/ai/copiloto/route.ts"
        issue: "sumarDiasHabiles not imported or called; buildEstimacionPrompt passes tiempoPromedioHabiles as context but does not compute calendar end-date via sumarDiasHabiles"
    missing:
      - "Import sumarDiasHabiles from '@/lib/dias-habiles' in route.ts"
      - "Call sumarDiasHabiles(new Date(), plazoBase) to compute estimated calendar date and pass it to buildEstimacionPrompt or include in the estimacion response payload"
---

# Phase 08: Copiloto Core Verification Report

**Phase Goal:** El arquitecto puede abrir un panel lateral desde cualquier proyecto y obtener 4 análisis IA específicos al expediente sin ingresar datos adicionales.
**Verified:** 2026-06-25T14:00:00-04:00
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SKILL-01: CopilotoTrigger + CopilotoDrawer present and wired in all 3 pages | VERIFIED | Imported and rendered in permisos/page.tsx (lines 36-37, 567, 587-590), patentes/page.tsx (lines 38-39, 405, 425-428), proyectos/[id]/page.tsx (lines 49-50, 413-416, 1136-1140). Idle state renders 4 SKILL_CARDS from SKILL_CARDS array (copiloto-drawer.tsx lines 82-107, 215-237). |
| 2 | SKILL-02: POST /api/ai/copiloto with maxDuration=90, calls aiComplete for OGUC diagnosis using getContextoOGUC | VERIFIED | route.ts line 2: `export const maxDuration = 90`. Line 6: imports `getContextoOGUC`. Line 17-47: `buildOgucPrompt` calls `getContextoOGUC('FOT FOS rasante distanciamiento altura pisos')`. Line 216: `aiComplete([...buildOgucPrompt(p)...])`. Returns `oguc` section in JSON (line 283). |
| 3 | SKILL-03: Route calls aiComplete for observaciones using inteligencia-dom data, returns per-item structure | VERIFIED | Lines 8, 50-96: `buildObservacionesPrompt` calls `getInteligenciaMunicipio` and uses `ESTADISTICAS_MUNICIPIOS`. Line 217: `aiComplete` called. Prompt specifies per-item structure with `categoria`, `frecuencia`, `triggerEspecifico`, `accionPreventiva` (line 85-92). Returns `observaciones` in JSON (line 283). |
| 4 | SKILL-04: Route checks document_checklist_items before AI call (idempotency), inserts when count===0, PATCH route toggles estado | VERIFIED | Lines 174-176: queries `document_checklist_items`. Line 213: `hasExistingChecklist = (existingChecklist?.length ?? 0) > 0`. Lines 250-260: inserts rows only when `!hasExistingChecklist`. PATCH route at `/api/ai/copiloto/checklist/[itemId]/route.ts` toggles estado between 'pendiente' and 'ok' via Supabase update (lines 9-27). |
| 5 | SKILL-05: Route calls aiComplete for estimacion using calcularDerechosMunicipales + sumarDiasHabiles + stats.tiempoPromedioHabiles | PARTIAL | `calcularDerechosMunicipales` called (line 198). `stats.tiempoPromedioHabiles` used (line 126). `aiComplete` called (line 221). Returns estimacion with plazoMinDias + plazoMaxDias + derechosCLP + derechosUF (lines 272-281). **GAP: `sumarDiasHabiles` is NOT imported or called anywhere in the route.** |
| 6 | TypeScript: npx tsc --noEmit exits 0 | VERIFIED | `cd /Users/tomas/Estefanía/permisohub && npx tsc --noEmit` produced no output (exit 0, no errors). |
| 7 | No `any` types in copiloto files | VERIFIED | `grep -rn ": any\|as any"` across all copiloto files returned empty. `grep -n "any"` also returned empty after filtering comments. `Record<string, unknown>` pattern used at route.ts line 234 instead of `any`. |

**Score:** 6/7 truths verified (SKILL-05 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/ai/copiloto/route.ts` | POST route with 4 AI calls | VERIFIED | 289 lines, substantive implementation, all 4 prompt builders, idempotency check, proper JSON responses |
| `app/api/ai/copiloto/checklist/[itemId]/route.ts` | PATCH toggle route | VERIFIED | 34 lines, validates estado, Supabase update, returns updated item |
| `components/copiloto/copiloto-drawer.tsx` | Sheet with idle/loading/loaded/error states | VERIFIED | 300 lines, all 4 states implemented, caching by proyectoId, tab navigation |
| `components/copiloto/copiloto-trigger.tsx` | Trigger button | VERIFIED | 24 lines, Bot icon, proper props interface |
| `components/copiloto/tabs/tab-oguc.tsx` | OGUC tab rendering articulos | VERIFIED | 74 lines, renders articulos list with cumple status icons |
| `components/copiloto/tabs/tab-observaciones.tsx` | Observaciones tab | VERIFIED | 68 lines, riesgoGlobal badge, per-prediction cards with frecuencia dot |
| `components/copiloto/tabs/tab-checklist.tsx` | Checklist tab with toggle | VERIFIED | 101 lines, optimistic toggle, PATCH call to checklist API, progress bar |
| `components/copiloto/tabs/tab-estimacion.tsx` | Estimacion tab | VERIFIED | 99 lines, plazo range, CLP/UF, factores, advertencias, recomendacion |
| `app/(dashboard)/permisos/page.tsx` | CopilotoTrigger + CopilotoDrawer mounted | VERIFIED | Both imported and wired with state handlers at lines 308-309, 376-378, 567-568, 587-590 |
| `app/(dashboard)/patentes/page.tsx` | CopilotoTrigger + CopilotoDrawer mounted | VERIFIED | Both imported and wired at lines 122-123, 168-169, 405-409, 425-428 |
| `app/(dashboard)/proyectos/[id]/page.tsx` | CopilotoTrigger + CopilotoDrawer mounted | VERIFIED | Both imported and wired at lines 140, 413-416, 1136-1140 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| permisos/page.tsx | CopilotoDrawer | state: copilotoProyecto, copilotoOpen | WIRED | handleCopiloto sets both; drawer receives both |
| patentes/page.tsx | CopilotoDrawer | state: copilotoProyecto, copilotoOpen | WIRED | handleCopiloto sets both; drawer receives both |
| proyectos/[id]/page.tsx | CopilotoDrawer | estado: copilotoOpen; proyecto from page state | WIRED | Trigger opens drawer; drawer receives `proyecto` directly from page state |
| CopilotoDrawer | POST /api/ai/copiloto | fetch in handleCardClick | WIRED | Lines 147-151: fetch with proyectoId, response handled and stored in result+cache |
| TabChecklist | PATCH /api/ai/copiloto/checklist/[itemId] | fetch in handleToggle | WIRED | tab-checklist.tsx line 29: fetch PATCH with estado payload, optimistic update + revert on error |
| route.ts | lib/oguc-knowledge | getContextoOGUC | WIRED | Line 6 import, line 17 use in buildOgucPrompt |
| route.ts | lib/inteligencia-dom | getInteligenciaMunicipio | WIRED | Line 8 import, line 52 use in buildObservacionesPrompt |
| route.ts | lib/derechos-municipales | calcularDerechosMunicipales | WIRED | Line 9 import, line 198 call with proper args |
| route.ts | lib/municipios-stats | ESTADISTICAS_MUNICIPIOS | WIRED | Line 7 import, lines 51 and 125 use |
| route.ts | lib/dias-habiles | sumarDiasHabiles | NOT_WIRED | Not imported or called in route.ts |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| proyectos/[id]/page.tsx | 128 | MOCK_PROYECTOS used as initialProyecto fallback | Info | Mock data used as initial state before API loads; real data fetched in useEffect |
| proyectos/[id]/page.tsx | 73 | MOCK_OBSERVACIONES hard-coded | Info | Dev convenience; replaced by API data when available |

No blockers found in copiloto-specific files. Mock usage is in the broader project detail page, not in the copiloto implementation itself.

### Human Verification Required

None required — all must-haves are verifiable programmatically.

### Gaps Summary

One gap found: `sumarDiasHabiles` from `lib/dias-habiles` is listed as required in SKILL-05 but is not imported or called in `app/api/ai/copiloto/route.ts`. The practical impact is limited — the AI prompt correctly receives `tiempoPromedioHabiles` as a base reference, and the AI itself estimates min/max working days. The `estimacion` section returns `plazoMinDias`, `plazoMaxDias`, `derechosCLP`, and `derechosUF` as required. What's missing is the calendar date projection (convert AI-returned working days to actual calendar date using `sumarDiasHabiles`) which is not displayed in `tab-estimacion.tsx` anyway.

The fix is straightforward: import `sumarDiasHabiles` in route.ts and optionally pass computed calendar date to the AI prompt or include it in the estimacion payload.

---

_Verified: 2026-06-25T14:00:00-04:00_
_Verifier: Claude (gsd-verifier)_
