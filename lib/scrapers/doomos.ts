import { fetchWithTimeout } from '@/lib/scraper'
import { reportError, reportWarning } from '@/lib/observability'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'
import {
  MERCADO_LOCALES_COMUNA_SLUGS,
  TIPO_PROPIEDAD_DEFAULT,
  precioMercadoLocalEsPlausible,
  ScraperUnavailableError,
  type MercadoLocalListadoRaw,
  type OperacionMercadoLocal,
  type TipoPropiedadComercial,
} from './mercado-locales-common'

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
// Sitio de terceros sin API pública. Solo primera página por comuna.
//
// MANEJO DE FALLOS — asimétrico a propósito desde el 05-08:
//   - buscarTerrenos()/obtenerLatLngDetalle(): degradan a []/null + warn, no
//     lanzan (su caller, correrDescubrimientoTerrenos, todavía no distingue
//     "no pude buscar" de "no hay" — misma deuda, sin cerrar).
//   - buscarLocalesComerciales(): LANZA ScraperUnavailableError ante HTTP
//     no-2xx o error de red. Devolver [] hacía que un scraper caído se
//     archivara como una corrida exitosa con cero filas. Ver el comentario de
//     ScraperUnavailableError en mercado-locales-common.ts.
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

// ---------------------------------------------------------------------------
// Segunda fuente para mercado_locales_listings (04-08) — mismo dominio y
// misma estructura de tarjeta HTML ("row white", <a href="/de/{id}_...">)
// que buscarTerrenos() arriba, verificado en vivo contra
// arriendo-locales-comerciales-providencia (17 tarjetas) y
// venta-locales-comerciales-providencia (17 tarjetas): reusa
// parseEnlaceYTitulo/comunaDelListado sin cambios. A diferencia de
// Portalinmobiliario (widget de precio estructurado con moneda/fracción/
// centavos en spans separados), acá el precio es texto plano en uno de dos
// formatos — "<p>UF. 300</p>" o "<p>$ 450.000</p>" — nunca ambos en la misma
// tarjeta (verificado). Los slugs de MERCADO_LOCALES_COMUNA_SLUGS
// (compartidos con Portalinmobiliario) calzan 1:1 con las URLs de Doomos —
// probado en vivo incluso para comunas fuera de ZONIFICACION_COMUNAS
// (Lampa, Buin, Padre Hurtado, Cerrillos, El Bosque), así que no hace falta
// un mapeo de slugs propio.
//
// Impureza de categoría conocida (verificado en vivo, 04-08): en comunas de
// baja densidad comercial (ej. La Granja), Doomos rellena la página de
// "venta-locales-comerciales-{comuna}" con avisos de casas/sitios/parcelas
// cuando no hay suficientes locales reales — ~9% de los avisos guardados
// (40/435 en la corrida de verificación) tienen "casa"/"sitio"/"parcela" en
// el título. No se filtra por palabra clave en el título: el riesgo de
// descartar un local comercial real cuyo título las mencione (ej. "casa
// comercial") es peor que el ruido — mismo criterio que la impureza ya
// tolerada de "industrial" trayendo alguna oficina mezclada. Límite real de
// la fuente, no un bug de parseo — igual que el caso de chilepropiedades en
// terrenos.
// ---------------------------------------------------------------------------

// Segmento de URL por tipo de propiedad — verificado en vivo (04-08):
// "industrial" solo devuelve resultados reales en comunas con parques
// industriales (ej. Quilicura, 21 tarjetas); en comunas sin ese perfil
// (ej. Providencia) el HTTP 200 sigue siendo válido, simplemente con 0
// tarjetas — no es un indicio de slug equivocado.
const DOOMOS_TIPO_PROPIEDAD_PATH: Record<TipoPropiedadComercial, string> = {
  local_comercial: 'locales-comerciales',
  oficina: 'oficinas',
  bodega: 'bodegas',
  industrial: 'industrial',
}

