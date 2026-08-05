-- Health check de fuentes externas — extiende data_source_runs para que
-- pueda registrar chequeos sintéticos, no solo corridas de ingesta.
--
-- Por qué hace falta: recordSourceRun() cubría solo fuentes PULL (un cron
-- sale a buscar datos y deja una fila ok/error). Las fuentes de LECTURA que
-- están en el camino crítico del request del usuario — Valhalla (isócronas),
-- el FeatureServer del Censo 2017, Overpass, Nominatim — no dejaban ninguna
-- fila: se invocan dentro de la request, y su degradación se reparte como
-- latencia entre usuarios reales. El 05-08 se midió que la ficha de terreno
-- tardaba 10,4 s por esa vía, y el único detector fue un test que falló por
-- timeout.
--
-- Efecto secundario del caché que se agregó ese mismo día
-- (cabida_comercial_cache): baja la exposición, pero también deja de generar
-- muestras naturales de disponibilidad. Mientras más alto el hit rate, más
-- ciega queda la señal — de ahí que el probe sintético pase de lujo a única
-- fuente de esa medición.

-- Latencia medida de la corrida/probe.
-- NULL ≠ 0: null es "no se midió", 0 sería "se midió y dio cero". Las
-- corridas históricas de scrapers (anteriores a esta migración) quedan en
-- null a propósito — no se les puede inventar una latencia hacia atrás.
alter table data_source_runs
  add column if not exists duration_ms integer;

-- 'run'   = corrida de ingesta real (scraper/cron que trae datos).
-- 'probe' = chequeo sintético de disponibilidad; NO ingiere nada.
--
-- Separados a propósito: un probe en verde no dice absolutamente nada sobre
-- si la ingesta está al día, y una ingesta al día no dice nada sobre si el
-- servicio responde ahora. Colapsar ambos en una sola columna "estado" haría
-- que la página mostrara el probe de hoy como si fuera la última corrida de
-- un scraper semanal.
alter table data_source_runs
  add column if not exists kind text not null default 'run';

-- Resumen de lo que el probe AFIRMÓ, en éxito y en fallo por igual
-- ("53 manzanas, 19.266 personas", "valhalla, 20 vértices").
--
-- Columna aparte de error_message a propósito: error_message significa "algo
-- falló", y meter ahí el detalle de una corrida sana haría que la página
-- pinte texto de error sobre filas verdes. Además el valor real de guardarlo
-- en éxito es detectar DERIVA SILENCIOSA: el día que el censo pase de 53
-- manzanas a 3, el probe sigue en verde pero la fuente cambió abajo — y sin
-- esta serie no hay forma de notarlo.
alter table data_source_runs
  add column if not exists detail text;

alter table data_source_runs
  drop constraint if exists data_source_runs_kind_check;
alter table data_source_runs
  add constraint data_source_runs_kind_check check (kind in ('run', 'probe'));

-- El índice existente (source_id, ran_at desc) sirve para "últimas N de esta
-- fuente"; este cubre el patrón del health check: "últimos probes de esta
-- fuente", sin que las corridas de ingesta (mucho más numerosas por fuente
-- en algunos casos) diluyan el rango escaneado.
create index if not exists idx_data_source_runs_kind_source_ran_at
  on data_source_runs (kind, source_id, ran_at desc);

comment on column data_source_runs.duration_ms is
  'Latencia medida en ms. NULL = no medida (nunca 0 por defecto).';
comment on column data_source_runs.kind is
  'run = ingesta real | probe = chequeo sintético de disponibilidad.';
comment on column data_source_runs.detail is
  'Qué afirmó el probe, en éxito y en fallo. NO es error_message.';
