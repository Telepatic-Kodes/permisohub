-- Capa de detección de oportunidades de compra (conversación 1 ago 2026):
-- historial de precio (vendedor motivado) + señales de ubicación (cercanía a
-- avenidas principales y anchors comerciales vía OpenStreetMap/Overpass).
-- El tercer eje pedido ("precio bajo mercado") se calcula al vuelo en el
-- cliente sobre precio_clp/superficie_lote_m2 ya existentes — no necesita
-- columnas nuevas.

-- ── Historial de precio ─────────────────────────────────────────────────
-- Trigger, no código de aplicación: así ningún scraper nuevo puede "olvidar"
-- registrar el precio anterior (mismo motivo que centralizar
-- COMUNAS_CON_ZONIFICACION — una sola fuente de verdad en vez de N).
-- Se dispara con CUALQUIER UPDATE (no solo el del scraper) porque la
-- condición ya filtra: solo actúa si precio_clp realmente cambió Y ya había
-- un precio_clp previo (evita registrar el primer precio real como si fuera
-- una "baja" desde null).
ALTER TABLE terrenos
  ADD COLUMN IF NOT EXISTS precio_clp_anterior bigint,
  ADD COLUMN IF NOT EXISTS precio_actualizado_el timestamptz;

CREATE OR REPLACE FUNCTION public.registrar_historial_precio_terreno()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.precio_clp IS DISTINCT FROM OLD.precio_clp AND OLD.precio_clp IS NOT NULL THEN
    NEW.precio_clp_anterior := OLD.precio_clp;
    NEW.precio_actualizado_el := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_historial_precio_terreno ON terrenos;
CREATE TRIGGER trg_registrar_historial_precio_terreno
  BEFORE UPDATE ON terrenos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historial_precio_terreno();

-- ── Señales de ubicación (OpenStreetMap Overpass) ───────────────────────
-- Mismo patrón "estado explícito, nunca nullability implícita" que
-- zona_status/uso_comercial_status — 'pendiente' cubre tanto "aún no
-- evaluado" como "no se pudo evaluar" (sin lat/lng, Overpass caído, etc.).
ALTER TABLE terrenos
  ADD COLUMN IF NOT EXISTS ubicacion_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS cerca_avenida_principal boolean,
  ADD COLUMN IF NOT EXISTS anchors_comerciales_cercanos integer,
  ADD COLUMN IF NOT EXISTS ubicacion_consultada_el timestamptz;

ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_ubicacion_status_check
  CHECK (ubicacion_status IN ('pendiente', 'resuelto', 'error'));
