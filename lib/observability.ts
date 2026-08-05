import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/service'

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

export interface SourceRunResult {
  /** Coincide con el `id` de la fuente en .planning/data-sources.yaml. */
  sourceId: string
  status: 'ok' | 'error'
  rowCount?: number
  errorMessage?: string
  /**
   * Latencia medida en ms. Omitir cuando NO se midió — se guarda null, que
   * no es lo mismo que 0. Un 0 por defecto haría que cualquier promedio o
   * umbral de latencia mezclara "rapidísimo" con "nunca medido", y esa
   * confusión es indetectable después.
   */
  durationMs?: number
  /**
   * 'run' (default) = corrida de ingesta real; 'probe' = chequeo sintético
   * de disponibilidad. No colapsar: un probe verde no dice nada sobre si la
   * ingesta está al día, ni al revés.
   */
  kind?: 'run' | 'probe'
  /**
   * Qué se afirmó en esta corrida, tanto en éxito como en fallo
   * ("53 manzanas, 19.266 personas"). NO es errorMessage: guardar el detalle
   * de una corrida sana en el campo de error haría que la UI pinte error
   * sobre una fila verde. Su valor está en la serie: una fuente que responde
   * ok pero con la mitad de los datos se ve acá y en ningún otro lado.
   */
  detail?: string
}

/**
 * Registra una corrida de scraper/cron en `data_source_runs` (Torre de
 * Control — checkpoint B), para poder ver "¿qué fuente falló hoy?" sin tener
 * que ir a buscar en logs de Vercel uno por uno.
 *
 * Nunca lanza — si falla el registro de salud, el scraper/cron que la llamó
 * debe seguir su curso igual (la observabilidad nunca rompe al llamador).
 */
export async function recordSourceRun(result: SourceRunResult): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('data_source_runs').insert({
      source_id: result.sourceId,
      status: result.status,
      row_count: result.rowCount ?? null,
      error_message: result.errorMessage ?? null,
      duration_ms: result.durationMs ?? null,
      kind: result.kind ?? 'run',
      detail: result.detail ?? null,
    })
    if (error) throw error
  } catch (err) {
    reportError(err, { scope: 'observability.recordSourceRun', extra: { sourceId: result.sourceId } })
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
