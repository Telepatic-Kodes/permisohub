import { fetchWithTimeout } from '@/lib/scraper'
import type { NoticiaMercadoRaw } from './noticias-common'

// ---------------------------------------------------------------------------
// Port de lib/scrapers/parque-arauco-news.ts (repo origen PROPRA·BI) — fase 2
// de la fusión. Archivo de "Noticias" de relación con inversionistas de
// Parque Arauco — una API JSON limpia (plataforma Modyo), sin scraping/
// captcha/Cloudflare. Comunicados de prensa de primera parte pensados para
// consumo público — sin problema de ToS/legal como los scrapers de
// marketplaces.
//
// Forma de la API:
//   GET .../api/content/spaces/parque-arauco-corporativo/types/noticias/entries
//     ?locale=es&per_page=100&page=N
// La fecha real de publicación vive en fields["Fecha Calendario"]
// (fields.Fecha no se usa / viene null en este tipo de contenido).
// ---------------------------------------------------------------------------

const BASE_URL = 'https://www.parauco.com/api/content/spaces/parque-arauco-corporativo/types/noticias/entries'
const PER_PAGE = 100

export const PARQUE_ARAUCO_SOURCE = 'Parque Arauco (IR)'

interface ModyoEntry {
  fields: {
    Titulo?: string
    'Fecha Calendario'?: string
    Descargable?: { url?: string }
    Enlace?: string
  }
}

interface ModyoResponse {
  entries: ModyoEntry[]
  meta: { total_entries: number }
}

async function fetchPage(page: number): Promise<ModyoResponse> {
  const url = `${BASE_URL}?locale=es&per_page=${PER_PAGE}&page=${page}`
  const res = await fetchWithTimeout(url, {}, 15_000)
  if (!res.ok) throw new Error(`Parque Arauco noticias API fetch falló (${res.status}): page ${page}`)
  return (await res.json()) as ModyoResponse
}

export async function scrapearParqueAraucoNoticias(): Promise<NoticiaMercadoRaw[]> {
  const first = await fetchPage(1)
  const totalPages = Math.max(1, Math.ceil(first.meta.total_entries / PER_PAGE))

  const restPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2)))
  const allEntries = [first, ...restPages].flatMap((r) => r.entries)

  const items: NoticiaMercadoRaw[] = []
  for (const entry of allEntries) {
    const titulo = entry.fields.Titulo?.trim()
    // documentUrl dobla como llave de dedup (noticias_mercado.url es
    // unique) — todo comunicado real en este archivo tiene un PDF
    // descargable; los que no lo tengan (si acaso) no sirven como noticia y
    // se descartan.
    const documentUrl = entry.fields.Descargable?.url ?? null
    if (!titulo || !documentUrl) continue

    const dateRaw = entry.fields['Fecha Calendario']
    const publicadoEl = dateRaw ? new Date(dateRaw) : null

    items.push({
      fuente: PARQUE_ARAUCO_SOURCE,
      fuenteTipo: 'scrape',
      url: documentUrl,
      titulo,
      resumen: null,
      publicadoEl: publicadoEl && !Number.isNaN(publicadoEl.getTime()) ? publicadoEl : null,
    })
  }
  return items
}
