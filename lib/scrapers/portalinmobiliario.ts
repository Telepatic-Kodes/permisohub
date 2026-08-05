import { fetchWithTimeout } from '@/lib/scraper'
import { reportError, reportWarning } from '@/lib/observability'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'
import {
  type MercadoLocalListadoRaw,
  type OperacionMercadoLocal,
  type TipoPropiedadComercial,
  MERCADO_LOCALES_COMUNA_SLUGS,
  TIPO_PROPIEDAD_PORTAL_PATH,
  TIPO_PROPIEDAD_DEFAULT,
  precioMercadoLocalEsPlausible,
  ScraperUnavailableError,
} from './mercado-locales-common'

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
      reportWarning(`lat/lng fuera de Chile (${lat}, ${lng}) para "${urlAviso}" — probable aviso no chileno, se descarta`, { scope: 'scraper.portalinmobiliario', extra: { urlAviso, lat, lng } })
      return null
    }

    return { lat, lng }
  } catch (err) {
    reportError(err, { scope: 'scraper.portalinmobiliario', extra: { urlAviso } })
    return null
  }
}

/**
 * Busca sitios/terrenos en venta publicados en Portalinmobiliario para una
 * comuna cubierta por el motor de zonificación. Nunca lanza — cualquier
 * fallo (HTTP no-200, bloqueo anti-bot, cambio de HTML) se registra con
 * reportWarning y resuelve a un array vacío.
 */
