import { fetchWithTimeout } from '@/lib/scraper'

// ---------------------------------------------------------------------------
// Señales de ubicación para detectar oportunidades de compra orientadas a
// desarrollo comercial (conversación 1 ago 2026): ¿está cerca de una vía de
// alto flujo? ¿hay anchors comerciales (mall, supermercado, department store)
// ya instalados cerca? Ninguno de los 5 scrapers ni SII trae esto — se
// consulta contra OpenStreetMap (Overpass API), la única fuente gratuita con
// cobertura razonable de comercio + vialidad en Chile.
//
// Overpass es un recurso público compartido (misma familia OSM que Nominatim,
// ver lib/geocoding.ts) — mismo throttle defensivo, nunca lanzar, degradar a
// null ante cualquier fallo.
// ---------------------------------------------------------------------------

export interface SenalesUbicacion {
  cercaAvenidaPrincipal: boolean
  anchorsComercialesCercanos: number
}

const RADIO_ANCHORS_M = 1000
const RADIO_AVENIDA_M = 300

// Verificado en vivo (1 ago 2026, GET /api/status): la instancia pública de
// Overpass da solo 2 "slots" por IP anónima, que se regeneran cada ~20-30s —
// mucho más lento que un throttle ingenuo de 2s entre requests. Un backfill
// masivo secuencial a 2s/req agotaba el quota en <1 min y empezaba a recibir
// 429 sostenido. 5s de piso + backoff-y-reintento en 429 (abajo) es el
// balance entre no abusar del recurso compartido y no ser desesperantemente
// lento en uso puntual (botón "Actualizar").
let lastRequestAt = 0
const MIN_INTERVAL_MS = 5000
const RATE_LIMIT_BACKOFF_MS = 20_000

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastRequestAt = Date.now()
}

interface OverpassCountElement {
  type: 'count'
  tags?: { total?: string }
}

// Señal explícita de "el servicio está temporalmente no disponible" (429
// sostenido, timeout de red, conexión rechazada — verificado en vivo: un
// bloqueo de IP tras una corrida masiva se manifiesta como fetch() lanzando,
// no como un status HTTP) — distinta de un fallo de PARSEO genuino (200 con
// forma de respuesta inesperada). El caller (enriquecerTerreno) debe tratar
// esto como "reintentar después", nunca como ubicacion_status='error'
// permanente: nada de esto dice algo sobre el terreno, solo sobre el momento.
export class OverpassUnavailableError extends Error {
  constructor(reason: string) {
    super(`Overpass no disponible: ${reason}`)
    this.name = 'OverpassUnavailableError'
  }
}

async function consultarOverpass(lat: number, lng: number): Promise<Response> {
  const query = `[out:json][timeout:15];
(
  node["shop"~"^(mall|supermarket|department_store)$"](around:${RADIO_ANCHORS_M},${lat},${lng});
  way["shop"~"^(mall|supermarket|department_store)$"](around:${RADIO_ANCHORS_M},${lat},${lng});
)->.anchors;
(
  way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${RADIO_AVENIDA_M},${lat},${lng});
)->.avenidas;
.anchors out count;
.avenidas out count;`

  return fetchWithTimeout(
    'https://overpass-api.de/api/interpreter',
    {
      method: 'POST',
      // El User-Agent por defecto de fetchWithTimeout ('Mozilla/5.0
      // (compatible; PermisoHub/1.0)', pensado para no ser bloqueado por
      // portales inmobiliarios) es rechazado con 406 por el WAF de Apache
      // de Overpass — el patrón "(compatible; ...)" calza con firmas de
      // bots falsos. Overpass pide un UA honesto con contacto (ver su
      // usage policy); verificado en vivo: UA por defecto → 406, este → 200.
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'PermisoHub/1.0 (+https://permisohub.cl)',
      },
      body: `data=${encodeURIComponent(query)}`,
    },
    20_000,
  )
}

/**
 * Consulta Overpass API por anchors comerciales (mall/supermercado/department
 * store) dentro de RADIO_ANCHORS_M y calles primarias/troncales/secundarias
 * dentro de RADIO_AVENIDA_M, en una sola request (2 sets, 2 `out count`).
 * Retorna null solo ante un 200 con forma de respuesta inesperada (fallo de
 * parseo genuino). Lanza OverpassUnavailableError ante CUALQUIER indicio de
 * que el servicio no está disponible ahora (429 sostenido tras backoff, red
 * caída, timeout, cualquier status no-2xx) — el caller debe distinguir este
 * caso y reintentar más tarde, nunca marcarlo como error permanente.
 */
export async function obtenerSenalesUbicacion(lat: number, lng: number): Promise<SenalesUbicacion | null> {
  await throttle()

  let res: Response
  try {
    res = await consultarOverpass(lat, lng)
  } catch (err) {
    throw new OverpassUnavailableError(err instanceof Error ? err.message : String(err))
  }

  if (res.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS))
    lastRequestAt = Date.now()
    try {
      res = await consultarOverpass(lat, lng)
    } catch (err) {
      throw new OverpassUnavailableError(err instanceof Error ? err.message : String(err))
    }
    if (res.status === 429) throw new OverpassUnavailableError('429 tras reintento con backoff')
  }

  if (!res.ok) throw new OverpassUnavailableError(`HTTP ${res.status}`)

  try {
    const json = await res.json() as { elements?: OverpassCountElement[] }
    const counts = (json.elements ?? []).filter((e) => e.type === 'count')
    if (counts.length < 2) return null

    const anchors = Number(counts[0]?.tags?.total ?? '0')
    const avenidas = Number(counts[1]?.tags?.total ?? '0')
    if (!Number.isFinite(anchors) || !Number.isFinite(avenidas)) return null

    return { cercaAvenidaPrincipal: avenidas > 0, anchorsComercialesCercanos: anchors }
  } catch (err) {
    console.warn('[terrenos-ubicacion] Respuesta de Overpass no parseable:', err instanceof Error ? err.message : err)
    return null
  }
}
