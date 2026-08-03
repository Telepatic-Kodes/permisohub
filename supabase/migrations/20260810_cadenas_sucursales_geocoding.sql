-- Geocoding on-demand por comuna para cadenas_sucursales (Fase 18, COMPE-06).
-- Columnas NULLABLE, aditivas — nadie las tiene todavía. La ingesta mensual
-- existente (correrIngestaCadenasSucursales, lib/cadenas-sucursales-server.ts)
-- sigue upserteando por (rut, calle, numero, comuna) sin tocar estas 3
-- columnas, así que direcciones ya geocodificadas conservan su cache aunque
-- el SII las vuelva a reportar el mes siguiente.

ALTER TABLE cadenas_sucursales
  ADD COLUMN lat numeric,
  ADD COLUMN lng numeric,
  ADD COLUMN geocodificado_el timestamptz;

COMMENT ON COLUMN cadenas_sucursales.lat IS 'Geocodificado on-demand por comuna (Fase 18, COMPE-06) via lib/geocoding.ts geocodeDireccion() — null hasta la primera consulta de esa comuna.';
COMMENT ON COLUMN cadenas_sucursales.lng IS 'Ver lat.';
COMMENT ON COLUMN cadenas_sucursales.geocodificado_el IS 'Timestamp del geocoding — null si nunca se geocodificó. La ingesta mensual (correrIngestaCadenasSucursales) NO toca estas 3 columnas al re-upsertear direcciones ya conocidas.';
