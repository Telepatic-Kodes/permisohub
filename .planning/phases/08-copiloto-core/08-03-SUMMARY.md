# Phase 08-03 SUMMARY — Page Wiring

## Status: COMPLETE ✅

## Pattern applied: shared drawer + per-row trigger

Each page adds:
1. `CopilotoProyecto` type alias for `Pick<Proyecto, 'id'|'nombre'|'municipio'|'tipo'|'estado'>`
2. `copilotoProyecto` state (nullable) + `copilotoOpen` boolean
3. `handleCopiloto()` function that sets both states
4. `<CopilotoTrigger>` per row/header calling `handleCopiloto`
5. `<CopilotoDrawer>` at page level (single instance shared across all rows)

## Files modified

### `app/(dashboard)/permisos/page.tsx`
- Added `CopilotoTrigger` + `CopilotoDrawer` imports
- Trigger placed in actions cell alongside `RegistrarPermisoDialog`
- Drawer at bottom of page JSX

### `app/(dashboard)/patentes/page.tsx`
- Added `CopilotoTrigger` + `CopilotoDrawer` imports
- Trigger placed in actions cell alongside existing buttons
- Drawer at bottom of page JSX

### `app/(dashboard)/proyectos/[id]/page.tsx`
- Added `CopilotoTrigger` + `CopilotoDrawer` imports
- Trigger placed in PageHeader `action` div (last item)
- Drawer at bottom of page JSX, project is `proyecto` (full Proyecto object)

## TypeScript check
`npx tsc --noEmit` → 0 errors
