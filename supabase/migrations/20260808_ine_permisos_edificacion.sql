-- Permisos de edificación históricos del INE (servicio oficial CRF_PE_AGOL,
-- capa PE_NACIONAL), agregados por comuna/año/uso_destino vía la API de
-- estadísticas de ArcGIS — no se guardan los ~135k puntos individuales,
-- solo el agregado que necesitamos para dar contexto de actividad
-- constructiva histórica. Cobertura real: 2010-2022 (INE no ha publicado
-- años más recientes en este servicio) — ver lib/scrapers/ine-permisos-edificacion.ts.
create table ine_permisos_edificacion (
  id bigint generated always as identity primary key,
  comuna text not null,
  -- Precalculada en la ingesta (mayúsculas sin acentos, ver
  -- normalizarNombreComuna() en lib/scrapers/instrumentos-ipt.ts). Filtrar
  -- por esta columna en vez de traer todas las filas y comparar en cliente:
  -- el cap server-side de PostgREST (max-rows) no se puede levantar con un
  -- `.limit()` del cliente, y ni un SELECT de comunas distintas escapa de
  -- ese cap con 4.243 filas totales — bug real encontrado al verificar en
  -- vivo (Providencia, alfabéticamente tardía, quedaba fuera del corte).
  comuna_normalizada text not null,
  anio smallint not null,
  uso_destino text not null, -- 'HABITACIONAL' | 'NO HABITACIONAL' | 'MIXTO'
  n_permisos integer not null,
  superficie_total_m2 double precision not null,
  unidades_total integer not null,
  actualizado_el timestamptz not null default now()
);

create unique index ine_permisos_edificacion_dedup on ine_permisos_edificacion (comuna, anio, uso_destino);
create index ine_permisos_edificacion_comuna_normalizada_idx on ine_permisos_edificacion (comuna_normalizada);

alter table ine_permisos_edificacion enable row level security;

create policy ine_permisos_edificacion_read on ine_permisos_edificacion
  for select to authenticated using (true);
