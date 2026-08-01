-- Fase 9 de la fusión PROPRA·BI → PermisoHub (área nueva, fuera de la
-- numeración de mercado_locales): estado legal real de Instrumentos de
-- Planificación Territorial (Planes Reguladores y sus modificaciones/
-- seccionales), sincronizado desde la API pública de Portal IPT (MINVU),
-- relanzado ago. 2025 por mandato del Art. 28 undecies LGUC.
--
-- Distinto de zonificacion_cache (esa es lat/lng → zona/uso de suelo vía
-- ArcGIS; esta tabla es comuna → estado legal del instrumento en sí,
-- vigente/en trámite/derogado/desistido, con enlaces a los documentos
-- oficiales). Dataset global, sin workspace_id — mismo patrón de RLS de
-- solo lectura que mercado_locales_*/plan_reguladores.

create table if not exists instrumentos_ipt (
  id uuid primary key default gen_random_uuid(),

  ipt_id integer not null,              -- id propio de Portal IPT (estable, ver /instrumentos)
  codigo integer,
  denominacion text not null,
  planificacion text,                   -- 'Intercomunal' | 'Comunal' | 'Regional'
  tipo text,                            -- 'PRM', 'PRC', etc.
  region text,
  comunas text[] not null default '{}', -- códigos INE de las comunas que cubre
  clasificacion text,                   -- 'Instrumento de origen' | 'Modificación'
  estado text not null,                 -- 'Vigente' | 'En Desarrollo' | 'Derogado' | 'Desistido'
  fecha_inicio_vigencia date,
  numero_documento text,
  documentos jsonb not null default '[]', -- [{url, tipo, nombre}] — enlaces oficiales MINVU

  fuente_actualizada_el timestamptz,    -- updatedAt reportado por Portal IPT
  sincronizado_el timestamptz not null default now()
);

create unique index if not exists idx_instrumentos_ipt_ipt_id on instrumentos_ipt (ipt_id);
create index if not exists idx_instrumentos_ipt_comunas on instrumentos_ipt using gin (comunas);
create index if not exists idx_instrumentos_ipt_estado on instrumentos_ipt (estado);

alter table instrumentos_ipt enable row level security;

create policy "instrumentos_ipt_read" on instrumentos_ipt
  for select to authenticated using (true);
-- Sin política de insert/update: las escrituras son solo vía service role (cron).
