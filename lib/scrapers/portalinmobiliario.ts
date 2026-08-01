import { fetchWithTimeout } from '@/lib/scraper'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'

// ---------------------------------------------------------------------------
// Scraper de terrenos ("sitios") en venta desde Portalinmobiliario, por
// comuna. Portalinmobiliario NO ofrece una API pública — a diferencia de
// datos.gob.cl (lib/scrapers/plan-reguladores.ts), esto es HTML de un sitio
// de terceros y puede romperse o bloquearse sin aviso (el propio
// fetchFromPortalTransparencia en ese mismo archivo ya documenta un 403 real
// para automatización). Toda falla acá debe degradar a `[]` + warn, nunca
// lanzar — un cron que corre en background no puede tumbar el resto del job
// por un cambio de HTML upstream.
//
// Solo primera página de resultados por comuna (sin paginación) — suficiente
// para un descubrimiento periódico, no para un scrape exhaustivo del stock.
// ---------------------------------------------------------------------------

function parsePrecioClp(cardHtml: string, ufValorClp: number): number | null {
  const m = cardHtml.match(/class="andes-money-amount[^"]*poly-price__amount[^"]*"[^>]*aria-label="(\d+) ([^"]+)"/)
  if (!m) return null
  const monto = Number(m[1])
  const unidad = m[2]
  if (!Number.isFinite(monto)) return null

  let clp: number | null = null
  if (unidad.includes('fomento')) clp = Math.round(monto * ufValorClp)
  else if (unidad.includes('pesos')) clp = monto
  // dólares u otra unidad: sin fuente de tipo de cambio confiable en este
  // codebase — se deja sin precio en vez de inventar una conversión.

  return clp !== null && clp >= PRECIO_CLP_MINIMO_PLAUSIBLE ? clp : null
}

function parseSuperficieLoteM2(cardHtml: string): number | null {
  const m = cardHtml.match(/poly-attributes_list__item[^"]*">([\d.,]+)\s*m²/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseEnlaceYTitulo(cardHtml: string): { url: string; titulo: string } | null {
  const m = cardHtml.match(/<a href="([^"]+)"[^>]*class="poly-component__title">([^<]+)<\/a>/)
  if (!m) return null
  return {
    url: m[1].split('#')[0].replace(/&amp;/g, '&'),
    titulo: m[2].replace(/&amp;/g, '&').replace(/&#x2F;/g, '/').trim(),
  }
}

function parseUbicacion(cardHtml: string): string | null {
  const m = cardHtml.match(/poly-component__location">([^<]+)</)
  if (!m) return null
  return m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

/**
 * Extrae el lat/lng preciso de la página de DETALLE de un aviso — a
 * diferencia del texto de ubicación en el listado (que suele ser un sector o
 * el título del aviso, no una dirección geocodificable), la página de
 * detalle incrusta un mapa estático de Google Maps con las coordenadas que
 * MercadoLibre ya resolvió internamente:
 * `maps.googleapis.com/maps/api/staticmap?...&center=LAT%2CLNG&...`.
 * Verificado en vivo contra 2 avisos reales de Las Condes (31 jul 2026).
 * Nunca lanza — retorna null ante cualquier fallo (HTTP, HTML sin mapa).
 */
export async function obtenerLatLngDetalle(urlAviso: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetchWithTimeout(urlAviso, {}, 15_000)
    if (!res.ok) return null
    const html = await res.text()

    // La página trae hasta 3 URLs de staticmap repetidas (imagen normal +
    // retina + variantes) — pero pueden NO ser todas del mismo punto: un
    // caso real (Las Condes, 31 jul 2026) tenía un primer staticmap en
    // Colorado, EEUU (probablemente un mapa de preview/OG genérico) y solo
    // el de la sección "Ubicación" (id="ui-vip-location__map") apuntaba al
    // predio real. Nunca tomar "el primer match de la página completa" —
    // acotar la búsqueda a la ventana que sigue a ese contenedor.
    const idxUbicacion = html.indexOf('ui-vip-location__map')
    if (idxUbicacion === -1) return null

    const ventana = html.slice(idxUbicacion, idxUbicacion + 3000)
    const m = ventana.match(/staticmap\?[^"]*center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/)
    if (!m) return null
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    // Sanity check contra el bounding box de Chile continental — visto en
    // vivo: un aviso titulado "Invierte en EEUU" apareció colado en los
    // resultados de "sitio" de Las Condes con coordenadas reales... pero en
    // Colorado, EEUU. No es un error de parseo, es un aviso que no
    // corresponde a un terreno chileno — se descarta en vez de pasarlo a un
    // lookup de zonificación que de todas formas no le va a encontrar zona.
    const dentroDeChile = lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66
    if (!dentroDeChile) {
      console.warn(`[portalinmobiliario] lat/lng fuera de Chile (${lat}, ${lng}) para "${urlAviso}" — probable aviso no chileno, se descarta`)
      return null
    }

    return { lat, lng }
  } catch (err) {
    console.warn(`[portalinmobiliario] No se pudo extraer lat/lng del detalle de "${urlAviso}":`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Busca sitios/terrenos en venta publicados en Portalinmobiliario para una
 * comuna cubierta por el motor de zonificación. Nunca lanza — cualquier
 * fallo (HTTP no-200, bloqueo anti-bot, cambio de HTML) se registra con
 * console.warn y resuelve a un array vacío.
 */
export async function buscarTerrenos(comunaId: string): Promise<TerrenoListadoRaw[]> {
  const comuna = nombreComuna(comunaId)
  if (!comuna) {
    console.warn(`[portalinmobiliario] Comuna "${comunaId}" no está en la lista soportada — se omite`)
    return []
  }

  try {
    const ufValor = await obtenerValorUF()
    const url = `https://www.portalinmobiliario.com/venta/sitio/${comunaId}-metropolitana`
    const res = await fetchWithTimeout(url, {}, 15_000)

    if (!res.ok) {
      console.warn(`[portalinmobiliario] HTTP ${res.status} para "${comunaId}" — se omite esta corrida`)
      return []
    }

    const html = await res.text()
    // Cada resultado vive en un <div class="ui-search-result__wrapper">; el
    // primer elemento del split es el HTML previo al primer resultado.
    const cards = html.split('ui-search-result__wrapper"').slice(1)

    const items: TerrenoListadoRaw[] = []
    for (const card of cards) {
      const enlace = parseEnlaceYTitulo(card)
      const ubicacion = parseUbicacion(card)
      // Sin URL o sin ubicación no hay suficiente información para crear un
      // terreno útil (direccion es NOT NULL) — se descarta ese card.
      if (!enlace || !ubicacion) continue

      items.push({
        direccion: ubicacion,
        comuna,
        fuente: 'portalinmobiliario',
        url_aviso: enlace.url,
        precio_clp: parsePrecioClp(card, ufValor),
        superficie_lote_m2: parseSuperficieLoteM2(card),
      })
    }

    return items
  } catch (err) {
    console.warn(`[portalinmobiliario] Error al buscar terrenos en "${comunaId}":`, err instanceof Error ? err.message : err)
    return []
  }
}
