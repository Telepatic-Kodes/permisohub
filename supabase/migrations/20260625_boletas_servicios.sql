-- Migration: boletas_servicios
-- Gestión de boletas de servicios básicos (agua, electricidad, gas) por local.
-- Requisito regulatorio: Informe Sanitario SEREMI (Ficha 163) + Autorización Sanitaria Alimentos (Ficha 172).

CREATE TABLE IF NOT EXISTS boletas_servicios (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id         uuid        NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  tipo_servicio    text        NOT NULL CHECK (tipo_servicio IN ('agua', 'electricidad', 'gas')),
  proveedor        text        NOT NULL,
  numero_cuenta    text,
  periodo          text        NOT NULL,  -- formato YYYY-MM
  url              text,                  -- Supabase Storage URL del PDF
  fecha_emision    date,
  fecha_vencimiento date,
  monto_clp        integer,
  estado           text        NOT NULL DEFAULT 'pendiente'
                               CHECK (estado IN ('pendiente', 'vigente', 'por_vencer', 'vencida')),
  tramite_tipo     text        CHECK (tramite_tipo IN (
                                 'informe_sanitario',
                                 'autorizacion_sanitaria_alimentos',
                                 'patente_comercial',
                                 'otro'
                               )),
  notas            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Una boleta por local × servicio × periodo
CREATE UNIQUE INDEX IF NOT EXISTS idx_boletas_local_tipo_periodo
  ON boletas_servicios(local_id, tipo_servicio, periodo);

CREATE INDEX IF NOT EXISTS idx_boletas_local_id
  ON boletas_servicios(local_id);

CREATE INDEX IF NOT EXISTS idx_boletas_periodo
  ON boletas_servicios(periodo);

CREATE INDEX IF NOT EXISTS idx_boletas_estado
  ON boletas_servicios(estado);

-- Auto-updated_at trigger
CREATE TRIGGER trg_boletas_updated_at
  BEFORE UPDATE ON boletas_servicios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE boletas_servicios ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del workspace que posee la cadena del local
CREATE POLICY "boletas_workspace_read" ON boletas_servicios
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM locales l
      JOIN centros_comerciales cc ON cc.id = l.centro_id
      JOIN cadenas ca             ON ca.id = cc.cadena_id
      JOIN workspace_members wm   ON wm.workspace_id = ca.workspace_id
      WHERE l.id = boletas_servicios.local_id
        AND wm.user_id = auth.uid()
    )
  );

-- Escritura: solo admin o arquitecto del workspace
CREATE POLICY "boletas_workspace_write" ON boletas_servicios
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM locales l
      JOIN centros_comerciales cc ON cc.id = l.centro_id
      JOIN cadenas ca             ON ca.id = cc.cadena_id
      JOIN workspace_members wm   ON wm.workspace_id = ca.workspace_id
      WHERE l.id = boletas_servicios.local_id
        AND wm.user_id = auth.uid()
        AND wm.rol IN ('admin', 'arquitecto')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM locales l
      JOIN centros_comerciales cc ON cc.id = l.centro_id
      JOIN cadenas ca             ON ca.id = cc.cadena_id
      JOIN workspace_members wm   ON wm.workspace_id = ca.workspace_id
      WHERE l.id = boletas_servicios.local_id
        AND wm.user_id = auth.uid()
        AND wm.rol IN ('admin', 'arquitecto')
    )
  );