export async function buscarTerrenos(comunaId: string): Promise<TerrenoListadoRaw[]> {
  const comuna = nombreComuna(comunaId)
  if (!comuna) {
    reportWarning(`Comuna "${comunaId}" no está en la lista soportada — se omite`, { scope: 'scraper.portalinmobiliario', extra: { comunaId } })
    return []
  }

  try {
    const ufValor = await obtenerValorUF()
    const url = `https://www.portalinmobiliario.com/venta/sitio/${comunaId}-metropolitana`
    const res = await fetchWithTimeout(url, {}, 15_000)

    if (!res.ok) {
      reportWarning(`HTTP ${res.status} para "${comunaId}" — se omite esta corrida`, { scope: 'scraper.portalinmobiliario', extra: { comunaId, status: res.status } })
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
    reportError(err, { scope: 'scraper.portalinmobiliario', extra: { comunaId } })
    return []
  }
}

// ---------------------------------------------------------------------------
// Scraper de locales comerciales (arriendo/venta) desde Portalinmobiliario —
// fase 1 de la fusión PROPRA·BI → PermisoHub. Apunta a la faceta
// "/comercial/" con PROPERTY_TYPE=242065 (id interno de MELI para
// "Locales"), verificada en vivo contra un fetch real (31 jul 2026): el
// conteo de "N resultados" de la respuesta coincidió con el propio conteo
// que el facet advierte, confirmando que el filtro aplica server-side.
//
// El HTML de este listado tiene una estructura de card DISTINTA a la de
// `buscarTerrenos` de arriba (boundary <li class="ui-search-layout__item">,
// widget de precio "poly-price__current" con spans de fracción/centavos
// separados) — comparten solo fetchWithTimeout, no forzar un parser único.
// Mismo contrato de nunca lanzar: cualquier falla degrada a `[]` + warn.
// ---------------------------------------------------------------------------

const LOCALES_PROPERTY_TYPE_ID = '242065'

function decodeEntitiesMercadoLocal(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

// A diferencia de parsePrecioClp (que lee el aria-label del widget de
// terrenos), acá se lee el número visible en "poly-price__current" — el
// aria-label es texto libre ("14 unidades de fomento con 20 centavos")
// mientras las spans de fracción/centavos son números estructurados. El "."
// en la fracción es separador de miles (formato chileno), nunca un decimal.
function parsePrecioMercadoLocal(cardHtml: string): { monto: number; moneda: string } | null {
  const bloqueMatch = cardHtml.match(/poly-price__current">([\s\S]*?)<\/div><\/div>/)
  const bloque = bloqueMatch ? bloqueMatch[1] : cardHtml

  const monedaMatch = bloque.match(/currency-symbol">([^<]+)</)
  const fraccionMatch = bloque.match(/__fraction"[^>]*>([\d.,]+)</)
  if (!monedaMatch || !fraccionMatch) return null

  const centavosMatch = bloque.match(/__cents[^"]*"[^>]*>(\d+)</)
  const parteEntera = parseInt(fraccionMatch[1].replace(/\./g, '').replace(',', ''), 10)
  if (!Number.isFinite(parteEntera)) return null

  const centavos = centavosMatch ? parseInt(centavosMatch[1], 10) / 100 : 0
  const monedaTexto = monedaMatch[1].trim()
  // Normalizado a 'UF' | 'CLP' al parsear — mercado_locales_listings.precio_moneda
  // solo acepta esos dos valores (CHECK constraint), nunca el símbolo crudo del portal.
  const moneda = monedaTexto.toUpperCase().includes('UF') ? 'UF' : monedaTexto === '$' ? 'CLP' : monedaTexto
  return { monto: parteEntera + centavos, moneda }
}

function parseSuperficieM2MercadoLocal(cardHtml: string): number | null {
  const items = [...cardHtml.matchAll(/poly-attributes_list__item[^"]*">([^<]+)</g)].map((m) => m[1])
  for (const item of items) {
    const m = item.match(/([\d.,]+)\s*m[²2]/i)
    if (m) {
      const valor = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
      if (Number.isFinite(valor)) return valor
    }
  }
  return null
}

function parseCardMercadoLocal(
  cardHtml: string,
  operacion: OperacionMercadoLocal,
): MercadoLocalListadoRaw | null {
  const tituloMatch = cardHtml.match(/<a href="([^"]+)"[^>]*class="poly-component__title">([^<]+)<\/a>/)
  if (!tituloMatch) return null

  const url = decodeEntitiesMercadoLocal(tituloMatch[1]).split('#')[0]
  const titulo = decodeEntitiesMercadoLocal(tituloMatch[2])

  const idMatch = url.match(/MLC-(\d+)-/)
  if (!idMatch) return null
  const fuenteId = `MLC-${idMatch[1]}`

  const precio = parsePrecioMercadoLocal(cardHtml)
  const superficieM2 = parseSuperficieM2MercadoLocal(cardHtml)
  const headlineMatch = cardHtml.match(/poly-component__headline">([^<]+)</)
  const ubicacionMatch = cardHtml.match(/poly-component__location">([^<]+)</)

  // precio_moneda solo se persiste si viene normalizado a UF/CLP — cualquier
  // otra unidad (USD, u otra que MELI muestre) queda sin precio_moneda en
  // vez de forzar un valor que la BD rechazaría. Además, un precio
  // normalizado que no pasa el piso de plausibilidad (ver
  // precioMercadoLocalEsPlausible) también queda en null — mismo criterio:
  // sin dato verificable, no un número inventado.
  const monedaNormalizada = precio && (precio.moneda === 'UF' || precio.moneda === 'CLP') ? precio.moneda : null
  const precioPlausible = precio && monedaNormalizada && precioMercadoLocalEsPlausible(precio.monto, monedaNormalizada, operacion)

  return {
    fuente: 'portalinmobiliario',
    fuenteId,
    url,
    titulo,
    operacion,
    precioMonto: precioPlausible ? precio!.monto : null,
    precioMoneda: precioPlausible ? monedaNormalizada : null,
    superficieM2,
    atributosRaw: {
      headline: headlineMatch ? decodeEntitiesMercadoLocal(headlineMatch[1]) : null,
      locationText: ubicacionMatch ? decodeEntitiesMercadoLocal(ubicacionMatch[1]) : null,
    },
  }
}

/**
 * Busca propiedades comerciales (arriendo o venta) publicadas en
 * Portalinmobiliario para una comuna cubierta por
 * MERCADO_LOCALES_COMUNA_SLUGS, para el tipo de propiedad indicado (default
 * local_comercial, preservando el comportamiento original de esta función
 * para el cron diario existente). Nunca lanza — cualquier fallo degrada a
 * `[]` + reportWarning, igual que buscarTerrenos.
 *
 * Fase 8: el segmento de URL cambia según tipoPropiedad
 * (TIPO_PROPIEDAD_PORTAL_PATH) — verificado en vivo que oficina/bodega/
 * industrial son sub-categorías con su propio segmento (`/oficina/`, etc.),
 * a diferencia de local_comercial que vive bajo el segmento genérico
 * `/comercial/` y necesita el query param ?PROPERTY_TYPE= explícito para no
 * traer las demás sub-categorías mezcladas.
 */
export async function buscarLocalesComerciales(
  comuna: string,
  operacion: OperacionMercadoLocal,
  tipoPropiedad: TipoPropiedadComercial = TIPO_PROPIEDAD_DEFAULT,
): Promise<MercadoLocalListadoRaw[]> {
  const slug = MERCADO_LOCALES_COMUNA_SLUGS[comuna]
  if (!slug) {
    reportWarning(`Comuna "${comuna}" no está en MERCADO_LOCALES_COMUNA_SLUGS — se omite`, { scope: 'scraper.portalinmobiliario', extra: { comuna } })
    return []
  }

  try {
    const pathSegment = TIPO_PROPIEDAD_PORTAL_PATH[tipoPropiedad]
    const queryParam = tipoPropiedad === 'local_comercial' ? `?PROPERTY_TYPE=${LOCALES_PROPERTY_TYPE_ID}` : ''
    const url = `https://www.portalinmobiliario.com/${operacion}/${pathSegment}/${slug}-metropolitana${queryParam}`
    const res = await fetchWithTimeout(url, {}, 20_000)

    if (!res.ok) {
      // LANZA, no devuelve []: ver ScraperUnavailableError. Esta fuente es la
      // que motivó el cambio tanto como Doomos — el 5 ago registró 2.408
      // filas a las 02:23 y horas después devolvía 0 items en Providencia,
      // Las Condes y Santiago Centro, sin que nada quedara registrado.
      throw new ScraperUnavailableError('Portalinmobiliario', `HTTP ${res.status} para ${tipoPropiedad} en "${comuna}" (${operacion})`)
    }

    // Bloqueo suave, verificado en vivo el 05-08: MercadoLibre responde 302
    // hacia /gz/account-verification y, como fetch() sigue redirects por
    // defecto, `res.ok` termina siendo true sobre 19 KB de página de desafío
    // sin una sola tarjeta. Sin este chequeo, "me bloquearon" entraba al
    // sistema como "no hay locales en arriendo en toda la RM" — que es la
    // forma más cara de estar equivocado, porque es plausible.
    const destino = new URL(res.url).pathname
    if (!destino.includes(`/${operacion}/`)) {
      throw new ScraperUnavailableError(
        'Portalinmobiliario',
        `redirigido fuera del listado (${destino}) para ${tipoPropiedad} en "${comuna}" (${operacion}) — bloqueo suave o verificación de cuenta`
      )
    }

    const html = await res.text()
    const cards = html.split('<li class="ui-search-layout__item">').slice(1)

    const items: MercadoLocalListadoRaw[] = []
    const vistos = new Set<string>()
    for (const card of cards) {
      const parsed = parseCardMercadoLocal(card, operacion)
      // MELI inyecta cards patrocinadas/duplicadas dentro de una misma
      // página — deduplicar por fuenteId acá evita un falso "cambió de
      // precio dos veces en una corrida" en el paso de diff.
      if (parsed && !vistos.has(parsed.fuenteId)) {
        vistos.add(parsed.fuenteId)
        items.push(parsed)
      }
    }

    return items
  } catch (err) {
    reportError(err, { scope: 'scraper.portalinmobiliario', extra: { comuna, tipoPropiedad, operacion } })
    if (err instanceof ScraperUnavailableError) throw err
    throw new ScraperUnavailableError('Portalinmobiliario', err instanceof Error ? err.message : String(err))
  }
}
