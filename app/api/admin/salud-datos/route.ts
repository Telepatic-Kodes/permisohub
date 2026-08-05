import { createClient } from "@/lib/supabase/server"
import { esAdminPlataforma } from "@/lib/admin-plataforma"
import { PROBES } from "@/lib/data-source-probes"
import { clasificarSalud, medianaLatencia, VENTANA_LATENCIA } from "@/lib/salud-fuentes"
import type { EstadoSalud, MedicionProbe } from "@/lib/salud-fuentes"

export const dynamic = "force-dynamic"

/**
 * Estado de las fuentes de datos — consumido por
 * app/(admin)/admin/salud-datos/page.tsx (Torre de Control).
 *
 * Devuelve DOS colecciones separadas, no una lista mezclada:
 *
 *  - `probes`: disponibilidad de fuentes externas de LECTURA, medidas a
 *    diario por /api/cron/salud-fuentes. Responden "¿el servicio responde
 *    ahora, y rápido?".
 *  - `ingesta`: corridas de scrapers/crons. Responden "¿entraron datos?".
 *
 * Mezclarlas haría que el probe diario de una fuente tape la última corrida
 * de un scraper semanal, y que la palabra "OK" signifique dos cosas distintas
 * en la misma tabla.
 *
 * La clasificación (ok/lento/caido/sin_datos) se hace ACÁ y no en la página
 * por dos razones: usa exactamente la misma función que el cron de alertas
 * — imposible que el semáforo diga verde mientras Sentry dice rojo —, y los
 * umbrales viven en lib/data-source-probes.ts, que importa los clientes de
 * scraping; importarlo desde un componente cliente los arrastraría al bundle
 * del browser.
 */
export interface DataSourceRunRow {
  id: number
  source_id: string
  status: "ok" | "error"
  row_count: number | null
  error_message: string | null
  duration_ms: number | null
  detail: string | null
  ran_at: string
}

export interface ResumenProbe {
  sourceId: string
  nombre: string
  estado: EstadoSalud
  ultimaCorrida: string | null
  ultimaDuracionMs: number | null
  medianaMs: number | null
  umbralLatenciaMs: number
  detalle: string | null
  error: string | null
  mediciones: number
}

/**
 * Ventana temporal en vez de "últimas N filas": con N fijo, agregar fuentes
 * empuja a las viejas fuera del rango en silencio y la página deja de
 * mostrarlas sin decir por qué. Con ventana, lo que no aparece es porque no
 * corrió en estos días — eso es información, no un artefacto del límite.
 */
const VENTANA_DIAS = 21
const LIMITE_FILAS = 2000

export async function GET() {
  const supabase = await createClient()

  // La RLS de data_source_runs es `using (true)` para cualquier usuario
  // autenticado — sin este chequeo explícito, esta ruta devolvía el estado
  // interno de scrapers/crons (incluyendo error_message) a CUALQUIER
  // cliente con sesión, no solo a la founder. El layout de app/(admin)/
  // protege la página, pero la API detrás no tenía ningún gate propio.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || !esAdminPlataforma(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("data_source_runs")
    .select("id, source_id, status, row_count, error_message, duration_ms, detail, ran_at, kind")
    .gte("ran_at", desde)
    .order("ran_at", { ascending: false })
    .limit(LIMITE_FILAS)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const filas = (data ?? []) as (DataSourceRunRow & { kind: "run" | "probe" })[]

  const probes: ResumenProbe[] = PROBES.map((probe) => {
    const propias = filas.filter((f) => f.kind === "probe" && f.source_id === probe.sourceId)
    const mediciones: MedicionProbe[] = propias.map((f) => ({
      ok: f.status === "ok",
      durationMs: f.duration_ms,
      ranAt: f.ran_at,
    }))
    const ultima = propias[0] ?? null

    return {
      sourceId: probe.sourceId,
      nombre: probe.nombre,
      // Una fuente con probe declarado pero sin ninguna medición en la
      // ventana sale 'sin_datos' — visible, no ausente de la tabla. Que el
      // cron haya dejado de correr es justamente lo que no puede pasar en
      // silencio en una página que existe para detectar silencios.
      estado: clasificarSalud(mediciones, probe.umbralLatenciaMs),
      ultimaCorrida: ultima?.ran_at ?? null,
      ultimaDuracionMs: ultima?.duration_ms ?? null,
      medianaMs: medianaLatencia(mediciones.slice(0, VENTANA_LATENCIA)),
      umbralLatenciaMs: probe.umbralLatenciaMs,
      detalle: ultima?.detail ?? null,
      error: ultima?.error_message ?? null,
      mediciones: propias.length,
    }
  })

  const ingesta = filas.filter((f) => f.kind === "run")

  return Response.json({ probes, ingesta, ventanaDias: VENTANA_DIAS })
}
