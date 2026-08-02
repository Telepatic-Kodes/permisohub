-- Checklist de vencimientos regulatorios — gap identificado en la
-- investigación de mercado del 1 ago 2026 para administradores/fondos: el
-- portafolio ya compara precio vs. mercado y avisa vencimiento de contrato,
-- pero no existe ningún seguimiento de las obligaciones regulatorias
-- RECURRENTES de un edificio ya en operación (distinto del checklist de
-- expediente del Copiloto, que es para permisos en trámite). El catálogo de
-- obligaciones vive en código (lib/obligaciones-regulatorias.ts, mismo
-- patrón que TIPO_PROPIEDAD_LABEL) — esta tabla solo guarda, por propiedad,
-- cuándo se cumplió por última vez cada una.
alter table propiedades_portafolio add column if not exists tiene_ascensor boolean not null default false;
alter table propiedades_portafolio add column if not exists tiene_gas boolean not null default false;

create table if not exists propiedad_obligaciones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  propiedad_id uuid not null references propiedades_portafolio(id) on delete cascade,

  -- slug del catálogo estático en lib/obligaciones-regulatorias.ts — no hay
  -- FK porque el catálogo no vive en la base de datos.
  obligacion_slug text not null,
  fecha_ultimo_cumplimiento date,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (propiedad_id, obligacion_slug)
);

create index if not exists idx_propiedad_obligaciones_propiedad on propiedad_obligaciones (propiedad_id);
create index if not exists idx_propiedad_obligaciones_workspace on propiedad_obligaciones (workspace_id);

alter table propiedad_obligaciones enable row level security;

create policy propiedad_obligaciones_workspace on propiedad_obligaciones for all
  using (es_miembro(workspace_id)) with check (es_miembro(workspace_id));
