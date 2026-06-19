-- ============================================================================
-- PermisoHub — Esquema de base de datos (Supabase / PostgreSQL)
-- B2B SaaS para arquitectos chilenos: seguimiento de permisos municipales.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- clientes
-- ----------------------------------------------------------------------------
CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rut text,
  contacto_nombre text,
  email text,
  telefono text,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- municipios
-- ----------------------------------------------------------------------------
CREATE TABLE municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  region text NOT NULL DEFAULT 'Metropolitana',
  dom_telefono text,
  dom_email text,
  dom_horario text,
  plataforma_digital text,
  url_dom text,
  plazo_tipico_dias int,
  notas_internas text,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- requisitos_municipio
-- ----------------------------------------------------------------------------
CREATE TABLE requisitos_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid REFERENCES municipios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  obligatorio boolean DEFAULT true,
  notas text
);

-- ----------------------------------------------------------------------------
-- proyectos
-- ----------------------------------------------------------------------------
CREATE TABLE proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  municipio_id uuid REFERENCES municipios(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  direccion text,
  tipo text NOT NULL DEFAULT 'permiso_edificacion',
  estado text NOT NULL DEFAULT 'borrador',
  etapa_actual text,
  numero_expediente text,
  fecha_inicio date DEFAULT CURRENT_DATE,
  fecha_estimada date,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- etapas
-- ----------------------------------------------------------------------------
CREATE TABLE etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  orden int NOT NULL DEFAULT 0,
  fecha_inicio date,
  fecha_fin date,
  notas text
);

-- ----------------------------------------------------------------------------
-- documentos
-- ----------------------------------------------------------------------------
CREATE TABLE documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text,
  url text NOT NULL,
  tamano int,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- comunicaciones
-- ----------------------------------------------------------------------------
CREATE TABLE comunicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid REFERENCES proyectos(id) ON DELETE CASCADE,
  fecha date DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'email',
  asunto text NOT NULL,
  descripcion text,
  contacto text,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Índices útiles
-- ----------------------------------------------------------------------------
CREATE INDEX idx_proyectos_cliente_id ON proyectos(cliente_id);
CREATE INDEX idx_proyectos_municipio_id ON proyectos(municipio_id);
CREATE INDEX idx_proyectos_estado ON proyectos(estado);
CREATE INDEX idx_etapas_proyecto_id ON etapas(proyecto_id);
CREATE INDEX idx_documentos_proyecto_id ON documentos(proyecto_id);
CREATE INDEX idx_comunicaciones_proyecto_id ON comunicaciones(proyecto_id);
CREATE INDEX idx_requisitos_municipio_id ON requisitos_municipio(municipio_id);

-- ----------------------------------------------------------------------------
-- Trigger: mantener proyectos.updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- Habilitada en todas las tablas. Se permite el acceso completo a usuarios
-- autenticados (modelo de un solo tenant interno: EP Gestión Arquitectónica).
-- Ajustar políticas si se requiere multi-tenant en el futuro.
-- ----------------------------------------------------------------------------
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitos_municipio ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_clientes" ON clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_municipios" ON municipios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_requisitos_municipio" ON requisitos_municipio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_proyectos" ON proyectos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_etapas" ON etapas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_documentos" ON documentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_comunicaciones" ON comunicaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- Seed: 10 municipios principales
-- Plazos típicos (días) basados en estimaciones referenciales del trámite
-- de permiso de edificación en cada Dirección de Obras Municipales (DOM).
-- ============================================================================
INSERT INTO municipios
  (nombre, region, dom_telefono, dom_email, dom_horario, plataforma_digital, url_dom, plazo_tipico_dias, notas_internas)
VALUES
  ('Santiago', 'Metropolitana', '+56 2 2713 6000', 'dom@munistgo.cl',
   'Lun a Vie 8:30 - 14:00', 'DOM Digital',
   'https://www.munistgo.cl/direccion-de-obras-municipales/', 45,
   'Alto volumen de ingresos; revisar observaciones frecuentes en expedientes.'),
  ('Providencia', 'Metropolitana', '+56 2 2654 3000', 'obras@providencia.cl',
   'Lun a Vie 8:30 - 14:00', 'SmartCity Providencia',
   'https://www.providencia.cl/direccion-de-obras', 30,
   'Plataforma digital ágil; documentación bien estandarizada.'),
  ('Maipú', 'Metropolitana', '+56 2 2677 6000', 'dom@maipu.cl',
   'Lun a Vie 8:30 - 14:00', NULL,
   'https://www.maipu.cl/direccion-de-obras-municipales/', 50,
   'Comuna extensa; plazos pueden extenderse en temporada alta.'),
  ('Las Condes', 'Metropolitana', '+56 2 2950 0000', 'obras@lascondes.cl',
   'Lun a Vie 8:30 - 14:00', 'Portal DOM Las Condes',
   'https://www.lascondes.cl/direccion-de-obras', 35,
   'Exigente con expediente técnico; revisión cuidadosa de normativa.'),
  ('Vitacura', 'Metropolitana', '+56 2 2419 6000', 'dom@vitacura.cl',
   'Lun a Vie 8:30 - 14:00', 'Vitacura Digital',
   'https://www.vitacura.cl/direccion-de-obras-municipales', 30,
   'Énfasis en cumplimiento de plan regulador comunal.'),
  ('Ñuñoa', 'Metropolitana', '+56 2 2973 3000', 'obras@nunoa.cl',
   'Lun a Vie 8:30 - 14:00', NULL,
   'https://www.nunoa.cl/direccion-de-obras/', 40,
   'Solicitar hora previa para atención presencial.'),
  ('San Miguel', 'Metropolitana', '+56 2 2550 5000', 'dom@sanmiguel.cl',
   'Lun a Vie 8:30 - 14:00', NULL,
   'https://www.sanmiguel.cl/direccion-de-obras-municipales/', 45,
   'Verificar zonificación antes de ingresar el proyecto.'),
  ('Pudahuel', 'Metropolitana', '+56 2 2440 5000', 'obras@pudahuel.cl',
   'Lun a Vie 8:30 - 14:00', NULL,
   'https://www.pudahuel.cl/direccion-de-obras/', 55,
   'Plazos más largos; coordinar seguimiento periódico con la DOM.'),
  ('La Florida', 'Metropolitana', '+56 2 2892 1000', 'dom@laflorida.cl',
   'Lun a Vie 8:30 - 14:00', 'DOM La Florida en Línea',
   'https://www.laflorida.cl/direccion-de-obras-municipales/', 50,
   'Comuna de alta demanda residencial; anticipar observaciones.'),
  ('Rancagua', 'O''Higgins', '+56 72 220 0900', 'obras@rancagua.cl',
   'Lun a Vie 8:30 - 14:00', NULL,
   'https://www.rancagua.cl/direccion-de-obras/', 45,
   'Capital regional de O''Higgins; coordinar con SEREMI cuando aplique.');
