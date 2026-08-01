-- Agrega 'portalterreno' como fuente válida (lib/scrapers/portalterreno.ts,
-- segunda fuente de descubrimiento además de Portalinmobiliario).
ALTER TABLE terrenos DROP CONSTRAINT IF EXISTS terrenos_fuente_check;
ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_fuente_check
  CHECK (fuente IN ('manual', 'portalinmobiliario', 'portalterreno'));
