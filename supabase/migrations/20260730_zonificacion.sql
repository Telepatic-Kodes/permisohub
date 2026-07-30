-- Motor de zonificación: caché compartida de consultas PRC (ArcGIS MINVU/OCUC)
-- + snapshot denormalizado en proyectos. Ver .planning/research/ARCHITECTURE.md
-- (Anti-Pattern 1: cache keyed by ubicación, no por proyecto) y PITFALLS.md
-- (Pitfall 6: estado explícito, nunca solo nullability).

CREATE TABLE IF NOT EXISTS zonificacion_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comuna_id text NOT NULL,               -- matches ComunaChile.id: 'las-condes' | 'providencia' | 'vitacura' | 'nunoa'
  lat_r numeric(9,6) NOT NULL,           -- rounded to 6 decimals (~11cm) — cache key component
  lng_r numeric(9,6) NOT NULL,
  capa text NOT NULL,                    -- 'dedicada' | 'agregada' — never trust these as equal-confidence (Pitfall 3)
  region text,
  sector text,
  zona text,
  nombre_zona text,
  uperm text,                            -- usos permitidos, verbatim from ArcGIS (may be NULL/empty — see agregada tier)
  uproh text,                            -- usos prohibidos, verbatim from ArcGIS (may be NULL/empty)
  usos_disponibles boolean NOT NULL DEFAULT true,  -- false for Ñuñoa-style rows where uperm/uproh are structurally empty
  fuente_url text,                       -- per-zone decree link when available (Las Condes only today); NULL otherwise
  fuente_actualizada_el timestamptz,     -- ArcGIS layer's own editingInfo.lastEditDate — upstream staleness signal, distinct from consultado_el
  raw jsonb NOT NULL,                    -- full feature attributes as returned, forward-compat / debugging
  consultado_el timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_zonificacion_cache_geo
  ON zonificacion_cache (comuna_id, lat_r, lng_r);

ALTER TABLE zonificacion_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zonificacion_cache_read" ON zonificacion_cache
  FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE policy for authenticated — writes only via service role
-- (createServiceClient()), matching plan_reguladores' pattern exactly.

-- Snapshot columns on proyectos — fast, join-free reads for UI/via-decision/due-diligence.
-- Idempotent, matching 20260705_proyectos_sii.sql's exact style.
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS zona_status text NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'encontrado' | 'sin_cobertura' | 'error'
  ADD COLUMN IF NOT EXISTS zona_cache_id uuid REFERENCES zonificacion_cache(id),
  ADD COLUMN IF NOT EXISTS zona_sector text,
  ADD COLUMN IF NOT EXISTS zona_nombre text,
  ADD COLUMN IF NOT EXISTS zona_uperm text,
  ADD COLUMN IF NOT EXISTS zona_uproh text,
  ADD COLUMN IF NOT EXISTS zona_usos_disponibles boolean,
  ADD COLUMN IF NOT EXISTS zona_fuente_url text,
  ADD COLUMN IF NOT EXISTS zona_consultada_el timestamptz;

-- Enforce the explicit 4-state enum at the DB layer, consistent with
-- Pitfall 6 ("never a nullable column masquerading as status"). CHECK constraint
-- (lighter than a Postgres ENUM type — the rest of the schema uses plain text
-- columns throughout, e.g. plan_reguladores.fuente).
ALTER TABLE proyectos
  ADD CONSTRAINT zona_status_check
  CHECK (zona_status IN ('pendiente', 'encontrado', 'sin_cobertura', 'error'));
