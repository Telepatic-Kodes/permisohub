-- Agrega 'chilepropiedades' como fuente válida (lib/scrapers/chilepropiedades.ts,
-- quinta fuente de descubrimiento).
ALTER TABLE terrenos DROP CONSTRAINT IF EXISTS terrenos_fuente_check;
ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_fuente_check
  CHECK (fuente IN ('manual', 'portalinmobiliario', 'portalterreno', 'doomos', 'yapo', 'chilepropiedades'));
