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
    CIRCULARES_DDU.map((c) => ({
      ...c,
      displayId: `Circular ${c.numero}${c.verificado ? '' : ' [n° por verificar]'}`,
      texto: c.verificado && c.fuente ? `${c.texto}\nFuente oficial: ${c.fuente}` : c.texto,
    }))
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

// Tokens numéricos de las circulares DDU verificadas contra MINVU (solo dígitos,
// ej. "DDU-ESP 091-07" → "09107"). Sirven para distinguir una cita real de un
// número inventado por el modelo.
const VERIFIED_DDU_TOKENS = new Set(
  CIRCULARES_DDU.filter((c) => c.verificado)
    .map((c) => c.numero.replace(/\D/g, ''))
    .filter(Boolean)
)

// Marca como NO verificada una cita a circular DDU con un número que NO coincide
// con ninguna circular verificada de la base. Cualquier "DDU 1234" inventado se
// anota como "(n° por verificar)"; una cita a una DDU real (ej. "DDU-ESP 091-07")
// pasa intacta. Una cita por materia (sin número) no se toca.
export function flagUnverifiedDDU(code: string): string {
  if (!code) return code
  const m = code.match(/\bDDU\b[^A-Za-z0-9]*(?:ESP[^A-Za-z0-9]*)?N?[°º]?\s*([\d-]+)/i)
  if (!m) return code // cita por materia, sin número → nada que marcar
  const digits = m[1].replace(/\D/g, '')
  if (digits && VERIFIED_DDU_TOKENS.has(digits)) return code // DDU real verificada
  if (/por verificar/i.test(code)) return code
  return `${code.trim()} (n° por verificar)`
}

// Ids de artículos OGUC/LGUC presentes en la base curada (los ÚNICOS que se
// inyectan como contexto). Una cita a un artículo fuera de este set se marca
// como "por verificar": el modelo fue instruido a citar solo los del contexto.
const VERIFIED_OGUC_IDS = new Set(ARTICULOS_OGUC.map((a) => a.id.toLowerCase()))
const VERIFIED_LGUC_IDS = new Set(ARTICULOS_LGUC.map((a) => a.id.toLowerCase()))

// Marca como NO verificada una cita a un artículo OGUC/LGUC cuyo número no esté
// en la base curada. "Art. 5.1.2 OGUC" (curado) pasa intacto; "Art. 9.9.9 OGUC"
// (fuera de base) se anota "(por verificar)". Citas por materia/PRC no se tocan.
export function flagUnverifiedArticulo(code: string): string {
  if (!code) return code
  if (/por verificar/i.test(code)) return code
  const m = code.match(/\b(?:art[íi]?culo|art)\.?\s*(\d+(?:\.\d+)*(?:\s*bis)?)\s*(OGUC|LGUC)\b/i)
  if (!m) return code // no es una cita "Art. X OGUC/LGUC" → nada que verificar
  const id = m[1].trim().toLowerCase().replace(/\s+/g, ' ')
  const set = m[2].toUpperCase() === 'OGUC' ? VERIFIED_OGUC_IDS : VERIFIED_LGUC_IDS
  const ok = set.has(id) || [...set].some((v) => id === v || id.startsWith(`${v} `))
  return ok ? code : `${code.trim()} (por verificar)`
}

// Aplica ambas verificaciones (artículo + DDU) sobre una cita.
export function flagUnverifiedCita(code: string): string {
  return flagUnverifiedArticulo(flagUnverifiedDDU(code))
}

// Regla reutilizable para inyectar en los prompts: evita inventar normativa.
export const REGLAS_CITACION = `## Reglas de citación (no inventar normativa)
- Cita SOLO artículos y circulares presentes en el CONTEXTO NORMATIVO de arriba.
- NUNCA inventes números de ARTÍCULO. Si el punto no está cubierto por un artículo del contexto, describe la materia sin número (o deja el artículo vacío) en vez de adivinar un "Art. X.X.X".
- Circulares DDU: puedes citar el número SOLO si esa circular aparece en el contexto con su número (ej. "DDU 328", "DDU-ESP 084-07"). Para cualquier otra circular, NUNCA inventes un número — refiérela por su MATERIA/título (ej. "DDU — modificación de proyecto").
- Si ninguna circular del contexto aplica, no cites ninguna DDU.`
