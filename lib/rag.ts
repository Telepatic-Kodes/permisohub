// RAG (Retrieval-Augmented Generation) semántico sobre normativa — pgvector
//
// ⚠️ ESTADO: SCAFFOLDING LISTO-PARA-ACTIVAR, NO CABLEADO AL RUNTIME.
//
// La recuperación ACTIVA del copiloto es por keywords (lib/normativa-retrieval.ts).
// Este módulo implementa la alternativa semántica con embeddings + pgvector,
// pero NO se invoca desde ninguna ruta todavía. No afecta el comportamiento
// actual. Para activarlo hacen falta DOS pasos operativos, en este orden:
//
//   1) APLICAR LA MIGRACIÓN
//      supabase/migrations/20260702_normativa_embeddings.sql
//      (habilita la extensión `vector`, crea la tabla `normativa_embeddings`,
//       el índice ivfflat y la función RPC `match_normativa`).
//
//   2) BACKFILL DE EMBEDDINGS
//      Recorrer ARTICULOS_OGUC + ARTICULOS_LGUC + CIRCULARES_DDU, generar el
//      embedding de cada `texto` con generateEmbedding() e insertarlo en
//      `normativa_embeddings` (ver backfillNormativaEmbeddings más abajo).
//
// Recién entonces se podría reemplazar/complementar getContextoNormativo() por
// matchNormativa() en las rutas de IA. Hasta ese momento, dejar este archivo
// aislado.

import { getAI } from './ai'
import { createServiceClient } from './supabase/service'
import { ARTICULOS_OGUC } from './oguc-knowledge'
import { ARTICULOS_LGUC } from './lguc-knowledge'
import { CIRCULARES_DDU } from './circulares-ddu'

// text-embedding-3-small → 1536 dimensiones. Debe coincidir con vector(1536)
// de la migración.
export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMS = 1536

export type FuenteNormativa = 'OGUC' | 'LGUC' | 'DDU'

export interface NormativaMatch {
  id: string
  fuente: FuenteNormativa
  articulo_id: string
  titulo: string
  contenido: string
  similarity: number
}

/**
 * Genera el embedding de un texto con OpenAI text-embedding-3-small.
 * Lanza si OPENAI_API_KEY no está configurado.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')

  const response = await ai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, ' '),
  })
  return response.data[0].embedding
}

/**
 * Retrieval por similitud semántica: embebe la query y consulta la RPC
 * `match_normativa` (pgvector) en Supabase.
 *
 * ⚠️ Requiere la migración aplicada + backfill hecho. No invocar hasta entonces.
 */
export async function matchNormativa(
  query: string,
  opts: { matchThreshold?: number; matchCount?: number } = {}
): Promise<NormativaMatch[]> {
  const { matchThreshold = 0.7, matchCount = 8 } = opts

  const queryEmbedding = await generateEmbedding(query)
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('match_normativa', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) throw new Error(`match_normativa RPC error: ${error.message}`)
  return (data ?? []) as NormativaMatch[]
}

/**
 * Construye el bloque de contexto (mismo formato etiquetado que
 * getContextoNormativo) a partir de matches semánticos.
 *
 * ⚠️ Requiere migración + backfill. Helper para cuando se cablee el RAG.
 */
export async function getContextoNormativoSemantico(query: string): Promise<string> {
  const matches = await matchNormativa(query)
  if (matches.length === 0) return ''
  return matches
    .map((m) => `**[${m.fuente}] ${m.articulo_id} — ${m.titulo}**\n${m.contenido}`)
    .join('\n\n---\n\n')
}

/**
 * Backfill idempotente: genera e inserta los embeddings de las tres fuentes
 * curadas en `normativa_embeddings`.
 *
 * ⚠️ Utilidad operativa, NO se ejecuta automáticamente. Correr una sola vez
 * (o tras editar el contenido curado) desde un script/cron con acceso a la DB,
 * después de aplicar la migración. Usa upsert por (fuente, articulo_id).
 */
export async function backfillNormativaEmbeddings(): Promise<{ inserted: number }> {
  const supabase = createServiceClient()

  const fuentes: Array<{
    fuente: FuenteNormativa
    items: Array<{ id: string; titulo: string; texto: string; categoria: string }>
  }> = [
    { fuente: 'OGUC', items: ARTICULOS_OGUC },
    { fuente: 'LGUC', items: ARTICULOS_LGUC },
    {
      fuente: 'DDU',
      items: CIRCULARES_DDU.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        texto: c.texto,
        categoria: c.categoria,
      })),
    },
  ]

  let inserted = 0
  for (const { fuente, items } of fuentes) {
    for (const item of items) {
      const embedding = await generateEmbedding(`${item.titulo}\n\n${item.texto}`)
      const { error } = await supabase.from('normativa_embeddings').upsert(
        {
          fuente,
          articulo_id: item.id,
          titulo: item.titulo,
          contenido: item.texto,
          embedding,
          metadata: { categoria: item.categoria },
        },
        { onConflict: 'fuente,articulo_id' }
      )
      if (error) throw new Error(`upsert error (${fuente} ${item.id}): ${error.message}`)
      inserted++
    }
  }

  return { inserted }
}
