-- Torre de Control — checkpoint B: salud mínima de fuentes de datos.
--
-- Registra cada corrida de scraper/cron (ok/error/row_count), para cerrar el
-- hueco real encontrado en la auditoría de datos: solo los 3 cron routes
-- reportaban a Sentry, los scrapers de lib/scrapers/* solo hacían
-- console.warn — un scraper roto podía fallar en silencio indefinidamente.
-- `source_id` coincide con el `id` de cada entrada en
-- .planning/data-sources.yaml (no hay FK real porque ese registro vive en un
-- YAML versionado con git, no en la base de datos).
--
-- Deliberadamente mínima: sin retención, sin agregados, sin alertas — una
-- migración y una página (app/(admin)/admin/salud-datos/page.tsx), no un
-- proyecto de observabilidad completo.

create table if not exists data_source_runs (
  id bigint generated always as identity primary key,

  source_id text not null,       -- coincide con el id en .planning/data-sources.yaml
  status text not null,          -- 'ok' | 'error'
  row_count integer,
  error_message text,

  ran_at timestamptz not null default now()
);

create index if not exists idx_data_source_runs_source_ran_at
  on data_source_runs (source_id, ran_at desc);

alter table data_source_runs enable row level security;

create policy "data_source_runs_read" on data_source_runs
  for select to authenticated using (true);
-- Sin política de insert/update: las escrituras son solo vía service role
-- (recordSourceRun() en lib/observability.ts, llamado desde cron/scrapers).
