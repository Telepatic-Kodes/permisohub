import * as Sentry from '@sentry/nextjs'

/**
 * Contexto opcional para reportError/reportWarning.
 * - scope: identifica el punto de origen (ej. 'cron.daily-check', 'api.proyectos.sii-after').
 * - extra: datos adicionales serializables para depuración (ids, payloads, etc).
 */
export interface ErrorContext {
  scope?: string
  extra?: Record<string, unknown>
}

const DEFAULT_SCOPE = 'unknown'

/**
 * Funnel único de reporte de errores para toda la app.
 *
 * - Siempre hace un `console.error` estructurado (JSON de una línea) — visible
 *   en los logs de Vercel incluso sin Sentry configurado.
 * - Si `SENTRY_DSN` está configurado (ver sentry.server.config.ts /
 *   sentry.edge.config.ts), además reporta a Sentry. Si no está configurado,
 *   la llamada a Sentry es un no-op seguro (SDK sin inicializar).
 *
 * Nunca lanza — seguro de usar en paths fire-and-forget (after(), loops de cron).
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  const scope = context?.scope ?? DEFAULT_SCOPE
  const message = error instanceof Error ? error.message : String(error)

  logStructured('error', scope, message, context?.extra, error instanceof Error ? error.stack : undefined)

  try {
    Sentry.captureException(error, {
      tags: { scope },
      extra: context?.extra,
    })
  } catch {
    // La observabilidad nunca debe romper al llamador.
  }
}

/**
 * Variante de advertencia — mismo funnel, sin excepción asociada.
 * Útil para degradaciones silenciosas que deben quedar visibles
 * (ej. rate limiting desactivado, fallback aplicado) sin ser un error 5xx.
 */
export function reportWarning(message: string, context?: ErrorContext): void {
  const scope = context?.scope ?? DEFAULT_SCOPE

  logStructured('warn', scope, message, context?.extra)

  try {
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: { scope },
      extra: context?.extra,
    })
  } catch {
    // La observabilidad nunca debe romper al llamador.
  }
}

function logStructured(
  level: 'error' | 'warn',
  scope: string,
  message: string,
  extra?: Record<string, unknown>,
  stack?: string
): void {
  const logFn = level === 'error' ? console.error : console.warn
  try {
    logFn(JSON.stringify({ level, scope, message, extra, stack }))
  } catch {
    // extra no serializable (ej. referencias circulares) — fallback a texto plano.
    logFn(`[${scope}] ${message}`)
  }
}
