-- Columnas que la app ya escribía/leía (app/api/proyectos/[id]/route.ts
-- PatchProyectoBody, app/(dashboard)/permisos/page.tsx, patentes/page.tsx)
-- pero que nunca existieron en `proyectos` (auditoría 2026-08-02, grep
-- confirmó 0 hits en las migraciones aplicadas). Todo PATCH que tocara
-- alguno de estos campos fallaba con PGRST204/42703 — un 500 que las
-- páginas de Permisos/Patentes no revisaban (`res.ok` nunca chequeado),
-- así que el usuario veía "guardado" sobre un write que nunca ocurrió.
alter table proyectos add column if not exists numero_permiso text;
alter table proyectos add column if not exists fecha_otorgamiento date;
alter table proyectos add column if not exists fecha_vencimiento_permiso date;
alter table proyectos add column if not exists numero_patente text;
alter table proyectos add column if not exists giro_sii text;
alter table proyectos add column if not exists año_ejercicio integer;
alter table proyectos add column if not exists valor_derechos numeric;
alter table proyectos add column if not exists fecha_pago_derechos date;
