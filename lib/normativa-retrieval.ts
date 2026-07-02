// Recuperación normativa unificada — OGUC + LGUC + Circulares DDU
//
// Unifica la recuperación por keyword matching de las tres fuentes curadas y
// devuelve un contexto combinado, etiquetando cada bloque con su fuente. Esta
// es la recuperación ACTIVA del copiloto (keyword-based). El módulo lib/rag.ts
// implementa retrieval semántico (pgvector) pero NO está cableado al runtime.
//
// Reutiliza la misma lógica de scoring de getArticulosRelevantes (oguc-knowledge).

import { ARTICULOS_OGUC } from './oguc-knowledge'
import { ARTICULOS_LGUC } from './lguc-knowledge'
import { CIRCULARES_DDU } from './circulares-ddu'

export type FuenteNormativa = 'OGUC' | 'LGUC' | 'DDU'

// Forma mínima común a las tres fuentes para poder puntuarlas de forma genérica.
interface Scorable {
  id: string
  titulo: string
  texto: string
  keywords: string[]
  categoria: string
  // Etiqueta que se antepone al id en el encabezado (ej: "Art.", "Circular").
  displayId: string
}

interface ScoredNorma {
  fuente: FuenteNormativa
  item: Scorable
  score: number
}

// Puntúa un conjunto de normas contra la query (misma heurística que OGUC).
function scoreSource(
  query: string,
  fuente: FuenteNormativa,
  items: Scorable[]
): ScoredNorma[] {
  const q = query.toLowerCase()

  return items.map((item) => {
    let score = 0
    for (const kw of item.keywords) {
      if (q.includes(kw.toLowerCase())) score += 3
    }
    if (q.includes(item.titulo.toLowerCase())) score += 5
    if (q.includes(item.id.toLowerCase())) score += 10
    if (q.includes(item.categoria)) score += 2
    for (const kw of item.keywords) {
      if (kw.toLowerCase().includes(q.slice(0, 5))) score += 1
    }
    return { fuente, item, score }
  })
}

function formatBlock(scored: ScoredNorma): string {
  const { fuente, item } = scored
  return `**[${fuente}] ${item.displayId} — ${item.titulo}**\n${item.texto}`
}

/**
 * Devuelve el contexto normativo combinado (OGUC + LGUC + circulares DDU) más
 * relevante para la consulta, etiquetado por fuente.
 *
 * Estrategia: puntúa las tres fuentes con la misma heurística de keywords,
 * mezcla los resultados con score > 0, ordena por score y devuelve el top.
 * Si ninguna fuente puntúa, cae al comportamiento histórico de OGUC (primeros
 * artículos generales) para no dejar al modelo sin contexto.
 */
export function getContextoNormativo(query: string, limit = 8): string {
  const ogucScored = scoreSource(
    query,
    'OGUC',
    ARTICULOS_OGUC.map((a) => ({ ...a, displayId: `Art. ${a.id} OGUC` }))
  )
  const lgucScored = scoreSource(
    query,
    'LGUC',
    ARTICULOS_LGUC.map((a) => ({ ...a, displayId: `Art. ${a.id} LGUC` }))
  )
  const dduScored = scoreSource(
    query,
    'DDU',
    CIRCULARES_DDU.map((c) => ({ ...c, displayId: `Circular ${c.numero}` }))
  )

  const relevant = [...ogucScored, ...lgucScored, ...dduScored]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (relevant.length === 0) {
    // Fallback: contexto general OGUC (compatibilidad con getContextoOGUC).
    return ARTICULOS_OGUC.slice(0, 3)
      .map((a) => `**[OGUC] Art. ${a.id} OGUC — ${a.titulo}**\n${a.texto}`)
      .join('\n\n---\n\n')
  }

  return relevant.map(formatBlock).join('\n\n---\n\n')
}
