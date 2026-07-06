// ---------------------------------------------------------------------------
// Cita — linkifica menciones normativas dentro de prosa libre.
//
// El asesor (y cualquier prosa del expediente) menciona artículos y circulares
// como texto plano: "Art. 5.1.2 OGUC", "DDU 328", "DDU-ESP 084-07". Este
// componente escanea el string, resuelve cada mención contra la base curada
// (getArticuloById) y convierte SOLO las verificadas en un link a la fuente,
// igual que el Due Diligence y los markups de planos-anotados. Las que no
// resuelven —o vienen anotadas "(por verificar)"— quedan como texto plano: no
// se fabrica un link falso.
//
// Reusa lib/normativa-retrieval (getArticuloById / urlDeCitable). El mismo par
// de regex de planos-anotados (citaDesdeTexto), aquí en variante global para
// enlazar TODAS las menciones de un párrafo, no solo la primera.
// ---------------------------------------------------------------------------
import { type ReactNode } from "react"
import { ExternalLink } from "lucide-react"

import { getArticuloById, urlDeCitable, type FuenteNormativa } from "@/lib/normativa-retrieval"

// Circulares DDU: "DDU 328", "DDU-ESP 084-07", "DDU N° 91-07". El grupo captura
// el número (dígitos y guiones) que se resuelve contra la base.
const RE_DDU = /DDU(?:[\s-]*ESP)?[\s-]*N?[°º]?\s*(\d[\d-]*)/gi
// Artículos OGUC/LGUC: número (con puntos o "bis") seguido de la fuente,
// opcionalmente precedido de "Art." / "Artículo". Ej. "Art. 5.1.2 OGUC",
// "artículo 116 bis LGUC", "5.2.5 OGUC".
const RE_ART = /(?:art(?:[íi]?culos?)?\.?\s*)?(\d+(?:\.\d+)*(?:\s*bis)?)\s*(OGUC|LGUC)\b/gi

interface Hit {
  start: number
  end: number
  text: string // texto exacto a mostrar (con su "Art." si venía en el string)
  url: string
}

// "(por verificar)" / "(n° por verificar)" inmediatamente después de la cita:
// la marca vino explícitamente como no verificada aguas arriba → no enlazar.
const RE_TAIL_UNVERIFIED = /^\s*\(?\s*(?:n[°º]\s*)?por verificar/i

// Localiza las menciones enlazables de un string: resuelve cada candidata y se
// queda solo con las verificadas. Ordena por posición y descarta solapamientos.
function findHits(s: string): Hit[] {
  interface Raw {
    start: number
    end: number
    text: string
    fuente: FuenteNormativa
    id: string
  }
  const raw: Raw[] = []

  for (const m of s.matchAll(RE_DDU)) {
    if (m.index === undefined) continue
    raw.push({ start: m.index, end: m.index + m[0].length, text: m[0], fuente: "DDU", id: m[1] })
  }
  for (const m of s.matchAll(RE_ART)) {
    if (m.index === undefined) continue
    raw.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      fuente: m[2].toUpperCase() as FuenteNormativa,
      id: m[1],
    })
  }

  // Orden por inicio; ante empate, el match más largo primero (gana cobertura).
  raw.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

  const hits: Hit[] = []
  let lastEnd = 0
  for (const r of raw) {
    if (r.start < lastEnd) continue // solapa con una cita ya tomada
    if (RE_TAIL_UNVERIFIED.test(s.slice(r.end, r.end + 24))) {
      lastEnd = r.end
      continue // marcada "(por verificar)" aguas arriba → texto plano
    }
    const a = getArticuloById(r.fuente, r.id)
    if (a?.verificado) {
      hits.push({ start: r.start, end: r.end, text: r.text.trim(), url: urlDeCitable(a) })
      lastEnd = r.end
    }
  }
  return hits
}

/**
 * Renderiza `children` (string) enlazando las citas normativas verificables.
 * Sin citas → devuelve el texto tal cual. Robusto ante strings vacíos.
 */
export function TextoConCitas({ children }: { children: string }): ReactNode {
  const s = children ?? ""
  if (!s) return s
  const hits = findHits(s)
  if (hits.length === 0) return s

  const nodes: ReactNode[] = []
  let cursor = 0
  hits.forEach((h, i) => {
    if (h.start > cursor) nodes.push(s.slice(cursor, h.start))
    nodes.push(
      <a
        key={`cita-${i}`}
        href={h.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Ver ${h.text} en la fuente`}
        className="num inline-flex items-baseline gap-0.5 text-inherit underline decoration-dotted decoration-[var(--line-med)] underline-offset-2 transition-colors hover:text-[var(--blueprint)] hover:decoration-[var(--blueprint)]"
      >
        {h.text}
        <ExternalLink className="size-2.5 shrink-0 self-center opacity-60" />
      </a>,
    )
    cursor = h.end
  })
  if (cursor < s.length) nodes.push(s.slice(cursor))

  return <>{nodes}</>
}
