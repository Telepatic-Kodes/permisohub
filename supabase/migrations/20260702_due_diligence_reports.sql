-- Migration: due_diligence_reports
-- Reportes de due diligence documental generados por IA sobre el CONJUNTO de
-- documentos de un proyecto (lee el contenido de cada PDF con gpt-4o y cruza
-- la información). Proceso asíncrono: pending → processing → done | error.
-- El cliente hace polling a GET /api/ai/due-diligence/[reportId].

CREATE TABLE IF NOT EXISTS due_diligence_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  uuid        NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'done', 'error')),
  progress     jsonb,      -- { current: int, total: int, label: text }
  result       jsonb,      -- DueDiligenceResult (ver lib/due-diligence.ts)
  error        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dd_reports_proyecto
  ON due_diligence_reports(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_dd_reports_user
  ON due_diligence_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_dd_reports_recent
  ON due_diligence_reports(proyecto_id, created_at DESC);

-- Auto-updated_at (la función set_updated_at() ya existe en schema.sql)
CREATE TRIGGER trg_dd_reports_updated_at
  BEFORE UPDATE ON due_diligence_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE due_diligence_reports ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve/gestiona los reportes de sus propios proyectos.
CREATE POLICY "dd_reports_own" ON due_diligence_reports
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
