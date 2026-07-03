-- Persistencia de las observaciones marcadas sobre los planos del due diligence.
-- Guarda solo el JSON de anotaciones por (proyecto, documento, página); la imagen
-- se re-rasteriza del PDF en el cliente al recargar (no se almacena).

create table if not exists planos_anotaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  documento_id uuid not null references documentos(id) on delete cascade,
  pagina int not null default 0,
  anotaciones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, documento_id, pagina)
);

create index if not exists planos_anotaciones_proyecto_idx
  on planos_anotaciones (proyecto_id);

alter table planos_anotaciones enable row level security;

drop policy if exists planos_anotaciones_own on planos_anotaciones;
create policy planos_anotaciones_own on planos_anotaciones
  for all
  using (
    exists (
      select 1 from proyectos p
      where p.id = planos_anotaciones.proyecto_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from proyectos p
      where p.id = planos_anotaciones.proyecto_id and p.user_id = auth.uid()
    )
  );
