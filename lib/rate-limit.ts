import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { reportWarning } from '@/lib/observability'

let _limiter: Ratelimit | null | undefined
let _warnedNoUpstash = false

function getLimiter(): Ratelimit | null {
  if (_limiter !== undefined) return _limiter

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    _limiter = null
    // Un solo warn por proceso (no por request) — el no-op sigue siendo el
    // comportamiento correcto en dev, pero en prod esto significa que las
    // rutas públicas quedan sin protección y eso ya no puede ser silencioso (A7).
    if (!_warnedNoUpstash) {
      _warnedNoUpstash = true
      reportWarning(
        'Rate limiting DESACTIVADO — UPSTASH_REDIS_REST_URL/TOKEN no configurados. Rutas públicas sin protección.',
        { scope: 'rate-limit.no-upstash' }
      )
    }
    return null
  }

  const redis = new Redis({ url, token })

  _limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '60 s'),
    analytics: false,
    prefix: 'permisohub',
  })

  return _limiter
}

export async function checkRateLimit(identifier: string): Promise<Response | null> {
  const limiter = getLimiter()
  if (!limiter) return null  // Upstash not configured — pass through

  const { success, limit, reset } = await limiter.limit(identifier)

  if (!success) {
    return Response.json(
      { error: 'Demasiadas solicitudes. Intenta en un momento.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  return null
}
