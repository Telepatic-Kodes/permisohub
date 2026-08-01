-- Capa de filtrado por potencial comercial (strip center / local / power
-- center): clasificación en lote del uso permitido, reusando el mismo motor
-- determinista+IA de lib/zonificacion-compat.ts (COMPAT-01) ya usado en la
-- ficha interactiva de proyecto/terreno — acá se persiste el resultado para
-- poder filtrar sin re-consultar la IA en cada carga de la lista.
--
-- Mismo patrón "estado explícito, nunca nullability implícita" que zona_status
-- (ver 20260730_zonificacion.sql) — 'pendiente' es el default y cubre tanto
-- "aún no evaluado" como "no se pudo evaluar porque la zona no está resuelta".
ALTER TABLE terrenos
  ADD COLUMN IF NOT EXISTS uso_comercial_status text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS uso_comercial_justificacion text,
  ADD COLUMN IF NOT EXISTS uso_comercial_consultado_el timestamptz;

ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_uso_comercial_status_check
  CHECK (uso_comercial_status IN ('pendiente', 'permitido', 'no_permitido', 'no_especificado'));
