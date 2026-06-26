# Phase 08-01 SUMMARY — API Routes

## Status: COMPLETE ✅

## Files created

### `app/api/ai/copiloto/route.ts`
- `export const maxDuration = 90` first (critical for Vercel)
- `export const dynamic = 'force-dynamic'`
- POST handler with 4 parallel `aiComplete()` calls via `Promise.all`
- Checklist idempotency: skips AI generation if `existingChecklist.length > 0`, returns DB rows directly
- Persists generated checklist items to `document_checklist_items` table
- UF value fetched from `/api/utils/uf` with 38000 fallback
- `calcularDerechosMunicipales()` for derechos pre-calculation

### `app/api/ai/copiloto/checklist/[itemId]/route.ts`
- PATCH handler with `await params` (Next.js App Router pattern)
- Toggles `estado: 'pendiente' | 'ok'` on `document_checklist_items`
- Validates estado value before DB write
- Returns `{ ok: true, item: data }`

## Prompt functions
- `buildOgucPrompt()` — uses `getContextoOGUC()` for OGUC context
- `buildObservacionesPrompt()` — uses `ESTADISTICAS_MUNICIPIOS` + `getInteligenciaMunicipio()`
- `buildChecklistPrompt()` — generates 8-15 items specific to trámite type and municipio
- `buildEstimacionPrompt()` — uses `tiempoPromedioHabiles` from stats + derechos info

## Types returned
```typescript
{
  ok: true,
  oguc: { articulos: OgucArticulo[], resumen: string },
  observaciones: { riesgoGlobal: 'BAJO'|'MEDIO'|'ALTO', predicciones: [], resumen: string },
  checklist: { items: ChecklistItem[] },
  estimacion: { plazoMinDias, plazoMaxDias, factores, recomendacion, derechosCLP, derechosUF, derechosDetalle, derechosAdvertencias }
}
```
