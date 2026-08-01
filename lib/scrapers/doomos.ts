import { fetchWithTimeout } from '@/lib/scraper'
import { reportError, reportWarning } from '@/lib/observability'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'

// ---------------------------------------------------------------------------
// Scraper de terrenos en venta desde Doomos.cl, por comuna.
//
// A diferencia de PortalTerreno (JSON estructurado en __NEXT_DATA__), Doomos
// es HTML clásico server-rendered sin ningún blob de datos — cada resultado
// vive en un <div class="row white ...">, con contenido DUPLICADO para
// mobile/desktop (hidden-xs/hidden-sm vs hidden-md/hidden-lg), por eso varios
// campos aparecen 2 veces por listado y solo se toma la primera ocurrencia.
//
// La página de detalle SÍ trae lat/lng preciso en
// <div id="map4" data-lat="..." data-lng="...">, verificado en vivo (31 jul
// 2026) — mismo patrón que obtenerLatLngDetalle de Portalinmobiliario.
//
// Sitio de terceros sin API pública — toda falla degrada a `[]`/null + warn,
// nunca lanza. Solo primera página por comuna.
// ---------------------------------------------------------------------------

// El slug de URL de Doomos.cl coincide 1:1 con nuestro comunaId (verificado
// en vivo para las 19 comunas de ZONIFICACION_COMUNAS, 31 jul 2026) — no
// hace falta un mapeo aparte.
function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function parsePrecioClp(parteHtml: string, ufValorClp: number): number | null {
  const m = parteHtml.match(/<p>UF\.\s*([\d.,]+)<\/p>/)
  if (!m) return null
  const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(monto)) return null
  const clp = Math.round(monto * ufValorClp)
  return clp >= PRECIO_CLP_MINIMO_PLAUSIBLE ? clp : null
}

function parseSuperficieLoteM2(parteHtml: string): number | null {
  const m = parteHtml.match(/info-line">([\d.]+)\s*m²/)
  if (!m) return null
  // A diferencia de Portalinmobiliario/PortalTerreno (formato chileno,
  // "." como separador de miles: "5.124"), Doomos usa "." como separador
  // DECIMAL con siempre 2 decimales ("7000.00" = 7000, no 700000) — visto
  // en vivo en las 4 comunas. Bug real detectado: tratar el "." como miles
  // acá infla la superficie x100 (7000.00 → 700000).
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

function parseEnlaceYTitulo(parteHtml: string): { url: string; titulo: string } | null {
  const m = parteHtml.match(/href="(https:\/\/www\.doomos\.cl\/de\/\d+_[^"]+)"[^>]*>([^<]+)<\/a>/)
  if (!m) return null
  return { url: m[1], titulo: m[2].trim() }
}

// "Terreno - Región Metropolitana - Las Condes" → última parte es la comuna.
// Se descarta cualquier resultado cuya comuna no calce con la pedida — la
// URL por comuna de Doomos ha sido consistente en pruebas en vivo, pero
// nunca confiar en eso sin verificar (mismo principio que portalterreno.ts).
function comunaDelListado(parteHtml: string): string | null {
  const m = parteHtml.match(/team-color">([^<]*-[^<]*)</)
  if (!m) return null
  const segmentos = m[1].split('-').map((s) => s.trim())
  return segmentos[segmentos.length - 1] || null
}

/**
 * Busca terrenos en venta publicados en Doomos.cl para una comuna cubierta
 * por el motor de zonificación. Nunca lanza.
 */
export async function buscarTerrenos(comunaId: string): Promise<TerrenoListadoRaw[]> {
  const comuna = nombreComuna(comunaId)
  if (!comuna) {
    reportWarning(`Comuna "${comunaId}" no está en la lista soportada — se omite`, { scope: 'scraper.doomos', extra: { comunaId } })
    return []
  }

  try {
    // Timeout más alto que el resto de los scrapers (15s) — Doomos.cl es
    // consistentemente más lento en vivo (~20-30s para comunas con más
    // resultados/publicidad, verificado 31 jul 2026 con "Las Condes" y
    // "Providencia" fallando repetidamente a 15s).
    const url = `https://www.doomos.cl/venta-terrenos-${comunaId}`
    const res = await fetchWithTimeout(url, {}, 30_000)
    if (!res.ok) {
      reportWarning(`HTTP ${res.status} para "${comunaId}" — se omite esta corrida`, { scope: 'scraper.doomos', extra: { comunaId, status: res.status } })
      return []
    }

    const html = await res.text()
    const partes = html.split('class="row white').slice(1)
    const ufValor = await obtenerValorUF()

    const items: TerrenoListadoRaw[] = []
    for (const parte of partes) {
      const enlace = parseEnlaceYTitulo(parte)
      if (!enlace) continue // partes sin "/de/{id}_" no son un listado real (carruseles, wrappers anidados)

      const comunaListado = comunaDelListado(parte)
      if (!comunaListado || normalizarTexto(comunaListado) !== normalizarTexto(comuna)) continue

      items.push({
        direccion: enlace.titulo,
        comuna,
        fuente: 'doomos',
        url_aviso: enlace.url,
        precio_clp: parsePrecioClp(parte, ufValor),
        superficie_lote_m2: parseSuperficieLoteM2(parte),
      })
    }

    return items
  } catch (err) {
    reportError(err, { scope: 'scraper.doomos', extra: { comunaId } })
    return []
  }
}

/**
 * Extrae el lat/lng preciso de la página de DETALLE de un aviso —
 * <div id="map4" data-lat="..." data-lng="..."> (verificado en vivo, 31 jul
 * 2026). Nunca lanza — retorna null ante cualquier fallo.
 */
export async function obtenerLatLngDetalle(urlAviso: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetchWithTimeout(urlAviso, {}, 30_000)
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/data-lat="(-?\d+\.?\d*)"\s+data-lng="(-?\d+\.?\d*)"/)
    if (!m) return null
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    const dentroDeChile = lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66
    if (!dentroDeChile) {
      reportWarning(`lat/lng fuera de Chile (${lat}, ${lng}) para "${urlAviso}" — se descarta`, { scope: 'scraper.doomos', extra: { urlAviso, lat, lng } })
      return null
    }
    return { lat, lng }
  } catch (err) {
    reportError(err, { scope: 'scraper.doomos', extra: { urlAviso } })
    return null
  }
}
