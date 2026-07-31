import { reportError } from '@/lib/observability'

export function apiError(message: string, status: number, internalError?: unknown): Response {
  if (internalError !== undefined) {
    const detail = internalError instanceof Error ? internalError.message : String(internalError)
    console.error(`[API ${status}] ${message}:`, detail)

    // Todo 5xx se reporta al funnel único — un catch silencioso deja de ser
    // posible sin que quede rastro en Sentry (o en el log estructurado si
    // Sentry no está configurado).
    if (status >= 500) {
      reportError(internalError, { scope: 'api-error', extra: { message, status } })
    }
  }
  return Response.json({ error: message }, { status })
}
