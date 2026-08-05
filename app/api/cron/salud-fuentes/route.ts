import { validateCronSecret } from '@/lib/scraper'
import { createServiceClient } from '@/lib/supabase/service'
import { recordSourceRun, reportError, reportWarning } from '@/lib/observability'
import { PROBES, correrProbe } from '@/lib/data-source-probes'
import { clasificarSalud, ameritaAlerta, VENTANA_LATENCIA } from '@/lib/salud-fuentes'
import type { MedicionProbe, EstadoSalud } from '@/lib/salud-fuentes'

export const dynamic = 'force-dynamic'
// Cota superior generosa: los 4 probes corren en serie y el peor caso es
// Overpass (3 intentos × su propio timeout, más 5 s de piso de throttle entre
// llamadas). Medido en vivo el 05-08: ~4 s en total con todo respondiendo
// bien; el presupuesto es para el día que NO respondan.
export const maxDuration = 280

// Health check de las fuentes externas que están en el camino crítico de un
// request de usuario (ver lib/data-source-probes.ts para el porqué de cada
// probe y para qué queda deliberadamente fuera).
//
// Corre en serie, no en paralelo: Overpass da 2 slots por IP y Nominatim se
// auto-throttlea a 1,1 s — lanzar los 4 juntos sería pelearse consigo mismo y
// medir la contención propia en vez de la salud del servicio.

interface SaludFuente {
  sourceId: string
  nombre: string
  estado: EstadoSalud
  ok: boolean
  durationMs: number | null
  intentosUsados: number
  totalMs: number
  umbralLatenciaMs: number
  detalle: string
}

/**
 * Últimas mediciones de ESTE probe, más reciente primero.
 *
 * kind='probe' es obligatorio en el filtro: mezclar corridas de ingesta
 * (kind='run') en el historial de latencia compararía peras con manzanas —
 * un scraper que tarda 40 s en traer 300 filas no dice nada sobre si el
 * servicio responde rápido a una consulta puntual.
 *
 * Devuelve [] ante cualquier fallo de lectura, y eso NO se confunde con
 * "midió bien": la medición actual siempre se antepone en memoria, así que
 * un historial vacío degrada a "clasificar solo con lo de hoy", nunca a un
 * verde inventado.
 */
async function historialProbe(sourceId: string): Promise<MedicionProbe[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('data_source_runs')
      .select('status, duration_ms, ran_at')
      .eq('source_id', sourceId)
      .eq('kind', 'probe')
      .order('ran_at', { ascending: false })
      .limit(VENTANA_LATENCIA)
    if (error) throw error
    return (data ?? []).map((fila) => ({
      ok: fila.status === 'ok',
      durationMs: fila.duration_ms,
      ranAt: fila.ran_at,
    }))
  } catch (err) {
    reportError(err, { scope: 'cron.salud-fuentes.historial', extra: { sourceId } })
    return []
  }
}

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultados: SaludFuente[] = []

  for (const probe of PROBES) {
    const medido = await correrProbe(probe)

    // El historial se lee ANTES de insertar y la medición de hoy se antepone
    // en memoria: así la clasificación es determinista y no depende de que la
    // escritura ya se vea reflejada en la lectura siguiente.
    const historial = await historialProbe(probe.sourceId)
    const hoy: MedicionProbe = {
      ok: medido.ok,
      durationMs: medido.durationMs,
      ranAt: new Date().toISOString(),
    }
    const estado = clasificarSalud([hoy, ...historial], probe.umbralLatenciaMs)

    await recordSourceRun({
      sourceId: probe.sourceId,
      status: medido.ok ? 'ok' : 'error',
      durationMs: medido.durationMs ?? undefined,
      kind: 'probe',
      // detail se guarda SIEMPRE (es la serie que delata deriva silenciosa);
      // errorMessage solo cuando de verdad falló.
      detail: medido.detalle,
      errorMessage: medido.ok ? undefined : medido.detalle,
    })

    if (ameritaAlerta(estado)) {
      const extra = {
        sourceId: probe.sourceId,
        estado,
        durationMs: medido.durationMs,
        intentosUsados: medido.intentosUsados,
        totalMs: medido.totalMs,
        umbralLatenciaMs: probe.umbralLatenciaMs,
        detalle: medido.detalle,
      }
      if (estado === 'caido') {
        // Error y no warning: esta fuente está en el camino crítico de la
        // ficha. El síntoma que ve la founder es "la app está lenta", y el
        // objetivo entero de este cron es que en vez de eso diga cuál fuente.
        reportError(new Error(`Fuente externa caída: ${probe.sourceId} — ${medido.detalle}`), {
          scope: 'cron.salud-fuentes',
          extra,
        })
      } else {
        reportWarning(
          `Fuente externa degradada: ${probe.sourceId} — mediana sobre ${probe.umbralLatenciaMs} ms`,
          { scope: 'cron.salud-fuentes', extra }
        )
      }
    }

    resultados.push({
      sourceId: probe.sourceId,
      nombre: probe.nombre,
      estado,
      ok: medido.ok,
      durationMs: medido.durationMs,
      intentosUsados: medido.intentosUsados,
      totalMs: medido.totalMs,
      umbralLatenciaMs: probe.umbralLatenciaMs,
      detalle: medido.detalle,
    })
  }

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    fuentes: resultados,
    conAlerta: resultados.filter((r) => ameritaAlerta(r.estado)).map((r) => r.sourceId),
  })
}
