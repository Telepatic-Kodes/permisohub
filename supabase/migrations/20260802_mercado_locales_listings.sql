-- Fase 1 de la fusión PROPRA·BI → PermisoHub (mercado de locales comerciales):
-- a diferencia de `terrenos` (20260801_terrenos.sql), que es un watchlist por
-- workspace, esta es data de mercado — un solo dataset global, igual para
-- cualquier usuario autenticado. Mismo patrón de RLS de solo-lectura ya usado
-- por `zonificacion_cache` (20260730_zonificacion.sql): sin política de
-- INSERT/UPDATE para `authenticated`, las escrituras solo llegan vía
-- createServiceClient() desde el scraper (app/api/scraper/mercado-locales).
--
-- No usar el nombre `locales` — esa tabla ya existe (unidades arrendadas bajo
-- centros_comerciales/cadenas, un CRM de portafolio, dominio no relacionado).
-- Estos son avisos de terceros scrapeados de portales, no unidades propias.

CREATE TABLE IF NOT EXISTS mercado_locales_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  fuente text NOT NULL,                    -- 'portalinmobiliario' (única fuente en fase 1)
  fuente_id text NOT NULL,                 -- id del aviso en el portal, ej. 'MLC-3867428724'
  url text NOT NULL,
  titulo text NOT NULL,

  operacion text NOT NULL,                 -- 'arriendo' | 'venta'
  tipo_propiedad text NOT NULL DEFAULT 'local_comercial',
  comuna text NOT NULL,

  precio_monto numeric(14,2),
  precio_moneda text,                      -- 'UF' | 'CLP' — normalizado al parsear, no el símbolo crudo del portal
  superficie_m2 numeric(10,2),
  atributos_raw jsonb NOT NULL DEFAULT '{}',

  status text NOT NULL DEFAULT 'activo',   -- 'activo' | 'dado_de_baja'

  primera_vez_visto_el timestamptz NOT NULL DEFAULT now(),
  ultima_vez_visto_el timestamptz NOT NULL DEFAULT now(),
  dado_de_baja_el timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mercado_locales_listings
  ADD CONSTRAINT mercado_locales_listings_fuente_check
  CHECK (fuente IN ('portalinmobiliario'));

ALTER TABLE mercado_locales_listings
  ADD CONSTRAINT mercado_locales_listings_operacion_check
  CHECK (operacion IN ('arriendo', 'venta'));

ALTER TABLE mercado_locales_listings
  ADD CONSTRAINT mercado_locales_listings_status_check
  CHECK (status IN ('activo', 'dado_de_baja'));

ALTER TABLE mercado_locales_listings
  ADD CONSTRAINT mercado_locales_listings_moneda_check
  CHECK (precio_moneda IS NULL OR precio_moneda IN ('UF', 'CLP'));

-- Índice único SIN predicado: el upsert del scraper usa
-- `.upsert(..., { onConflict: 'fuente,fuente_id' })`, y Postgres no puede
-- inferir un índice único parcial desde una cláusula ON CONFLICT que solo
-- nombra columnas (misma lección que 20260801_terrenos_url_aviso_fix.sql).
CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_locales_listings_fuente_id
  ON mercado_locales_listings (fuente, fuente_id);

CREATE INDEX IF NOT EXISTS idx_mercado_locales_listings_comuna_op
  ON mercado_locales_listings (comuna, operacion) WHERE status = 'activo';

ALTER TABLE mercado_locales_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercado_locales_listings_read" ON mercado_locales_listings
  FOR SELECT TO authenticated USING (true);

-- ── Historial de precio ──────────────────────────────────────────────────
-- A diferencia de `terrenos` (que solo guarda el precio anterior en una
-- columna, 20260801_terrenos_oportunidades.sql), acá necesitamos el
-- historial completo: la detección de oportunidades por "bajó de precio en
-- los últimos 7 días" requiere poder mirar más de un salto hacia atrás.
CREATE TABLE IF NOT EXISTS mercado_locales_historial_precio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES mercado_locales_listings(id) ON DELETE CASCADE,
  precio_monto numeric(14,2) NOT NULL,
  precio_moneda text NOT NULL,
  capturado_el timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mercado_locales_historial_listing
  ON mercado_locales_historial_precio (listing_id, capturado_el);

ALTER TABLE mercado_locales_historial_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercado_locales_historial_precio_read" ON mercado_locales_historial_precio
  FOR SELECT TO authenticated USING (true);

-- Trigger, no código de aplicación: mismo motivo que
-- registrar_historial_precio_terreno() (20260801_terrenos_oportunidades.sql)
-- — así ningún scraper nuevo puede "olvidar" registrar el cambio de precio.
-- Se dispara en el primer INSERT (precio inicial) y en cada UPDATE donde el
-- precio realmente cambió.
CREATE OR REPLACE FUNCTION public.registrar_historial_precio_mercado_local()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.precio_monto IS NOT NULL THEN
    INSERT INTO mercado_locales_historial_precio (listing_id, precio_monto, precio_moneda)
    VALUES (NEW.id, NEW.precio_monto, NEW.precio_moneda);
  ELSIF TG_OP = 'UPDATE' AND NEW.precio_monto IS NOT NULL
        AND (NEW.precio_monto IS DISTINCT FROM OLD.precio_monto
             OR NEW.precio_moneda IS DISTINCT FROM OLD.precio_moneda) THEN
    INSERT INTO mercado_locales_historial_precio (listing_id, precio_monto, precio_moneda)
    VALUES (NEW.id, NEW.precio_monto, NEW.precio_moneda);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_historial_precio_mercado_local ON mercado_locales_listings;
CREATE TRIGGER trg_registrar_historial_precio_mercado_local
  AFTER INSERT OR UPDATE ON mercado_locales_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historial_precio_mercado_local();
