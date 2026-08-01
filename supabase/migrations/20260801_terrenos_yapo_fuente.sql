-- Agrega 'yapo' como fuente válida (lib/scrapers/yapo.ts, cuarta fuente de
-- descubrimiento junto a Portalinmobiliario, PortalTerreno y Doomos).
ALTER TABLE terrenos DROP CONSTRAINT IF EXISTS terrenos_fuente_check;
ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_fuente_check
  CHECK (fuente IN ('manual', 'portalinmobiliario', 'portalterreno', 'doomos', 'yapo'));
