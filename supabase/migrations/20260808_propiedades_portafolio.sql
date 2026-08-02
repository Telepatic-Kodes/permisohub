-- "Mi Cartera" — entidad persistente de propiedades propias/administradas
-- por el usuario (rentista/administrador/fondo), gap identificado en la
-- investigación de mercado del 1 ago 2026: todo el módulo Mercado
-- Inmobiliario evalúa un activo a la vez (Pricing, Tasación, Calculadora),
-- pero no existe forma de que un dueño trackee lo que YA tiene y lo compare
-- contra el mercado de forma recurrente. Root table con workspace_id,
-- siguiendo exactamente el patrón de 20260801_terrenos.sql
-- (es_miembro() ya definida en 20260731_workspace_compartir.sql).
CREATE TABLE IF NOT EXISTS propiedades_portafolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  direccion text NOT NULL,
  comuna text NOT NULL,
  tipo_propiedad text NOT NULL DEFAULT 'local_comercial',
  superficie_m2 numeric,

  -- Estado actual del activo — determina si tiene sentido comparar contra
  -- la banda de "arriendo" o de "venta" del mercado.
  operacion text NOT NULL DEFAULT 'arriendo',
  precio_actual_uf numeric,

  rol_sii text,
  notas text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE propiedades_portafolio
  ADD CONSTRAINT propiedades_portafolio_tipo_check
  CHECK (tipo_propiedad IN ('local_comercial', 'oficina', 'bodega', 'industrial'));

ALTER TABLE propiedades_portafolio
  ADD CONSTRAINT propiedades_portafolio_operacion_check
  CHECK (operacion IN ('arriendo', 'venta'));

CREATE INDEX IF NOT EXISTS idx_propiedades_portafolio_workspace ON propiedades_portafolio (workspace_id);
CREATE INDEX IF NOT EXISTS idx_propiedades_portafolio_comuna ON propiedades_portafolio (comuna);

ALTER TABLE propiedades_portafolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY propiedades_portafolio_workspace ON propiedades_portafolio FOR ALL
  USING (es_miembro(workspace_id)) WITH CHECK (es_miembro(workspace_id));
