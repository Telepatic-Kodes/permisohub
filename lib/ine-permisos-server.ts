import { createServiceClient } from '@/lib/supabase/service'
import { recordSourceRun } from '@/lib/observability'
import { descargarPermisosEdificacionIne } from '@/lib/scrapers/ine-permisos-edificacion'
import { normalizarNombreComuna } from '@/lib/scrapers/instrumentos-ipt'

export interface ResultadoIngestaIne {
  filasAgregadas: number
}

/**
 * Orquesta la ingesta del agregado nacional del INE hacia
 * `ine_permisos_edificacion`. La clave natural (comuna, año, uso_destino) ya
 * viene deduplicada desde el propio groupBy de ArcGIS — un solo upsert basta.
 */
export async function correrIngestaPermisosEdificacionIne(): Promise<ResultadoIngestaIne> {
  const supabase = createServiceClient()
  const filas = await descargarPermisosEdificacionIne()

  if (filas.length === 0) {
    await recordSourceRun({
      sourceId: 'ine-permisos-edificacion',
      status: 'error',
      errorMessage: 'Descarga vacía — ver reportWarning/reportError de ine-permisos-edificacion.ts para la causa',
    })
    return { filasAgregadas: 0 }
  }

  const { error } = await supabase.from('ine_permisos_edificacion').upsert(
    filas.map((f) => ({
      comuna: f.comuna,
      comuna_normalizada: normalizarNombreComuna(f.comuna),
      anio: f.anio,
      uso_destino: f.usoDestino,
      n_permisos: f.nPermisos,
      superficie_total_m2: f.superficieTotalM2,
      unidades_total: f.unidadesTotal,
      actualizado_el: new Date().toISOString(),
    })),
    { onConflict: 'comuna,anio,uso_destino' },
  )

  if (error) {
    await recordSourceRun({ sourceId: 'ine-permisos-edificacion', status: 'error', errorMessage: error.message })
    throw error
  }

  await recordSourceRun({ sourceId: 'ine-permisos-edificacion', status: 'ok', rowCount: filas.length })

  return { filasAgregadas: filas.length }
}

export interface TendenciaConstruccionComuna {
  comuna: string
  anioMax: number
  m2Recientes: number // suma NO HABITACIONAL + MIXTO, últimos 3 años con dato
  m2Previos: number // mismo cálculo, 3 años anteriores a esos
  tendencia: 'creciente' | 'estable' | 'decreciente'
  variacionPct: number | null
}

interface FilaTendencia {
  anio: number
  superficie_total_m2: number
}

function calcularTendencia(comuna: string, filas: FilaTendencia[]): TendenciaConstruccionComuna | null {
  if (filas.length === 0) return null

  const anioMax = Math.max(...filas.map((f) => f.anio))
  const sumaEnRango = (desde: number, hasta: number) =>
    filas.filter((f) => f.anio >= desde && f.anio <= hasta).reduce((acc, f) => acc + f.superficie_total_m2, 0)

  const m2Recientes = sumaEnRango(anioMax - 2, anioMax)
  const m2Previos = sumaEnRango(anioMax - 5, anioMax - 3)

  let tendencia: TendenciaConstruccionComuna['tendencia'] = 'estable'
  let variacionPct: number | null = null
  if (m2Previos > 0) {
    variacionPct = ((m2Recientes - m2Previos) / m2Previos) * 100
    if (variacionPct >= 15) tendencia = 'creciente'
    else if (variacionPct <= -15) tendencia = 'decreciente'
  }

  return { comuna, anioMax, m2Recientes, m2Previos, tendencia, variacionPct }
}

/**
 * Compara la superficie construida no-habitacional/mixta (proxy de actividad
 * comercial/industrial, la que le importa a Mercado Inmobiliario) de los
 * últimos 3 años con dato disponible contra los 3 años anteriores, para dar
 * una tendencia real en vez de que el modelo la adivine. Cobertura real del
 * INE termina ~2022 — esto es HISTÓRICO, no una señal de "hoy".
 *
 * Filtra por la columna `comuna_normalizada` (precalculada en la ingesta), no
 * por traer todo y comparar en cliente: el cap server-side de PostgREST
 * (max-rows, 1000 por defecto) NO se puede levantar con un `.limit()` del
 * cliente — un `.limit(5000)` seguía devolviendo solo 1000 filas en la
 * práctica, y ni siquiera un SELECT de comunas distintas escapaba del cap
 * (4.243 filas totales, deduplicar en cliente después de truncar a 1000
 * seguía perdiendo comunas alfabéticamente tardías como Providencia — bug
 * real, encontrado al verificar en vivo con una consulta directa, no solo en
 * teoría). Con la columna indexada, el resultado es un puñado de filas por
 * comuna (~26), nunca cerca del límite.
 */
export async function obtenerTendenciaConstruccionComuna(comuna: string): Promise<TendenciaConstruccionComuna | null> {
  const supabase = createServiceClient()
  const objetivo = normalizarNombreComuna(comuna)

  const { data, error } = await supabase
    .from('ine_permisos_edificacion')
    .select('anio, uso_destino, superficie_total_m2')
    .eq('comuna_normalizada', objetivo)
    .in('uso_destino', ['NO HABITACIONAL', 'MIXTO'])

  if (error || !data) return null
  return calcularTendencia(comuna, data)
}

/**
 * Versión en lote de `obtenerTendenciaConstruccionComuna` — una sola query
 * para varias comunas (ej. todas las presentes en una página de resultados),
 * en vez de N llamadas. Mismo criterio de `comuna_normalizada` indexada.
 */
export async function obtenerTendenciasConstruccionPorComuna(
  comunas: string[],
): Promise<Map<string, TendenciaConstruccionComuna>> {
  const resultado = new Map<string, TendenciaConstruccionComuna>()
  if (comunas.length === 0) return resultado

  const supabase = createServiceClient()
  const comunasNormalizadas = new Map(comunas.map((c) => [normalizarNombreComuna(c), c]))

  const { data, error } = await supabase
    .from('ine_permisos_edificacion')
    .select('comuna_normalizada, anio, uso_destino, superficie_total_m2')
    .in('comuna_normalizada', Array.from(comunasNormalizadas.keys()))
    .in('uso_destino', ['NO HABITACIONAL', 'MIXTO'])

  if (error || !data) return resultado

  const porComuna = new Map<string, FilaTendencia[]>()
  for (const fila of data) {
    const lista = porComuna.get(fila.comuna_normalizada) ?? []
    lista.push({ anio: fila.anio, superficie_total_m2: fila.superficie_total_m2 })
    porComuna.set(fila.comuna_normalizada, lista)
  }

  for (const [normalizada, comunaOriginal] of comunasNormalizadas) {
    const filas = porComuna.get(normalizada)
    if (!filas) continue
    const tendencia = calcularTendencia(comunaOriginal, filas)
    if (tendencia) resultado.set(comunaOriginal, tendencia)
  }

  return resultado
}
