-- Fase 8: generaliza calcular_bandas_mercado_locales() para aceptar
-- tipo_propiedad (antes hardcodeado a 'local_comercial') — necesario para
-- computar bandas de oficina/bodega/industrial sin duplicar la función.
-- p_tipo_propiedad tiene DEFAULT 'local_comercial' — todo caller existente
-- (el cron diario original) sigue funcionando idéntico sin pasar el 4to arg.

DROP FUNCTION IF EXISTS public.calcular_bandas_mercado_locales(text, text, numeric);

CREATE FUNCTION public.calcular_bandas_mercado_locales(
  p_comuna text,        -- NULL = rollup metropolitano (todas las comunas)
  p_operacion text,
  p_uf_valor numeric,
  p_tipo_propiedad text DEFAULT 'local_comercial'
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
    WHERE status = 'activo' AND operacion = p_operacion AND tipo_propiedad = p_tipo_propiedad
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
