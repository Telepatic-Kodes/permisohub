-- Vía de tramitación guiada por proyecto (flujo PlanX-lite).
-- Un registro por proyecto. Las `respuestas` son el árbol de decisión contestado
-- (Partial<RespuestasVia>); `resultado` es la ViaRecomendada guardada al terminar.
-- El ruteo es determinista (recomendarVia); esto solo persiste lo elegido.

create table if not exists via_tramitacion (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  respuestas jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id)
);

alter table via_tramitacion enable row level security;

-- RLS actualizada el 06-08, antes de correrla por primera vez.
--
-- Esta migración se escribió el 05-07 y nunca se aplicó; el 31-07
-- (20260731_workspace_compartir.sql) el modelo de permisos pasó de "dueño" a
-- "workspace", y ese refactor retrofiteó las políticas de todas las tablas que
-- EXISTÍAN. Como via_tramitacion no existía, quedó congelada con el modelo
-- viejo: `p.user_id = auth.uid()` a secas.
--
-- Correrla así habría creado la única tabla del expediente donde los miembros
-- de un workspace compartido NO ven los datos de sus propios proyectos —
-- silencioso, y justo en la feature colaborativa. Se alinea con el patrón que
-- usan documentos, etapas, comunicaciones y cuadros_calculo.
--
-- La lección, por si aparece otra migración vieja sin correr: una migración
-- pendiente no solo se atrasa, se desactualiza.
drop policy if exists "via_tramitacion owner" on via_tramitacion;
drop policy if exists via_tramitacion_workspace on via_tramitacion;
create policy via_tramitacion_workspace on via_tramitacion
  for all
  using (
    exists (
      select 1 from proyectos p
      where p.id = via_tramitacion.proyecto_id
        and (es_miembro(p.workspace_id) or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from proyectos p
      where p.id = via_tramitacion.proyecto_id
        and (es_miembro(p.workspace_id) or p.user_id = auth.uid())
    )
  );
