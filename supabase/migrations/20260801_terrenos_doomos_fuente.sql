-- Agrega 'doomos' como fuente válida (lib/scrapers/doomos.ts, tercera fuente
-- de descubrimiento junto a Portalinmobiliario y PortalTerreno).
ALTER TABLE terrenos DROP CONSTRAINT IF EXISTS terrenos_fuente_check;
ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_fuente_check
  CHECK (fuente IN ('manual', 'portalinmobiliario', 'portalterreno', 'doomos'));
