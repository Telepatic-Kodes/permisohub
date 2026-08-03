-- Motor de cabida comercial (Fase 16): caché de isócronas keyed por
-- ubicación, NO por oportunidadId (CABI-01 — motor desacoplado). Tabla
-- ANGOSTA a propósito: solo lat/lng/modo/minutos/isocrona_* — Fase 17/18
-- agregarán demografia_*/competencia_* vía migración ADITIVA, mismo patrón
-- que 20260730_zonificacion.sql → 20260730_zonificacion_v2.sql. Ver
-- 16-RESEARCH.md "Open Question 2".

CREATE TABLE IF NOT EXISTS cabida_comercial_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_r numeric(9,6) NOT NULL,      -- redondeado a 6 decimales (~11cm), mismo criterio que zonificacion_cache
  lng_r numeric(9,6) NOT NULL,
  modo text NOT NULL,               -- 'caminando' | 'auto'
  minutos integer NOT NULL,

  isocrona_status text NOT NULL DEFAULT 'pendiente',  -- enum explícito, mismo criterio que proyectos.zona_status — nunca solo nullability
  isocrona_metodo text,             -- 'red_vial' | 'circulo_equivalente' — NULL solo mientras status='pendiente'
  isocrona_geometria jsonb,
  isocrona_proveedor text,          -- 'openrouteservice' | NULL (NULL cuando metodo='circulo_equivalente')

  consultado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cabida_comercial_cache_geo
  ON cabida_comercial_cache (lat_r, lng_r, modo, minutos);

ALTER TABLE cabida_comercial_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabida_comercial_cache_read" ON cabida_comercial_cache
  FOR SELECT TO authenticated USING (true);
-- Sin política de INSERT/UPDATE para authenticated — escrituras solo vía
-- service role (createServiceClient()), mismo patrón que zonificacion_cache.

ALTER TABLE cabida_comercial_cache
  ADD CONSTRAINT cabida_comercial_cache_status_check
  CHECK (isocrona_status IN ('pendiente', 'encontrado', 'error'));

ALTER TABLE cabida_comercial_cache
  ADD CONSTRAINT cabida_comercial_cache_metodo_check
  CHECK (isocrona_metodo IS NULL OR isocrona_metodo IN ('red_vial', 'circulo_equivalente'));

ALTER TABLE cabida_comercial_cache
  ADD CONSTRAINT cabida_comercial_cache_modo_check
  CHECK (modo IN ('caminando', 'auto'));
