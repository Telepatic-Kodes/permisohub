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

drop policy if exists "via_tramitacion owner" on via_tramitacion;
create policy "via_tramitacion owner" on via_tramitacion
  for all
  using (
    exists (
      select 1 from proyectos p
      where p.id = via_tramitacion.proyecto_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from proyectos p
      where p.id = via_tramitacion.proyecto_id and p.user_id = auth.uid()
    )
  );
