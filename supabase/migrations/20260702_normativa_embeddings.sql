-- Normativa embeddings (RAG semántico con pgvector)
--
-- ⚠️ NO APLICADA AÚN. Habilita el retrieval semántico usado por lib/rag.ts.
-- La recuperación activa del copiloto sigue siendo por keywords
-- (lib/normativa-retrieval.ts); esta migración es scaffolding listo-para-activar.
--
-- Pasos para activar:
--   1) Aplicar esta migración (crea extensión vector, tabla, índice y RPC).
--   2) Backfill: ejecutar backfillNormativaEmbeddings() de lib/rag.ts.
--   3) Recién entonces cablear matchNormativa() en las rutas de IA.

-- 1. Extensión pgvector (dimensión objetivo: 1536 = text-embedding-3-small)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de embeddings de normativa curada (OGUC + LGUC + DDU)
CREATE TABLE normativa_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente text NOT NULL,               -- 'OGUC' | 'LGUC' | 'DDU'
  articulo_id text NOT NULL,          -- id del artículo/circular en el contenido curado
  titulo text NOT NULL,
  contenido text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dedup / upsert target del backfill: una fila por (fuente, articulo_id)
CREATE UNIQUE INDEX idx_normativa_embeddings_dedup
  ON normativa_embeddings (fuente, articulo_id);

CREATE INDEX idx_normativa_embeddings_fuente ON normativa_embeddings (fuente);

-- 3. Índice ivfflat para búsqueda aproximada por distancia coseno.
--    (lists=100 es un valor inicial razonable para pocos miles de filas;
--     ajustar tras el backfill. ivfflat requiere ANALYZE para rendir.)
CREATE INDEX idx_normativa_embeddings_embedding
  ON normativa_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. RPC de retrieval por similitud (coseno). Devuelve las filas más cercanas
--    a query_embedding con similarity >= match_threshold.
CREATE OR REPLACE FUNCTION match_normativa(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  fuente text,
  articulo_id text,
  titulo text,
  contenido text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ne.id,
    ne.fuente,
    ne.articulo_id,
    ne.titulo,
    ne.contenido,
    1 - (ne.embedding <=> query_embedding) AS similarity
  FROM normativa_embeddings ne
  WHERE 1 - (ne.embedding <=> query_embedding) >= match_threshold
  ORDER BY ne.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. RLS: lectura para usuarios autenticados; escritura solo vía service role
--    (el backfill usa SUPABASE_SERVICE_ROLE_KEY, que hace bypass de RLS).
ALTER TABLE normativa_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "normativa_embeddings_read" ON normativa_embeddings
  FOR SELECT TO authenticated USING (true);
