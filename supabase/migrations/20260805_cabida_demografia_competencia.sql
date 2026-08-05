-- Fase 17/18 sobre el motor de cabida comercial: la migración ADITIVA que
-- 20260809_cabida_comercial_cache.sql dejó anticipada ("Fase 17/18 agregarán
-- demografia_*/competencia_* vía migración ADITIVA").
--
-- DECISIÓN DE CLAVE (04-08): NO todo va en la misma tabla.
--   · isócrona y población dependen de (lat, lng, modo, minutos) — NO del
--     formato comercial: la población dentro de un polígono es la misma sea
--     que evalúes un supermercado o un minimarket. Van en cabida_comercial_cache,
--     que ya tiene exactamente esa clave única.
--   · competencia y gap_score SÍ dependen del formato (los competidores de un
--     supermercado no son los de un strip center). Meterlos en la misma tabla
--     los haría colisionar: dos formatos en la misma ubicación se pisarían en
--     el upsert. Es el MISMO bug que se corrigió el 04-08 en
--     mercado_locales_listings, donde el índice único era (fuente, fuente_id)
--     sin tipo_propiedad y un aviso listado en dos categorías se sobreescribía
--     a sí mismo. Por eso van en tabla propia con clave (cache_id, formato).

-- ── Población (Fase 17) — misma clave que la isócrona, va en la tabla existente
ALTER TABLE cabida_comercial_cache
  ADD COLUMN IF NOT EXISTS poblacion_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS poblacion_personas integer,
  ADD COLUMN IF NOT EXISTS poblacion_viviendas integer,
  ADD COLUMN IF NOT EXISTS poblacion_manzanas integer,
  ADD COLUMN IF NOT EXISTS poblacion_consultada_el timestamptz;

ALTER TABLE cabida_comercial_cache
  DROP CONSTRAINT IF EXISTS cabida_comercial_cache_poblacion_status_check;
ALTER TABLE cabida_comercial_cache
  ADD CONSTRAINT cabida_comercial_cache_poblacion_status_check
  CHECK (poblacion_status IN ('pendiente', 'encontrado', 'error'));

-- ── Competencia por formato (Fase 18) — clave (cache_id, formato)
CREATE TABLE IF NOT EXISTS cabida_comercial_competencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_id uuid NOT NULL REFERENCES cabida_comercial_cache(id) ON DELETE CASCADE,
  formato text NOT NULL,

  competidores_n integer NOT NULL,
  confianza_global text NOT NULL,
  cobertura_conocida boolean NOT NULL,
  disclosure text NOT NULL,

  -- Competidores por cada 1.000 habitantes dentro de la isócrona. Es un proxy
  -- de DENSIDAD, nunca un cálculo de fuga de gasto ni de superávit real
  -- (VERE-04 en lib/veredicto-cabida.ts). NULL cuando la población no es
  -- utilizable — nunca 0, que significaría "densidad cero" y es otra cosa.
  gap_score numeric,

  consultado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cabida_competencia_cache_formato
  ON cabida_comercial_competencia (cache_id, formato);

-- Los percentiles p33/p66 se calculan por formato sobre gap_score — este
-- índice es el que sirve esa consulta.
CREATE INDEX IF NOT EXISTS idx_cabida_competencia_formato_gap
  ON cabida_comercial_competencia (formato, gap_score)
  WHERE gap_score IS NOT NULL;

ALTER TABLE cabida_comercial_competencia
  ADD CONSTRAINT cabida_competencia_formato_check
  CHECK (formato IN ('supermercado', 'minimarket', 'strip_center', 'power_center'));

ALTER TABLE cabida_comercial_competencia
  ADD CONSTRAINT cabida_competencia_confianza_check
  CHECK (confianza_global IN ('alta', 'media', 'baja'));

ALTER TABLE cabida_comercial_competencia ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que cabida_comercial_cache: lectura para autenticados,
-- escritura solo vía service role.
CREATE POLICY "cabida_comercial_competencia_read" ON cabida_comercial_competencia
  FOR SELECT TO authenticated USING (true);
