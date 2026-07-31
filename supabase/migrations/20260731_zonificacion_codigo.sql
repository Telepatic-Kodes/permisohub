-- Follow-up to 20260730_zonificacion.sql / 20260730_zonificacion_v2.sql: ZONE-01
-- requires the zone CODE (distinct from nombre/sector), which neither Phase 10
-- nor Plan 11-01 persisted onto proyectos. Additive, idempotent.
-- (Found by plan-checker after Wave 1 shipped — see 11-06-PLAN.md Task 0.)
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS zona_codigo text;
