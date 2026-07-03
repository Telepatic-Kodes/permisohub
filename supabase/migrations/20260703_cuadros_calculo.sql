-- Cuadros de cálculo normativo por proyecto (superficies + comparación PRC).
-- Un cuadro por proyecto. El cálculo es determinista en el cliente/servidor;
-- aquí solo se persisten los datos de entrada (CuadroInput) como jsonb.

create table if not exists cuadros_calculo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id)
);

alter table cuadros_calculo enable row level security;

drop policy if exists "cuadros_calculo owner" on cuadros_calculo;
create policy "cuadros_calculo owner" on cuadros_calculo
  for all
  using (
    exists (
      select 1 from proyectos p
      where p.id = cuadros_calculo.proyecto_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from proyectos p
      where p.id = cuadros_calculo.proyecto_id and p.user_id = auth.uid()
    )
  );
