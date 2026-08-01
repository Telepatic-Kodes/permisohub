-- ON CONFLICT (url_aviso) en el upsert del scraper de Portalinmobiliario
-- (lib/scrapers/portalinmobiliario.ts) requiere un índice único "plano" —
-- Postgres no puede inferir un índice único PARCIAL (WHERE url_aviso IS NOT
-- NULL, ver 20260801_terrenos.sql) desde una cláusula ON CONFLICT que solo
-- nombra la columna. La partición era innecesaria de todas formas: un
-- índice único normal ya permite múltiples NULL (terrenos manuales sin
-- url_aviso), así que solo se reemplaza por uno sin predicado.
DROP INDEX IF EXISTS idx_terrenos_url_aviso;
CREATE UNIQUE INDEX idx_terrenos_url_aviso ON terrenos (url_aviso);
