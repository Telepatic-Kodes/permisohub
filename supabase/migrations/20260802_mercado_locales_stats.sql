-- Fase 1 de la fusión PROPRA·BI → PermisoHub: bandas de precio P25/mediana/P75
-- por comuna×operación, recalculadas a diario a partir de
-- mercado_locales_listings (20260802_mercado_locales_listings.sql). Mismo
-- dataset global sin workspace_id, mismo patrón de RLS de solo-lectura.

CREATE TABLE IF NOT EXISTS mercado_locales_stats_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  stats_date date NOT NULL,
  capturado_el timestamptz NOT NULL DEFAULT now(),

  comuna text NOT NULL,                 -- comuna real, o '__TODAS__' para el rollup metropolitano
  tipo_propiedad text NOT NULL DEFAULT 'local_comercial',
  operacion text NOT NULL,              -- 'arriendo' | 'venta'

  muestra_n integer NOT NULL,
  mediana_uf numeric(14,2),
  p25_uf numeric(14,2),
  p75_uf numeric(14,2),

  muestra_area_n integer NOT NULL DEFAULT 0,
  mediana_uf_m2 numeric(10,4),
  p25_uf_m2 numeric(10,4),
  p75_uf_m2 numeric(10,4),

  uf_valor_usado numeric(10,2) NOT NULL
);

ALTER TABLE mercado_locales_stats_diarias
  ADD CONSTRAINT mercado_locales_stats_operacion_check
  CHECK (operacion IN ('arriendo', 'venta'));

-- '__TODAS__' como sentinel en vez de NULL: un índice único trata cada NULL
-- como distinto de los demás, así que un comuna=NULL no bloquearía filas
-- duplicadas del rollup citywide en el mismo día — se necesita un valor real.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_locales_stats_cohort_dia
  ON mercado_locales_stats_diarias (stats_date, comuna, tipo_propiedad, operacion);

ALTER TABLE mercado_locales_stats_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercado_locales_stats_diarias_read" ON mercado_locales_stats_diarias
  FOR SELECT TO authenticated USING (true);

-- @supabase/supabase-js no tiene un equivalente a db.execute(sql`...`) de
-- Drizzle para correr percentile_cont inline — el cálculo vive como función
-- de Postgres, llamada vía supabase.rpc(), mismo patrón que match_normativa()
-- en 20260702_normativa_embeddings.sql.
CREATE OR REPLACE FUNCTION public.calcular_bandas_mercado_locales(
  p_comuna text,        -- NULL = rollup metropolitano (todas las comunas)
  p_operacion text,
  p_uf_valor numeric
)
RETURNS TABLE (
  muestra_n bigint,
  mediana_uf double precision,
  p25_uf double precision,
  p75_uf double precision,
  muestra_area_n bigint,
  mediana_uf_m2 double precision,
  p25_uf_m2 double precision,
  p75_uf_m2 double precision
)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT
      CASE WHEN precio_moneda = 'UF' THEN precio_monto::float8
           ELSE precio_monto::float8 / p_uf_valor END AS precio_uf,
      superficie_m2::float8 AS superficie_m2
    FROM mercado_locales_listings
    WHERE status = 'activo' AND operacion = p_operacion AND tipo_propiedad = 'local_comercial'
      AND precio_monto IS NOT NULL AND precio_moneda IN ('UF', 'CLP')
      AND (p_comuna IS NULL OR comuna = p_comuna)
  ),
  withm2 AS (
    SELECT precio_uf, precio_uf / superficie_m2 AS precio_uf_m2
    FROM base WHERE superficie_m2 IS NOT NULL AND superficie_m2 > 0
  )
  SELECT
    (SELECT count(*) FROM base),
    (SELECT percentile_cont(0.5)  WITHIN GROUP (ORDER BY precio_uf) FROM base),
    (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY precio_uf) FROM base),
    (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY precio_uf) FROM base),
    (SELECT count(*) FROM withm2),
    (SELECT percentile_cont(0.5)  WITHIN GROUP (ORDER BY precio_uf_m2) FROM withm2),
    (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY precio_uf_m2) FROM withm2),
    (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY precio_uf_m2) FROM withm2);
$$;
