import { fetchWithTimeout } from '@/lib/scraper'
import { reportError, reportWarning } from '@/lib/observability'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'

// ---------------------------------------------------------------------------
// Scraper de terrenos en venta desde Yapo.cl, por comuna.
//
// HTML server-rendered clásico (tarjetas "d3-ad-tile__*") — confirmado en
// vivo que /bienes-raices-venta-de-propiedades-lotes-y-terrenos/region-metropolitana-{comuna}
// SÍ filtra por comuna real (verificado: 30/30 resultados con
// d3-ad-tile__location = "Las Condes" al pedir esa comuna).
//
// La página de detalle incrusta un iframe de Google Maps Embed con
// coordenadas precisas (?center=lat,lng) — mismo patrón "detalle trae mejor
// lat/lng que el listado" ya visto en Portalinmobiliario y Doomos.
//
// Sitio de terceros sin API pública — toda falla degrada a `[]`/null + warn,
// nunca lanza. Solo primera página (30 resultados) por comuna.
// ---------------------------------------------------------------------------

// El slug de URL de Yapo.cl coincide 1:1 con nuestro comunaId (verificado en
// vivo para las 19 comunas de ZONIFICACION_COMUNAS, 31 jul 2026).
function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function parsePrecioClp(parteHtml: string, ufValorClp: number): number | null {
  const m = parteHtml.match(/d3-ad-tile__price">\s*UF([\d.,]+)\s*<\/div>/)
  if (!m) return null
  const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(monto)) return null
  const clp = Math.round(monto * ufValorClp)
  return clp >= PRECIO_CLP_MINIMO_PLAUSIBLE ? clp : null
}

function parseSuperficieLoteM2(parteHtml: string): number | null {
  const m = parteHtml.match(/([\d.,]+)\s*m<sup>2<\/sup>/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseEnlaceYTitulo(parteHtml: string): { url: string; titulo: string } | null {
  const href = parteHtml.match(/^\s*href="([^"]+)"/)
  const titulo = parteHtml.match(/d3-ad-tile__title">\s*([^<]+?)\s*<\/span>/)
  if (!href || !titulo) return null
  return { url: `https://www.yapo.cl${href[1]}`, titulo: titulo[1].trim() }
}

function comunaDelListado(parteHtml: string): string | null {
  const m = parteHtml.match(/d3-ad-tile__location">\s*<span>\s*(?:<svg[\s\S]*?<\/svg>\s*)?([^<]+?)\s*<\/span>/)
  return m ? m[1].trim() : null
}

/**
 * Busca terrenos en venta publicados en Yapo.cl para una comuna cubierta
 * por el motor de zonificación. Nunca lanza.
 */
export async function buscarTerrenos(comunaId: string): Promise<TerrenoListadoRaw[]> {
  const comuna = nombreComuna(comunaId)
  if (!comuna) {
    reportWarning(`Comuna "${comunaId}" no está en la lista soportada — se omite`, { scope: 'scraper.yapo', extra: { comunaId } })
    return []
  }

  try {
    const url = `https://www.yapo.cl/bienes-raices-venta-de-propiedades-lotes-y-terrenos/region-metropolitana-${comunaId}`
    const res = await fetchWithTimeout(url, {}, 20_000)
    if (!res.ok) {
      reportWarning(`HTTP ${res.status} para "${comunaId}" — se omite esta corrida`, { scope: 'scraper.yapo', extra: { comunaId, status: res.status } })
      return []
    }

    const html = await res.text()
    const partes = html.split('class="d3-ad-tile__description"').slice(1)
    const ufValor = await obtenerValorUF()

    const items: TerrenoListadoRaw[] = []
    for (const parte of partes) {
      const enlace = parseEnlaceYTitulo(parte)
      if (!enlace) continue

      const comunaListado = comunaDelListado(parte)
      if (!comunaListado || normalizarTexto(comunaListado) !== normalizarTexto(comuna)) continue

      items.push({
        direccion: enlace.titulo,
        comuna,
        fuente: 'yapo',
        url_aviso: enlace.url,
        precio_clp: parsePrecioClp(parte, ufValor),
        superficie_lote_m2: parseSuperficieLoteM2(parte),
      })
    }

    return items
  } catch (err) {
    reportError(err, { scope: 'scraper.yapo', extra: { comunaId } })
    return []
  }
}

/**
 * Extrae el lat/lng preciso de la página de DETALLE de un aviso — un iframe
 * de Google Maps Embed con `?center=lat,lng` (verificado en vivo, 31 jul
 * 2026). Nunca lanza — retorna null ante cualquier fallo.
 */
export async function obtenerLatLngDetalle(urlAviso: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetchWithTimeout(urlAviso, {}, 20_000)
    if (!res.ok) return null
    const html = await res.text()
    // Se han visto en vivo 2 variantes del embed de Google Maps en la misma
    // página de detalle, con distinto parámetro de coordenadas:
    // .../v1/view?...center=lat,lng  y  .../v1/place?...q=lat,lng
    const m = html.match(/maps\/embed\/v1\/(?:view|place)\?[^"]*(?:center|q)=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (!m) return null
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    const dentroDeChile = lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66
    if (!dentroDeChile) {
      reportWarning(`lat/lng fuera de Chile (${lat}, ${lng}) para "${urlAviso}" — se descarta`, { scope: 'scraper.yapo', extra: { urlAviso, lat, lng } })
      return null
    }
    return { lat, lng }
  } catch (err) {
    reportError(err, { scope: 'scraper.yapo', extra: { urlAviso } })
    return null
  }
}
