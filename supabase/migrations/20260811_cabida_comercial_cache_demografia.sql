-- Aditivo sobre cabida_comercial_cache (Fase 16) — mismo patrón que
-- Fase 18's 20260810_cadenas_sucursales_geocoding.sql: migración aplicada
-- independiente de que lib/cabida-comercial-server.ts exista todavía.
-- demografia_status sigue el mismo criterio explícito que isocrona_status —
-- nunca solo nullability (ver 20260809_cabida_comercial_cache.sql).

ALTER TABLE cabida_comercial_cache
  ADD COLUMN demografia_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN demografia_total_personas integer,
  ADD COLUMN demografia_total_viviendas integer,
  ADD COLUMN demografia_manzanas_intersectadas integer,
  ADD COLUMN demografia_censo_ano integer,      -- SIEMPRE 2017 hoy, pero explícito y no un literal disperso (DEMO-03)
  ADD COLUMN demografia_consultado_el timestamptz;

ALTER TABLE cabida_comercial_cache
  ADD CONSTRAINT cabida_comercial_cache_demografia_status_check
  CHECK (demografia_status IN ('pendiente', 'encontrado', 'error'));

COMMENT ON COLUMN cabida_comercial_cache.demografia_status IS
  'Independiente de isocrona_status (Fase 16) y competencia_status (Fase 18, si existe) — servicios externos independientes con fallas independientes, mismo criterio que zona_status.';
