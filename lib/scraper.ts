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
