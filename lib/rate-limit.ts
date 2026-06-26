import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let _limiter: Ratelimit | null | undefined

function getLimiter(): Ratelimit | null {
  if (_limiter !== undefined) return _limiter

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    _limiter = null
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

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

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
