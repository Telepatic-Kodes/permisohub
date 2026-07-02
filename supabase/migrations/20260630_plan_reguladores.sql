CREATE TABLE plan_reguladores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_nombre text NOT NULL,
  region text,
  titulo text NOT NULL,
  descripcion text,
  organizacion text,
  fecha_publicacion date,
  url_fuente text,
  url_documento text,
  formato text,
  fuente text NOT NULL DEFAULT 'datos_gob_cl',
  dataset_id text,
  vigente boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique dedup index: null dataset_id values never conflict with each other (SQL null semantics)
CREATE UNIQUE INDEX idx_plan_reguladores_dedup
  ON plan_reguladores (dataset_id, fuente)
  WHERE dataset_id IS NOT NULL;

CREATE INDEX idx_plan_reguladores_municipio ON plan_reguladores (municipio_nombre);
CREATE INDEX idx_plan_reguladores_fuente ON plan_reguladores (fuente);

-- Row-level security: read-only for authenticated users, write via service role only
ALTER TABLE plan_reguladores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_reguladores_read" ON plan_reguladores
  FOR SELECT TO authenticated USING (true);
