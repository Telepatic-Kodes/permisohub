import { fetchWithTimeout } from '@/lib/scraper'
import { reportError, reportWarning } from '@/lib/observability'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'

// ---------------------------------------------------------------------------
// Scraper de terrenos en venta desde Chilepropiedades.cl, por comuna.
//
// HTML server-rendered clásico (tarjetas "clp-publication-result-card").
// URL más simple de las 5 fuentes: /propiedades/venta/terreno/{comuna}/0,
// con el slug de comuna igual al usado en lib/zonificacion-comunas.ts (sin
// transformación adicional).
//
// A diferencia de Portalinmobiliario/Doomos/Yapo, la página de DETALLE de
// Chilepropiedades NO incrusta ningún mapa ni lat/lng (verificado en vivo,
// 31 jul 2026 — sin __NEXT_DATA__, sin iframe de Maps, sin data-lat). El
// título del aviso es lo único disponible como "dirección" para geocoding
// por texto — misma limitación que tenía Portalinmobiliario antes de su fix
// de detalle, así que se espera una tasa de resolución de zona más baja para
// esta fuente en particular (no es un bug, es un límite real de los datos).
//
// Sitio de terceros sin API pública — toda falla degrada a `[]` + warn,
// nunca lanza. Solo primera página por comuna.
// ---------------------------------------------------------------------------


function parsePrecioClp(parteHtml: string, ufValorClp: number): number | null {
  const unidad = parteHtml.match(/valueUnit="\d+">(UF|\$)</)
  const valor = parteHtml.match(/value="([\d.]+)"\s+valueUnit="\d+">[\d.,]+</)
  if (!unidad || !valor) return null

  const monto = Number(valor[1])
  if (!Number.isFinite(monto)) return null

  const clp = unidad[1] === 'UF' ? Math.round(monto * ufValorClp) : Math.round(monto)
  return clp >= PRECIO_CLP_MINIMO_PLAUSIBLE ? clp : null
}

function parseSuperficieLoteM2(parteHtml: string): number | null {
  const m = parteHtml.match(/clp-feature-description">Terreno:<\/span>\s*<span class="clp-feature-value">([\d.,]+)\s*m&sup2;/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseEnlaceYTitulo(parteHtml: string): { url: string; titulo: string } | null {
  const url = parteHtml.match(/data-search-traversal-url="([^"]+)"/)
  const titulo = parteHtml.match(/data-search-traversal-title="([^"]+)"/)
  if (!url || !titulo) return null
  return { url: `https://www.chilepropiedades.cl${url[1]}`, titulo: titulo[1].trim() }
}

function comunaDelListado(parteHtml: string): string | null {
  const m = parteHtml.match(/sub-codigo-data">Venta \/ Terreno \/ ([^<]+)</)
  return m ? m[1].trim() : null
}

function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * Busca terrenos en venta publicados en Chilepropiedades.cl para una comuna
 * cubierta por el motor de zonificación. Nunca lanza.
 */
export async function buscarTerrenos(comunaId: string): Promise<TerrenoListadoRaw[]> {
  const comuna = nombreComuna(comunaId)
  if (!comuna) {
    reportWarning(`Comuna "${comunaId}" no está en la lista soportada — se omite`, { scope: 'scraper.chilepropiedades', extra: { comunaId } })
    return []
  }

  try {
    const url = `https://www.chilepropiedades.cl/propiedades/venta/terreno/${comunaId}/0`
    const res = await fetchWithTimeout(url, {}, 15_000)
    if (!res.ok) {
      reportWarning(`HTTP ${res.status} para "${comunaId}" — se omite esta corrida`, { scope: 'scraper.chilepropiedades', extra: { comunaId, status: res.status } })
      return []
    }

    const html = await res.text()
    const partes = html.split('clp-publication-result-card').slice(1)
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
        fuente: 'chilepropiedades',
        url_aviso: enlace.url,
        precio_clp: parsePrecioClp(parte, ufValor),
        superficie_lote_m2: parseSuperficieLoteM2(parte),
      })
    }

    return items
  } catch (err) {
    reportError(err, { scope: 'scraper.chilepropiedades', extra: { comunaId } })
    return []
  }
}
