# Phase 08-02 SUMMARY — Copiloto Components

## Status: COMPLETE ✅

## Files created

### `components/copiloto/copiloto-trigger.tsx`
- Simple button with `Bot` icon from lucide-react
- Props: `proyecto` (Pick<Proyecto, ...>) + `onClick` callback
- Used per-row in tables and in project detail header

### `components/copiloto/copiloto-drawer.tsx`
- State machine: `idle → loading → loaded → error`
- Per-project result cache: `Map<string, CopilotoResult>` in useState
- Checks cache before making API call — instant for previously analyzed projects
- Uses `Sheet` (side="right", `sm:max-w-xl`) from shadcn/ui
- Plain `<button>` tab nav (NO shadcn Tabs component)
- 4 tabs: oguc / observaciones / checklist / estimacion
- Loading: centered spinner
- Error: AlertCircle + retry button
- Exports all result interfaces: `OgucResult`, `ObservacionesResult`, `ChecklistResult`, `EstimacionResult`, `CopilotoResult`

### `components/copiloto/tabs/tab-oguc.tsx`
- Renders OGUC articulos with CheckCircle2/XCircle/Minus icons
- Formula, valor normativo, valor proyecto in 2-col grid
- Amber warning block when `observacion` is present

### `components/copiloto/tabs/tab-observaciones.tsx`
- Risk badge (BAJO/MEDIO/ALTO) with color coding
- Each prediction: categoria + frecuencia dot + trigger + accion preventiva

### `components/copiloto/tabs/tab-checklist.tsx`
- Progress bar: X de Y documentos listos
- Optimistic toggle: updates parent state immediately, reverts on PATCH error
- Row styling: green background when `estado === 'ok'`, strikethrough on nombre
- Only shows `descripcion` when not done (reduces noise)
- Obligatorio badge

### `components/copiloto/tabs/tab-estimacion.tsx`
- Plazo card: min-max días hábiles + semanas calendar conversion
- Derechos card: CLP + UF + detalle lines
- Advertencias block (amber)
- Recomendación block (primary)
