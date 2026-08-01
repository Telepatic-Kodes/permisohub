-- Módulo Terrenos: evaluar viabilidad normativa de un terreno (dirección
-- suelta o listado de portal) ANTES de que exista un Proyecto/Cliente. Reusa
-- el mismo cluster de campos SII/zonificación que `proyectos` ya tiene (ver
-- 20260705_proyectos_sii.sql, 20260730_zonificacion.sql) — un terreno se
-- puede "promover" a proyecto una vez hay un cliente real (proyecto_id).
--
-- Root table con workspace_id, siguiendo exactamente el patrón de
-- 20260731_workspace_compartir.sql (es_miembro() ya definida ahí).

CREATE TABLE IF NOT EXISTS terrenos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identificación / listado del terreno
  direccion text NOT NULL,
  comuna text NOT NULL,
  fuente text NOT NULL DEFAULT 'manual',
  url_aviso text,
  precio_clp bigint,
  superficie_lote_m2 numeric,
  fecha_publicacion date,

  -- Catastro SII (mismo cluster que proyectos.rol_sii/avaluo_fiscal_clp/etc.)
  rol_sii text,
  avaluo_fiscal_clp bigint,
  superficie_terreno_m2 numeric,
  superficie_construida_m2 numeric,
  destino_sii text,
  lat numeric,
  lng numeric,

  -- Zonificación (mismo cluster que proyectos.zona_*)
  zona_status text NOT NULL DEFAULT 'pendiente',
  zona_cache_id uuid REFERENCES zonificacion_cache(id),
  zona_codigo text,
  zona_sector text,
  zona_nombre text,
  zona_uperm text,
  zona_uproh text,
  zona_usos_disponibles boolean,
  zona_fuente_url text,
  zona_consultada_el timestamptz,

  -- Ciclo de vida: se llena si el terreno se "promueve" a proyecto
  proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_fuente_check
  CHECK (fuente IN ('manual', 'portalinmobiliario'));

ALTER TABLE terrenos
  ADD CONSTRAINT terrenos_zona_status_check
  CHECK (zona_status IN ('pendiente', 'encontrado', 'sin_cobertura', 'error'));

CREATE INDEX IF NOT EXISTS idx_terrenos_workspace ON terrenos (workspace_id);
CREATE INDEX IF NOT EXISTS idx_terrenos_comuna ON terrenos (comuna);
-- Evita duplicados cuando el scraper (Fase B) reinserta el mismo aviso en corridas repetidas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_terrenos_url_aviso ON terrenos (url_aviso) WHERE url_aviso IS NOT NULL;

ALTER TABLE terrenos ENABLE ROW LEVEL SECURITY;

CREATE POLICY terrenos_workspace ON terrenos FOR ALL
  USING (es_miembro(workspace_id)) WITH CHECK (es_miembro(workspace_id));
