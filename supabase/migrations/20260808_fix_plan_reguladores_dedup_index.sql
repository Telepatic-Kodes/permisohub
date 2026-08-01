-- Corrige un bug real en producción encontrado el 1 ago 2026 durante la
-- resolución de deuda de Torre de Control: el índice único original de
-- 20260630_plan_reguladores.sql es PARCIAL (`WHERE dataset_id IS NOT NULL`),
-- lo que rompe el `.upsert(rows, {onConflict: 'dataset_id,fuente'})` del
-- cliente JS de Supabase — Postgres exige que el target de ON CONFLICT
-- calce exactamente con un índice real, predicado incluido, y el cliente JS
-- no puede expresar un predicado parcial ahí. Resultado real observado:
-- el scraper de datos.gob.cl encontraba 67 registros reales y no insertaba
-- ninguno, silenciosamente, cada corrida, desde que se construyó.
--
-- La semántica que buscaba el índice parcial ("NULLs nunca conflictúan
-- entre sí") ya es el comportamiento estándar de un índice único normal en
-- SQL — el predicado parcial era innecesario. Se reemplaza por uno
-- equivalente sin predicado, que si funciona con ON CONFLICT.

DROP INDEX IF EXISTS idx_plan_reguladores_dedup;

CREATE UNIQUE INDEX idx_plan_reguladores_dedup
  ON plan_reguladores (dataset_id, fuente);
