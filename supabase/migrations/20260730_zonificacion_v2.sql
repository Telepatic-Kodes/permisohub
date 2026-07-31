-- Zonificación v2 (Fase 11): polígono de zona para confirmación visual en mapa
-- (ZONE-02) + distinción automático/manual (ZONE-05) — ambos aditivos sobre el
-- schema de 20260730_zonificacion.sql, sin tocar columnas existentes.

ALTER TABLE zonificacion_cache
  ADD COLUMN IF NOT EXISTS geometria jsonb;  -- Polygon GeoJSON convertido desde Esri JSON; NULL para filas cacheadas antes de este cambio (degradar con gracia, nunca error — ver Pitfall 2 de 11-RESEARCH.md)

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS zona_origen text;  -- 'automatico' | 'manual' | NULL (sin lookup todavía)

ALTER TABLE proyectos
  ADD CONSTRAINT zona_origen_check
  CHECK (zona_origen IS NULL OR zona_origen IN ('automatico', 'manual'));
