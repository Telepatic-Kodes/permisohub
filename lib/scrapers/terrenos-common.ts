import { createServiceClient } from '@/lib/supabase/service'
import { UF_FALLBACK_CLP } from '@/lib/uf'
import { getComunasConCobertura } from '@/lib/zonificacion-comunas'
import { COMUNAS_CHILE } from '@/lib/comunas-chile'

// ---------------------------------------------------------------------------
// Tipos y helpers compartidos entre los scrapers de terrenos (Portalinmobiliario,
// PortalTerreno, y los que se agreguen después) — cada fuente tiene su propio
// parser de HTML/JSON en su propio archivo (lib/scrapers/portal-x.ts), pero
// todos convergen a esta misma forma antes de persistir en `terrenos`.
// ---------------------------------------------------------------------------

export type FuenteTerreno = 'portalinmobiliario' | 'portalterreno' | 'doomos' | 'yapo' | 'chilepropiedades'

export interface TerrenoListadoRaw {
  direccion: string
  comuna: string
  fuente: FuenteTerreno
  url_aviso: string
  precio_clp: number | null
  superficie_lote_m2: number | null
  // Algunas fuentes (ej. PortalTerreno) entregan lat/lng ya resuelto en su
  // propio JSON — cuando está presente, enriquecerTerreno (lib/terrenos-server.ts)
  // se lo salta a Nominatim/geocoding por texto por completo.
  lat?: number
  lng?: number
}

// Única fuente de verdad para "qué comunas buscamos" — se deriva del registro
// real de cobertura de zonificación (lib/zonificacion-comunas.ts) en vez de
// mantener una lista aparte en cada uno de los 5 scrapers/rutas de cron, que
// se desincronizaría la primera vez que alguien agregue una comuna y se
// olvide de un archivo (pasó exactamente eso — ver conversación 31 jul 2026,
// "amplía el alcance en las comunas" — antes de esto había 4 listas hardcodeadas).
export const COMUNAS_CON_ZONIFICACION: string[] = getComunasConCobertura().map((c) => c.comunaId)

/** Nombre de despliegue ("Puente Alto") para un comunaId ("puente-alto"), o null si no está en el catálogo. */
export function nombreComuna(comunaId: string): string | null {
  return COMUNAS_CHILE.find((c) => c.id === comunaId)?.nombre ?? null
}

// Bajo este monto, un precio "parseado" es casi con certeza un match erróneo
// y no un terreno real barato — visto en vivo en Portalinmobiliario: un card
// con aria-label "16 unidades de fomento con 50 centavos" en un sitio de
// 5.200 m², claramente no el precio real.
export const PRECIO_CLP_MINIMO_PLAUSIBLE = 1_000_000

export async function obtenerValorUF(): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
    const res = await fetch(`${baseUrl}/api/utils/uf`)
    const data = await res.json() as { valor?: number }
    return data.valor ?? UF_FALLBACK_CLP
  } catch {
    return UF_FALLBACK_CLP
  }
}

/**
 * Upsert de resultados de cualquier scraper de terrenos en `terrenos`,
 * deduplicando por url_aviso (índice único en la migración) para que
 * corridas repetidas del cron no dupliquen el mismo aviso. No toca zona_*
 * de filas existentes — solo los campos de listado.
 */
export async function upsertTerrenosDesdeListado(
  items: TerrenoListadoRaw[],
  workspaceId: string,
): Promise<{ ids: string[] }> {
  if (items.length === 0) return { ids: [] }

  const supabase = createServiceClient()
  const rows = items.map((item) => ({
    workspace_id: workspaceId,
    direccion: item.direccion,
    comuna: item.comuna,
    fuente: item.fuente,
    url_aviso: item.url_aviso,
    precio_clp: item.precio_clp,
    superficie_lote_m2: item.superficie_lote_m2,
    ...(item.lat !== undefined && item.lng !== undefined ? { lat: item.lat, lng: item.lng } : {}),
  }))

  const { data, error } = await supabase
    .from('terrenos')
    .upsert(rows, { onConflict: 'url_aviso', ignoreDuplicates: false })
    .select('id')

  if (error) throw new Error(`upsert de terrenos falló: ${error.message}`)
  return { ids: (data ?? []).map((r) => r.id as string) }
}
