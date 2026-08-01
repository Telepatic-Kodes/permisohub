import { fetchWithTimeout } from '@/lib/scraper'
import { type TerrenoListadoRaw, PRECIO_CLP_MINIMO_PLAUSIBLE, obtenerValorUF, nombreComuna } from './terrenos-common'

// ---------------------------------------------------------------------------
// Scraper de terrenos en venta desde PortalTerreno.cl, por comuna.
//
// A diferencia de Portalinmobiliario, esta página es Next.js e incrusta TODO
// el resultado de la búsqueda como JSON estructurado en
// <script id="__NEXT_DATA__">, incluyendo lat/lng YA resueltos por el sitio
// — no hace falta ni Nominatim ni el truco de la página de detalle que usa
// lib/scrapers/portalinmobiliario.ts. Verificado en vivo (31 jul 2026) contra
// las 4 comunas objetivo.
//
// Igual que Portalinmobiliario: sitio de terceros sin API pública, puede
// romperse o bloquearse sin aviso — toda falla degrada a `[]` + warn, nunca
// lanza. Solo primera página (30 resultados) por comuna.
// ---------------------------------------------------------------------------

// Slugs reales tomados del sitemap del sitio (portalterreno.cl/sitemap-0.xml)
// — el patrón es "{comuna}-{provincia}-region-metropolitana". La provincia
// varía por comuna (no se puede derivar del comunaId), así que este mapeo
// no se puede eliminar como se hizo con Doomos/Yapo — es dato real de ese
// sitio, no redundancia. Puente Alto es la única de las 19 en Provincia
// Cordillera; el resto está en Provincia de Santiago (verificado en vivo,
// 31 jul 2026, contra el sitemap real, no asumido).
const COMUNA_SLUG: Record<string, string> = {
  'las-condes': 'las-condes-santiago-region-metropolitana',
  providencia: 'providencia-santiago-region-metropolitana',
  vitacura: 'vitacura-santiago-region-metropolitana',
  nunoa: 'nunoa-santiago-region-metropolitana',
  'puente-alto': 'puente-alto-cordillera-region-metropolitana',
  'estacion-central': 'estacion-central-santiago-region-metropolitana',
  'la-granja': 'la-granja-santiago-region-metropolitana',
  'lo-espejo': 'lo-espejo-santiago-region-metropolitana',
  'la-cisterna': 'la-cisterna-santiago-region-metropolitana',
  conchali: 'conchali-santiago-region-metropolitana',
  'san-miguel': 'san-miguel-santiago-region-metropolitana',
  macul: 'macul-santiago-region-metropolitana',
  recoleta: 'recoleta-santiago-region-metropolitana',
  'cerro-navia': 'cerro-navia-santiago-region-metropolitana',
  'lo-prado': 'lo-prado-santiago-region-metropolitana',
  'pedro-aguirre-cerda': 'pedro-aguirre-cerda-santiago-region-metropolitana',
  renca: 'renca-santiago-region-metropolitana',
  'san-joaquin': 'san-joaquin-santiago-region-metropolitana',
  independencia: 'independencia-santiago-region-metropolitana',
}

interface PortalTerrenoItem {
  address?: string
  locationName?: string
  title?: string
  slug?: string
  id?: number
  totalSurface?: number
  usefulSurface?: number
  latitude?: number
  longitude?: number
  pricing?: {
    CLP?: { value?: number }
    CLF?: { value?: number }
  }
}

function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// La búsqueda por comuna igual devuelve algunos resultados de comunas
// vecinas (visto en vivo: "las-condes-..." trajo también Paine y Curacaví)
// — se descarta cualquier item cuya locationName no empiece con la comuna
// pedida, comparación sin tildes/mayúsculas.
function esDeLaComuna(item: PortalTerrenoItem, comunaNombre: string): boolean {
  if (!item.locationName) return false
  const comunaDelItem = item.locationName.split(',')[0]?.trim() ?? ''
  return normalizarTexto(comunaDelItem) === normalizarTexto(comunaNombre)
}

async function precioClpDesdeItem(item: PortalTerrenoItem, ufValor: number): Promise<number | null> {
  const clp = item.pricing?.CLP?.value
  if (typeof clp === 'number' && Number.isFinite(clp) && clp >= PRECIO_CLP_MINIMO_PLAUSIBLE) return Math.round(clp)

  const clf = item.pricing?.CLF?.value
  if (typeof clf === 'number' && Number.isFinite(clf)) {
    const convertido = Math.round(clf * ufValor)
    if (convertido >= PRECIO_CLP_MINIMO_PLAUSIBLE) return convertido
  }
  return null
}

/**
 * Busca terrenos en venta publicados en PortalTerreno.cl para una comuna
 * cubierta por el motor de zonificación. Nunca lanza.
 */
export async function buscarTerrenos(comunaId: string): Promise<TerrenoListadoRaw[]> {
  const slug = COMUNA_SLUG[comunaId]
  const comuna = nombreComuna(comunaId)
  if (!slug || !comuna) {
    console.warn(`[portalterreno] Comuna "${comunaId}" no está en la lista soportada — se omite`)
    return []
  }

  try {
    const url = `https://portalterreno.cl/terrenos-en-venta-en-${slug}`
    const res = await fetchWithTimeout(url, {}, 15_000)
    if (!res.ok) {
      console.warn(`[portalterreno] HTTP ${res.status} para "${comunaId}" — se omite esta corrida`)
      return []
    }

    const html = await res.text()
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!m) {
      console.warn(`[portalterreno] No se encontró __NEXT_DATA__ para "${comunaId}" — posible cambio de sitio, se omite`)
      return []
    }

    let json: unknown
    try {
      json = JSON.parse(m[1])
    } catch {
      console.warn(`[portalterreno] __NEXT_DATA__ con JSON inválido para "${comunaId}" — se omite`)
      return []
    }

    const props = json as {
      props?: { pageProps?: { initialState?: { search?: { list?: { properties?: PortalTerrenoItem[] } } } } }
    }
    const properties = props.props?.pageProps?.initialState?.search?.list?.properties
    if (!Array.isArray(properties)) {
      console.warn(`[portalterreno] Forma inesperada de __NEXT_DATA__ para "${comunaId}" — se omite`)
      return []
    }

    const ufValor = await obtenerValorUF()
    const items: TerrenoListadoRaw[] = []

    for (const item of properties) {
      if (!esDeLaComuna(item, comuna)) continue
      if (!item.id || !item.slug) continue

      // "address" suele venir vacío en terrenos rurales/parcelas — se usa el
      // título del aviso como dirección de respaldo (nunca inventar una).
      const direccion = item.address?.trim() || item.title?.trim()
      if (!direccion) continue

      const lat = typeof item.latitude === 'number' && Number.isFinite(item.latitude) ? item.latitude : undefined
      const lng = typeof item.longitude === 'number' && Number.isFinite(item.longitude) ? item.longitude : undefined

      items.push({
        direccion,
        comuna,
        fuente: 'portalterreno',
        url_aviso: `https://portalterreno.cl/proyecto/${item.id}-${item.slug}`,
        precio_clp: await precioClpDesdeItem(item, ufValor),
        superficie_lote_m2: typeof item.totalSurface === 'number' && item.totalSurface > 0 ? item.totalSurface : null,
        ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
      })
    }

    return items
  } catch (err) {
    console.warn(`[portalterreno] Error al buscar terrenos en "${comunaId}":`, err instanceof Error ? err.message : err)
    return []
  }
}
