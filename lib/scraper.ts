// Shared scraper utilities

export interface ScraperResult {
  success: boolean
  data?: Record<string, string>
  error?: string
  rawHtml?: string
  fetchedAt: string
}

// Auth header check for cron endpoints
export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // allow in dev
  return authHeader === `Bearer ${secret}`
}

/**
 * "No pude buscar", explícitamente distinto de "busqué y no hay nada".
 *
 * POR QUÉ EXISTE (05-08): los dos scrapers de mercado de locales devolvían
 * `[]` en TODOS sus caminos de fallo — HTTP no-2xx, excepción de red, timeout.
 * Como `correrDescubrimientoMercadoLocales` solo registra en `errors` lo que
 * SALE lanzado de la función de búsqueda, y nunca salía nada, ese array
 * estaba vacío por construcción: no vacío porque no hubo errores, vacío
 * porque los errores no tenían por dónde salir. La corrida terminaba con
 * `encontrados: 0` y se persistía como `status: 'ok'`.
 *
 * El costo real, medido: el 5 ago Doomos registró 0 filas (venía de 452) y se
 * vio verde en /admin/salud-datos durante un día. Al investigarlo, Doomos
 * respondía perfecto (15 items/comuna) y el que estaba devolviendo cero en
 * ese momento era Portalinmobiliario — la fuente que el tablero mostraba como
 * sana, con 2.408 filas esa misma madrugada. O sea el fallo es intermitente y
 * les toca alternadamente a los dos; sin esta distinción, al que le toque
 * caerse a la hora del cron queda archivado como un cero saludable.
 *
 * Mismo criterio que OverpassUnavailableError (lib/terrenos-ubicacion.ts): el
 * caller decide qué hacer, pero no puede seguir sin enterarse.
 */
export class ScraperUnavailableError extends Error {
  constructor(
    readonly fuente: string,
    motivo: string
  ) {
    super(`${fuente} no disponible: ${motivo}`)
    this.name = 'ScraperUnavailableError'
  }
}

// Fetch with timeout and user agent
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PermisoHub/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-CL,es;q=0.9',
        ...options.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

// Extract text between two string markers in HTML
export function extractBetween(html: string, start: string, end: string): string | null {
  const startIdx = html.indexOf(start)
  if (startIdx === -1) return null
  const from = startIdx + start.length
  const endIdx = html.indexOf(end, from)
  if (endIdx === -1) return null
  return html.slice(from, endIdx).trim()
}

// Strip HTML tags from a string
export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Parse a Chilean date string "DD/MM/YYYY" to ISO "YYYY-MM-DD"
export function parseChileanDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

// Map common DOM estado strings to our internal EstadoExpediente type
export function mapDomEstado(rawEstado: string): string {
  const normalized = rawEstado.toLowerCase().trim()
  if (normalized.includes('observ')) return 'con_observaciones'
  if (normalized.includes('aprobad') || normalized.includes('otorgad')) return 'aprobado'
  if (normalized.includes('rechazad') || normalized.includes('denegad')) return 'rechazado'
  if (normalized.includes('revision') || normalized.includes('revisión')) return 'en_revision'
  if (normalized.includes('ingresad') || normalized.includes('recibid')) return 'ingresado'
  return 'en_revision' // default
}