function parsePrecioMercadoLocalDoomos(cardHtml: string): { monto: number; moneda: 'UF' | 'CLP' } | null {
  const uf = cardHtml.match(/<p>UF\.\s*([\d.,]+)<\/p>/)
  if (uf) {
    const monto = parseFloat(uf[1].replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(monto) ? { monto, moneda: 'UF' } : null
  }
  const clp = cardHtml.match(/<p>\$\s*([\d.,]+)<\/p>/)
  if (clp) {
    const monto = parseFloat(clp[1].replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(monto) ? { monto, moneda: 'CLP' } : null
  }
  return null
}

// Mismo formato "." = separador decimal (nunca miles) que
// parseSuperficieLoteM2() de terrenos arriba — confirmado en las tarjetas
// de mercado_locales también ("2500.00", "211.00").
function parseSuperficieM2MercadoLocal(cardHtml: string): number | null {
  const m = cardHtml.match(/info-line">([\d.,]+)\s*m/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

function parseCardMercadoLocalDoomos(
  cardHtml: string,
  comunaEsperada: string,
  operacion: OperacionMercadoLocal,
): MercadoLocalListadoRaw | null {
  const enlace = parseEnlaceYTitulo(cardHtml)
  if (!enlace) return null // tarjetas sin "/de/{id}_" no son un listado real (carruseles, publicidad)

  const comunaListado = comunaDelListado(cardHtml)
  if (!comunaListado || normalizarTexto(comunaListado) !== normalizarTexto(comunaEsperada)) return null

  const idMatch = enlace.url.match(/\/de\/(\d+)_/)
  if (!idMatch) return null
  const fuenteId = `DM-${idMatch[1]}`

  const precio = parsePrecioMercadoLocalDoomos(cardHtml)
  const superficieM2 = parseSuperficieM2MercadoLocal(cardHtml)
  const precioPlausible = precio && precioMercadoLocalEsPlausible(precio.monto, precio.moneda, operacion)

  return {
    fuente: 'doomos',
    fuenteId,
    url: enlace.url,
    titulo: enlace.titulo,
    operacion,
    precioMonto: precioPlausible ? precio!.monto : null,
    precioMoneda: precioPlausible ? precio!.moneda : null,
    superficieM2,
    atributosRaw: { headline: null, locationText: comunaListado },
  }
}

/**
 * Busca propiedades comerciales (arriendo o venta) publicadas en Doomos.cl
 * para una comuna de MERCADO_LOCALES_COMUNA_SLUGS, del tipo indicado
 * (default local_comercial). Nunca lanza — cualquier fallo degrada a `[]` +
 * reportWarning, mismo contrato que buscarTerrenos() y el equivalente de
 * Portalinmobiliario.
 */
export async function buscarLocalesComerciales(
  comuna: string,
  operacion: OperacionMercadoLocal,
  tipoPropiedad: TipoPropiedadComercial = TIPO_PROPIEDAD_DEFAULT,
): Promise<MercadoLocalListadoRaw[]> {
  const slug = MERCADO_LOCALES_COMUNA_SLUGS[comuna]
  if (!slug) {
    reportWarning(`Comuna "${comuna}" no está en MERCADO_LOCALES_COMUNA_SLUGS — se omite`, { scope: 'scraper.doomos', extra: { comuna } })
    return []
  }

  try {
    const pathSegment = DOOMOS_TIPO_PROPIEDAD_PATH[tipoPropiedad]
    const url = `https://www.doomos.cl/${operacion}-${pathSegment}-${slug}`
    const res = await fetchWithTimeout(url, {}, 30_000)
    if (!res.ok) {
      // LANZA, no devuelve []: un HTTP no-2xx significa "no pude buscar", y
      // devolver la lista vacía lo hacía indistinguible de "no hay locales en
      // esta comuna" — ver ScraperUnavailableError para el incidente que lo
      // destapó. El caller (correrDescubrimientoMercadoLocales) ya tiene un
      // try/catch por par comuna×operación, así que esto NO tumba la corrida:
      // solo la vuelve contable.
      throw new ScraperUnavailableError('Doomos', `HTTP ${res.status} para ${tipoPropiedad} en "${comuna}" (${operacion})`)
    }

    // Mismo chequeo de redirect que Portalinmobiliario (ver ahí el incidente
    // que lo motivó). Acá el patrón de URL es `/{operacion}-{tipo}-{slug}`, así
    // que basta con que la operación siga presente en el path final.
    const destino = new URL(res.url).pathname
    if (!destino.includes(operacion)) {
      throw new ScraperUnavailableError(
        'Doomos',
        `redirigido fuera del listado (${destino}) para ${tipoPropiedad} en "${comuna}" (${operacion})`
      )
    }

    const html = await res.text()
    const cards = html.split('class="row white').slice(1)

    const items: MercadoLocalListadoRaw[] = []
    const vistos = new Set<string>()
    for (const card of cards) {
      const parsed = parseCardMercadoLocalDoomos(card, comuna, operacion)
      if (parsed && !vistos.has(parsed.fuenteId)) {
        vistos.add(parsed.fuenteId)
        items.push(parsed)
      }
    }

    return items
  } catch (err) {
    reportError(err, { scope: 'scraper.doomos', extra: { comuna, tipoPropiedad, operacion } })
    // Se reporta a Sentry Y se propaga. Antes solo se reportaba: el error
    // quedaba visible en Sentry pero la corrida seguía y se archivaba como
    // exitosa con cero filas, así que las dos señales se contradecían y la
    // que quedaba en la base era la equivocada.
    if (err instanceof ScraperUnavailableError) throw err
    throw new ScraperUnavailableError('Doomos', err instanceof Error ? err.message : String(err))
  }
}
