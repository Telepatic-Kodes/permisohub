-- Fix de seguridad real (auditoría 2026-08-02): observaciones_dom_workspace y
-- dd_reports_workspace (20260731_workspace_compartir.sql) usan una sola
-- policy FOR ALL con WITH CHECK
--   (EXISTS (... proyecto pertenece al workspace/dueño ...) OR user_id = auth.uid())
-- El OR final es un escape hatch pensado para preservar acceso a filas
-- legacy propias, pero en un INSERT el caller controla `user_id` (lo pone
-- igual a su propio auth.uid() en el insert) — así que la condición
-- `user_id = auth.uid()` es SIEMPRE verdadera para cualquier fila que
-- alguien inserte como sí mismo, sin importar a qué proyecto apunte
-- proyecto_id. Cualquier usuario autenticado podía insertar una
-- observación DOM (o un reporte de due diligence) en el expediente de
-- OTRO usuario/workspace.
--
-- Fix: separar en policies por comando. INSERT ya no lleva el escape
-- hatch (WITH CHECK exige el EXISTS real). SELECT/UPDATE/DELETE lo
-- conservan vía USING (para no romper acceso a filas legacy propias cuyo
-- proyecto ya no resuelva), pero UPDATE también pierde el escape hatch en
-- su propio WITH CHECK (gobierna la forma de la fila DESPUÉS del update).

drop policy if exists observaciones_dom_workspace on observaciones_dom;

create policy observaciones_dom_select on observaciones_dom for select
  using (
    exists (select 1 from proyectos p where p.id = observaciones_dom.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
    or user_id = auth.uid()
  );

create policy observaciones_dom_insert on observaciones_dom for insert
  with check (
    exists (select 1 from proyectos p where p.id = observaciones_dom.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
  );

create policy observaciones_dom_update on observaciones_dom for update
  using (
    exists (select 1 from proyectos p where p.id = observaciones_dom.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
    or user_id = auth.uid()
  )
  with check (
    exists (select 1 from proyectos p where p.id = observaciones_dom.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
  );

create policy observaciones_dom_delete on observaciones_dom for delete
  using (
    exists (select 1 from proyectos p where p.id = observaciones_dom.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
    or user_id = auth.uid()
  );

drop policy if exists dd_reports_workspace on due_diligence_reports;

create policy dd_reports_select on due_diligence_reports for select
  using (
    exists (select 1 from proyectos p where p.id = due_diligence_reports.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
    or user_id = auth.uid()
  );

create policy dd_reports_insert on due_diligence_reports for insert
  with check (
    exists (select 1 from proyectos p where p.id = due_diligence_reports.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
  );

create policy dd_reports_update on due_diligence_reports for update
  using (
    exists (select 1 from proyectos p where p.id = due_diligence_reports.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
    or user_id = auth.uid()
  )
  with check (
    exists (select 1 from proyectos p where p.id = due_diligence_reports.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
  );

create policy dd_reports_delete on due_diligence_reports for delete
  using (
    exists (select 1 from proyectos p where p.id = due_diligence_reports.proyecto_id
            and (es_miembro(p.workspace_id) or p.user_id = auth.uid()))
    or user_id = auth.uid()
  );
