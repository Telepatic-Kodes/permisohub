-- Expansión de cadenas comerciales — señal de nuevas sucursales derivada de
-- la nómina nacional de direcciones del SII (ver lib/scrapers/sii-nomina-sucursales.ts
-- y .planning/data-sources.yaml). Fuente elegida tras descartar patente
-- comercial municipal (fragmentada en ~345 sistemas sin API) y scraping de
-- buscadores de tiendas (JS/mapa, frágil, requiere ingeniería por sitio).
--
-- Dataset global, sin workspace_id — mismo patrón de RLS de solo lectura que
-- mercado_locales_listings/instrumentos_ipt.
--
-- Clave natural (rut, calle, numero, comuna) en vez de un id externo: el SII
-- no expone un id estable por dirección, así que upserteamos por dirección
-- física. calle/numero/comuna son NOT NULL DEFAULT '' (no NULL) para que el
-- índice único funcione de forma confiable en el upsert mensual (Postgres
-- trata NULL como distinto de NULL, lo que rompería el ON CONFLICT).

CREATE TABLE IF NOT EXISTS cadenas_sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  rut text NOT NULL,
  dv text NOT NULL,
  cadena text NOT NULL,                  -- label de CADENAS_RUT_CONOCIDOS, no la razón social cruda del SII

  vigente boolean NOT NULL DEFAULT true, -- VIGENCIA = 'S' en el archivo del SII
  fecha_registro date,                   -- FECHA del SII — cuándo se registró esta dirección

  calle text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  comuna text NOT NULL DEFAULT '',
  region text,

  primera_vez_visto_el timestamptz NOT NULL DEFAULT now(),
  ultima_vez_visto_el timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cadenas_sucursales_natural_key
  ON cadenas_sucursales (rut, calle, numero, comuna);

CREATE INDEX IF NOT EXISTS idx_cadenas_sucursales_cadena
  ON cadenas_sucursales (cadena) WHERE vigente = true;

ALTER TABLE cadenas_sucursales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadenas_sucursales_read" ON cadenas_sucursales
  FOR SELECT TO authenticated USING (true);
-- Sin política de insert/update: las escrituras son solo vía service role
-- (lib/cadenas-sucursales-server.ts, llamado desde el cron mensual).
