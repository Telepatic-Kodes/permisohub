import { createServiceClient } from '@/lib/supabase/service'
import { COMUNAS_CHILE } from '@/lib/comunas-chile'

// ---------------------------------------------------------------------------
// Tipos y helpers compartidos del pipeline de noticias de mercado inmobiliario
// (fase 2 de la fusión PROPRA·BI → PermisoHub). Dataset global (sin
// workspace_id), igual que lib/scrapers/mercado-locales-common.ts.
// ---------------------------------------------------------------------------

export type FuenteNoticiaTipo = 'rss' | 'scrape'

export const TIPOS_PROPIEDAD_VALIDOS = ['retail', 'oficina', 'bodega', 'industrial'] as const
export type TipoPropiedadNoticia = (typeof TIPOS_PROPIEDAD_VALIDOS)[number]

// Naive tagger — matches known comuna names and a small set of
// commercial-property-type keywords in the title/summary text. Suficiente
// para filtrar el feed de /mercado-inmobiliario/noticias; no reemplaza NLP
// real de extracción de entidades (mismo criterio que el origen).
const TIPO_KEYWORDS: Record<TipoPropiedadNoticia, string[]> = {
  retail: ['retail', 'strip center', 'mall', 'local comercial', 'locales comerciales'],
  oficina: ['oficina', 'oficinas'],
  bodega: ['bodega', 'bodegas', 'logístic', 'logistic'],
  industrial: ['industrial', 'planta industrial'],
}

export function tagNoticia(titulo: string, resumen: string | null): { comunas: string[]; tiposPropiedad: string[] } {
  const haystack = `${titulo} ${resumen ?? ''}`.toLowerCase()

  const comunas = new Set<string>()
  for (const comuna of COMUNAS_CHILE) {
    if (haystack.includes(comuna.nombre.toLowerCase())) comunas.add(comuna.nombre)
  }

  const tiposPropiedad = new Set<string>()
  for (const [tipo, keywords] of Object.entries(TIPO_KEYWORDS) as [TipoPropiedadNoticia, string[]][]) {
    if (keywords.some((kw) => haystack.includes(kw))) tiposPropiedad.add(tipo)
  }

  return { comunas: [...comunas], tiposPropiedad: [...tiposPropiedad] }
}

export interface NoticiaMercadoRaw {
  fuente: string
  fuenteTipo: FuenteNoticiaTipo
  url: string
  titulo: string
  resumen: string | null
  publicadoEl: Date | null
}

export interface UpsertNoticiasSummary {
  nuevas: number
  duplicadas: number
  fallidas: number
}

/**
 * Upsert de noticias en noticias_mercado, deduplicando por url (índice único
 * en la migración). A diferencia de upsertMercadoLocalesDesdeListado (que sí
 * actualiza filas existentes porque los precios cambian), acá se usa
 * ignoreDuplicates: true — una noticia no cambia una vez ingerida, así que
 * un conflicto en `url` simplemente se salta en vez de sobrescribir
 * ingerido_el/comunas/tipos_propiedad en cada corrida.
 *
 * Nuevas vs. duplicadas se derivan directamente de las filas que PostgREST
 * devuelve: con ignoreDuplicates: true + .select(), las filas que chocaron
 * contra el índice único NO vienen en la respuesta — no hace falta un
 * pre-chequeo de "qué URLs ya existen" (que además falla en corridas
 * grandes: un .in('url', urls) con 100+ URLs completas de PDF supera el
 * límite de largo de query string de PostgREST — visto en vivo con la
 * primera corrida real de Parque Arauco, 171 URLs, "fallidas: 171").
 */
export async function upsertNoticiasMercado(items: NoticiaMercadoRaw[]): Promise<UpsertNoticiasSummary> {
  const summary: UpsertNoticiasSummary = { nuevas: 0, duplicadas: 0, fallidas: 0 }
  if (items.length === 0) return summary

  const supabase = createServiceClient()

  const rows = items.map((item) => {
    const { comunas, tiposPropiedad } = tagNoticia(item.titulo, item.resumen)
    return {
      fuente: item.fuente,
      fuente_tipo: item.fuenteTipo,
      url: item.url,
      titulo: item.titulo,
      resumen: item.resumen,
      publicado_el: item.publicadoEl?.toISOString() ?? null,
      comunas,
      tipos_propiedad: tiposPropiedad,
    }
  })

  const { data: insertadas, error } = await supabase
    .from('noticias_mercado')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
    .select('url')

  if (error) {
    summary.fallidas = items.length
    return summary
  }

  summary.nuevas = insertadas?.length ?? 0
  summary.duplicadas = items.length - summary.nuevas

  return summary
}
