-- Fase 2 de la fusión PROPRA·BI → PermisoHub: feed de noticias inmobiliarias
-- (RSS América Retail, Hechos Esenciales CMF, prensa IR Parque Arauco).
-- Dataset global, sin workspace_id — mismo patrón de RLS de solo-lectura ya
-- usado por mercado_locales_listings (20260802_mercado_locales_listings.sql)
-- y zonificacion_cache.
--
-- Divergencia deliberada del origen (news_items en Drizzle): en vez de un
-- solo array jsonb "tags" mezclando nombres de comuna y palabras clave de
-- tipo de propiedad sin columna discriminadora, acá van dos columnas text[]
-- nativas — el filtro de la UI ya no depende de adivinar qué tipo de valor
-- es cada tag.

CREATE TABLE IF NOT EXISTS noticias_mercado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  fuente text NOT NULL,              -- 'CMF' | 'Parque Arauco (IR)' | nombre del canal RSS
  fuente_tipo text NOT NULL,         -- 'rss' | 'scrape'
  url text NOT NULL UNIQUE,          -- dedup key

  titulo text NOT NULL,
  resumen text,
  publicado_el timestamptz,

  comunas text[] NOT NULL DEFAULT '{}',
  tipos_propiedad text[] NOT NULL DEFAULT '{}',

  ingerido_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE noticias_mercado
  ADD CONSTRAINT noticias_mercado_fuente_tipo_check
  CHECK (fuente_tipo IN ('rss', 'scrape'));

ALTER TABLE noticias_mercado
  ADD CONSTRAINT noticias_mercado_tipos_propiedad_check
  CHECK (tipos_propiedad <@ ARRAY['retail','oficina','bodega','industrial']::text[]);

CREATE INDEX IF NOT EXISTS idx_noticias_mercado_comunas ON noticias_mercado USING GIN (comunas);
CREATE INDEX IF NOT EXISTS idx_noticias_mercado_tipos ON noticias_mercado USING GIN (tipos_propiedad);
CREATE INDEX IF NOT EXISTS idx_noticias_mercado_publicado ON noticias_mercado (publicado_el DESC NULLS LAST);

ALTER TABLE noticias_mercado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noticias_mercado_read" ON noticias_mercado
  FOR SELECT TO authenticated USING (true);
-- Sin política de INSERT/UPDATE para authenticated — escrituras solo vía
-- createServiceClient() desde app/api/cron/noticias-macro.
