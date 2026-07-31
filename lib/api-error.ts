import { reportError } from '@/lib/observability'

/**
 * Los errores de Supabase (PostgrestError) son objetos planos, no instancias de
 * Error: `String(err)` los imprimía como "[object Object]" y el log no servía
 * para nada. Se serializan conservando los campos que sí explican la falla.
 */
function detallar(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; details?: string; hint?: string }
    if (e.message || e.code) {
      return [
        e.message,
        e.code && `code=${e.code}`,
        e.details && `details=${e.details}`,
        e.hint && `hint=${e.hint}`,
      ]
        .filter(Boolean)
        .join(' · ')
    }
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

export function apiError(message: string, status: number, internalError?: unknown): Response {
  if (internalError !== undefined) {
    const detail = detallar(internalError)
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
