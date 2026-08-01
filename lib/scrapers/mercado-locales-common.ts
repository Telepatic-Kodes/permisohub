import { createServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Tipos y helpers compartidos del pipeline de mercado de locales comerciales
// (fase 1 de la fusión PROPRA·BI → PermisoHub). Mirror deliberado de
// lib/scrapers/terrenos-common.ts, pero para un dataset GLOBAL (sin
// workspace_id) — ver el comentario en la migración
// 20260802_mercado_locales_listings.sql para el porqué.
//
// IMPORTANTE: MERCADO_LOCALES_COMUNA_SLUGS es un universo de comunas
// DISTINTO de COMUNAS_CON_ZONIFICACION (terrenos-common.ts). Uno cubre las
// comunas donde PROPRA·BI verificó cobertura de locales comerciales en
// Portalinmobiliario (corredores comerciales/oficinas del sector oriente y
// pericentro), el otro las comunas con cobertura de zonificación para
// terrenos (mayoritariamente sur/poniente de la RM). NO fusionar estas dos
// listas "por prolijidad" — sirven a productos distintos.
// ---------------------------------------------------------------------------

export type OperacionMercadoLocal = 'arriendo' | 'venta'

// Verificado a mano contra un fetch en vivo de
// /{operacion}/comercial/{slug}-metropolitana?PROPERTY_TYPE=242065 (242065 =
// facet id interno de MELI para "Locales") — igual que en el repo origen,
// el slug NO es una transliteración mecánica del nombre ("Santiago Centro" es
// "santiago", no "santiago-centro", que cae silenciosamente al resultado
// nacional sin filtrar). Agregar comunas nuevas leyendo el facet `city` de
// una búsqueda sin filtrar, no adivinando el slug.
export const MERCADO_LOCALES_COMUNA_SLUGS: Record<string, string> = {
  'Santiago Centro': 'santiago',
  Providencia: 'providencia',
  'Las Condes': 'las-condes',
  Vitacura: 'vitacura',
  'Lo Barnechea': 'lo-barnechea',
  Ñuñoa: 'nunoa',
  'La Reina': 'la-reina',
  Macul: 'macul',
  Peñalolén: 'penalolen',
  'La Florida': 'la-florida',
  Maipú: 'maipu',
  'San Miguel': 'san-miguel',
  'Estación Central': 'estacion-central',
  Huechuraba: 'huechuraba',
  Quilicura: 'quilicura',
  Recoleta: 'recoleta',
}

export interface MercadoLocalListadoRaw {
  fuente: 'portalinmobiliario'
  fuenteId: string
  url: string
  titulo: string
  operacion: OperacionMercadoLocal
  precioMonto: number | null
  precioMoneda: 'UF' | 'CLP' | null
  superficieM2: number | null
  atributosRaw: Record<string, unknown>
}

export interface UpsertMercadoLocalesSummary {
  comuna: string
  operacion: OperacionMercadoLocal
  scrapeados: number
  nuevos: number
  actualizados: number
  dadosDeBaja: number
  reactivados: number
}

/**
 * Upsert de resultados del scraper de locales comerciales en
 * mercado_locales_listings, con detección de bajas (delisting) — scoped
 * estrictamente a (fuente, comuna, operación) para que un aviso solo se
 * marque "dado_de_baja" cuando ESTA corrida efectivamente re-chequeó esa
 * combinación (mismo razonamiento que diffAndUpsertBatch en el repo origen:
 * nunca dar de baja comunas que el cron de hoy no tocó).
 *
 * El historial de precio NO se inserta acá — lo hace el trigger
 * registrar_historial_precio_mercado_local() en cada INSERT/UPDATE real de
 * precio, así ningún caller nuevo puede "olvidarlo".
 */
export async function upsertMercadoLocalesDesdeListado(
  comuna: string,
  operacion: OperacionMercadoLocal,
  items: MercadoLocalListadoRaw[],
): Promise<UpsertMercadoLocalesSummary> {
  const summary: UpsertMercadoLocalesSummary = {
    comuna,
    operacion,
    scrapeados: items.length,
    nuevos: 0,
    actualizados: 0,
    dadosDeBaja: 0,
    reactivados: 0,
  }
  if (items.length === 0) return summary

  const supabase = createServiceClient()
  const scrapedIds = new Set(items.map((i) => i.fuenteId))

  const { data: before, error: beforeError } = await supabase
    .from('mercado_locales_listings')
    .select('fuente_id, status')
    .eq('fuente', 'portalinmobiliario')
    .eq('comuna', comuna)
    .eq('operacion', operacion)

  if (beforeError) throw new Error(`lectura previa de mercado_locales_listings falló: ${beforeError.message}`)

  const beforeMap = new Map((before ?? []).map((r) => [r.fuente_id as string, r.status as string]))

  const rows = items.map((item) => ({
    fuente: item.fuente,
    fuente_id: item.fuenteId,
    url: item.url,
    titulo: item.titulo,
    operacion: item.operacion,
    comuna,
    precio_monto: item.precioMonto,
    precio_moneda: item.precioMoneda,
    superficie_m2: item.superficieM2,
    atributos_raw: item.atributosRaw,
    status: 'activo',
    ultima_vez_visto_el: new Date().toISOString(),
    dado_de_baja_el: null,
  }))

  const { error: upsertError } = await supabase
    .from('mercado_locales_listings')
    .upsert(rows, { onConflict: 'fuente,fuente_id', ignoreDuplicates: false })

  if (upsertError) throw new Error(`upsert de mercado_locales_listings falló: ${upsertError.message}`)

  for (const item of items) {
    const priorStatus = beforeMap.get(item.fuenteId)
    if (priorStatus === undefined) {
      summary.nuevos++
    } else {
      summary.actualizados++
      if (priorStatus === 'dado_de_baja') summary.reactivados++
    }
  }

  const goneIds = [...beforeMap.entries()]
    .filter(([id, status]) => status === 'activo' && !scrapedIds.has(id))
    .map(([id]) => id)

  if (goneIds.length > 0) {
    const { error: delistError } = await supabase
      .from('mercado_locales_listings')
      .update({ status: 'dado_de_baja', dado_de_baja_el: new Date().toISOString() })
      .eq('fuente', 'portalinmobiliario')
      .eq('comuna', comuna)
      .eq('operacion', operacion)
      .in('fuente_id', goneIds)

    if (delistError) throw new Error(`baja de mercado_locales_listings falló: ${delistError.message}`)
    summary.dadosDeBaja = goneIds.length
  }

  return summary
}
