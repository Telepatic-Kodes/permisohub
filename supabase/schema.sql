-- ============================================================================
-- PermisoHub — Esquema de base de datos (Supabase / PostgreSQL)
-- B2B SaaS para arquitectos chilenos: seguimiento de permisos municipales.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles (un registro por usuario autenticado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  especialidad text,
  municipio_principal text,
  onboarding_completed boolean DEFAULT false,
  onboarding_step int DEFAULT 0,
  plan text DEFAULT 'starter',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- clientes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  rut text,
  contacto_nombre text,
  email text,
  telefono text,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- municipios (referencia, no por usuario)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS municipios (
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
CREATE TABLE IF NOT EXISTS requisitos_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid REFERENCES municipios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  obligatorio boolean DEFAULT true,
  notas text
);

-- ----------------------------------------------------------------------------
-- proyectos
-- NOTE: municipio es texto libre (nombre de la comuna), no FK a municipios.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  direccion text,
  municipio text,
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
CREATE TABLE IF NOT EXISTS etapas (
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
CREATE TABLE IF NOT EXISTS documentos (
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
CREATE TABLE IF NOT EXISTS comunicaciones (
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
-- prospectos (CRM)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa text NOT NULL,
  contacto_nombre text NOT NULL,
  cargo text,
  email text,
  telefono text,
  linkedin_url text,
  fuente text DEFAULT 'web',
  etapa text NOT NULL DEFAULT 'nuevo_contacto',
  valor_estimado int,
  municipios_interes text[],
  notas text,
  proximo_contacto date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- actividades_crm
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades_crm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id uuid REFERENCES prospectos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nota',
  descripcion text NOT NULL,
  fecha date DEFAULT CURRENT_DATE,
  resultado text,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_proyectos_user_id ON proyectos(user_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_user_id ON prospectos(user_id);
CREATE INDEX IF NOT EXISTS idx_etapas_proyecto_id ON etapas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_proyecto_id ON documentos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_proyecto_id ON comunicaciones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_actividades_prospecto_id ON actividades_crm(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_requisitos_municipio_id ON requisitos_municipio(municipio_id);

-- ----------------------------------------------------------------------------
-- Trigger: mantener updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_prospectos_updated_at
  BEFORE UPDATE ON prospectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitos_municipio ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades_crm ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario solo ve/edita su propio perfil
CREATE POLICY "profiles_own" ON profiles
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Clientes: cada usuario solo ve/edita sus propios clientes
CREATE POLICY "clientes_own" ON clientes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Municipios: lectura pública, escritura solo autenticados
CREATE POLICY "municipios_read" ON municipios
  FOR SELECT USING (true);
CREATE POLICY "municipios_write" ON municipios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Requisitos: lectura pública
CREATE POLICY "requisitos_read" ON requisitos_municipio
  FOR SELECT USING (true);
CREATE POLICY "requisitos_write" ON requisitos_municipio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Proyectos: cada usuario solo ve/edita los suyos
CREATE POLICY "proyectos_own" ON proyectos
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Etapas: heredan acceso via proyecto del usuario
CREATE POLICY "etapas_own" ON etapas
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM proyectos p WHERE p.id = proyecto_id AND p.user_id = auth.uid())
  );

-- Documentos: heredan acceso via proyecto del usuario
CREATE POLICY "documentos_own" ON documentos
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM proyectos p WHERE p.id = proyecto_id AND p.user_id = auth.uid())
  );

-- Comunicaciones: heredan acceso via proyecto del usuario
CREATE POLICY "comunicaciones_own" ON comunicaciones
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM proyectos p WHERE p.id = proyecto_id AND p.user_id = auth.uid())
  );

-- Prospectos: cada usuario solo ve/edita los suyos
CREATE POLICY "prospectos_own" ON prospectos
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Actividades CRM: heredan acceso via prospecto del usuario
CREATE POLICY "actividades_own" ON actividades_crm
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM prospectos pr WHERE pr.id = prospecto_id AND pr.user_id = auth.uid())
  );

-- ============================================================================
-- Seed: 10 municipios principales de Chile
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
   'Capital regional de O''Higgins; coordinar con SEREMI cuando aplique.')
ON CONFLICT DO NOTHING;
