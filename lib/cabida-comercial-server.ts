import { createServiceClient } from '@/lib/supabase/service'
import { reportError } from '@/lib/observability'
import { obtenerIsocrona, type ModoIsocrona } from '@/lib/isocrona'
import { obtenerPoblacionEnPoligono } from '@/lib/censo-manzana-server'
import { obtenerConsumoEstimado } from '@/lib/consumo-macro-zona'
import { obtenerCompetenciaPorFormato } from '@/lib/competencia-formato'
import type { AnalisisParaVeredicto, PercentilesGapScore } from '@/lib/veredicto-cabida'
import type { FormatoComercial, UbicacionCabida } from '@/lib/cabida-comercial'

// ---------------------------------------------------------------------------
// Plan 16-04 / 19-03 — la pieza que faltaba: componer isócrona + población +
// consumo + competencia en un AnalisisParaVeredicto y persistirlo, para que
// calcularVeredictoCabida() (escrita y testeada desde el 03-08, sin callers)
// tenga con qué trabajar.
//
// Se llama obtenerAnalisisCabidaComercial y NO consultarCabidaComercial — ese
// nombre ya lo usa el helper client-safe de lib/cabida-comercial.ts. La
// convención del repo separa ambos nombres a propósito (ver el comentario
// extenso ahí, mismo criterio que lookupZonificacion vs
// persistZonificacionParaProyecto).
// ---------------------------------------------------------------------------

const MINUTOS_DEFECTO = 15
const MODO_DEFECTO: ModoIsocrona = 'caminando'

export interface OpcionesAnalisisCabida {
  lat: number
  lng: number
  comuna: string
  formato: FormatoComercial
  modo?: ModoIsocrona
  minutos?: number
}

export interface AnalisisCabidaPersistido {
  analisis: AnalisisParaVeredicto
  cacheId: string | null
  gapScore: number | null
}

/** Redondeo a 6 decimales (~11 cm), misma clave de caché que zonificacion_cache. */
function redondear(n: number): number {
  return Number(n.toFixed(6))
}

/**
 * Corre el análisis completo para una ubicación+formato y lo persiste.
 *
 * Nunca lanza por fallos de fuentes externas: cada pieza degrada por su
 * cuenta (la isócrona cae a círculo, la población devuelve ok:false) y esa
 * degradación queda registrada, no disimulada. Sí puede lanzar por errores de
 * programación — no se traga bugs propios.
 */
export async function obtenerAnalisisCabidaComercial(
  opciones: OpcionesAnalisisCabida
): Promise<AnalisisCabidaPersistido> {
  const { lat, lng, comuna, formato } = opciones
  const modo = opciones.modo ?? MODO_DEFECTO
  const minutos = opciones.minutos ?? MINUTOS_DEFECTO

  const isocrona = await obtenerIsocrona({ lat, lng, minutos, modo })

  const ubicacion: UbicacionCabida = {
    lat,
    lng,
    comuna,
    precision: 'aproximada',
    direccionLabel: comuna,
    fuenteTexto: comuna,
  }

  // Censo (ArcGIS) y competencia (Overpass + Nominatim) son servicios
  // externos independientes con throttles independientes — en paralelo, mismo
  // criterio ya documentado dentro de obtenerCompetenciaPorFormato().
  const [poblacion, competencia] = await Promise.all([
    obtenerPoblacionEnPoligono(isocrona.geometria),
    obtenerCompetenciaPorFormato(ubicacion, formato, isocrona.geometria),
  ])

  const consumo = obtenerConsumoEstimado(comuna)

  const analisis: AnalisisParaVeredicto = {
    formato,
    isocrona,
    competencia,
    demografia: { poblacion, consumo },
    generadoEl: new Date().toISOString(),
  }

  // gapScore replica exactamente la fórmula de calcularVeredictoCabida()
  // (competidores por 1.000 habitantes). NULL — nunca 0 — cuando la población
  // no es utilizable: 0 significaría "densidad cero de competencia", que es
  // una afirmación distinta a "no sé".
  const poblacionUtilizable = poblacion.ok && poblacion.manzanasIntersectadas > 0 && poblacion.totalPersonas > 0
  const gapScore = poblacionUtilizable
    ? (competencia.competidores.length / poblacion.totalPersonas) * 1000
    : null

  const cacheId = await persistirAnalisis({ lat, lng, modo, minutos, isocrona, poblacion, competencia, gapScore })

  return { analisis, cacheId, gapScore }
}

type PersistirParams = {
  lat: number
  lng: number
  modo: ModoIsocrona
  minutos: number
  isocrona: Awaited<ReturnType<typeof obtenerIsocrona>>
  poblacion: Awaited<ReturnType<typeof obtenerPoblacionEnPoligono>>
  competencia: Awaited<ReturnType<typeof obtenerCompetenciaPorFormato>>
  gapScore: number | null
}

/** Escribe caché + competencia. Devuelve el cacheId, o null si falló. */
async function persistirAnalisis(p: PersistirParams): Promise<string | null> {
  try {
    const supabase = createServiceClient()

    const { data: cache, error: errCache } = await supabase
      .from('cabida_comercial_cache')
      .upsert(
        {
          lat_r: redondear(p.lat),
          lng_r: redondear(p.lng),
          modo: p.modo,
          minutos: p.minutos,
          isocrona_status: 'encontrado',
          isocrona_metodo: p.isocrona.metodo,
          isocrona_geometria: p.isocrona.geometria,
          isocrona_proveedor: p.isocrona.proveedor,
          poblacion_status: p.poblacion.ok ? 'encontrado' : 'error',
          poblacion_personas: p.poblacion.ok ? p.poblacion.totalPersonas : null,
          poblacion_viviendas: p.poblacion.ok ? p.poblacion.totalViviendas : null,
          poblacion_manzanas: p.poblacion.ok ? p.poblacion.manzanasIntersectadas : null,
          poblacion_consultada_el: new Date().toISOString(),
          consultado_el: new Date().toISOString(),
        },
        { onConflict: 'lat_r,lng_r,modo,minutos' }
      )
      .select('id')
      .single()

    if (errCache || !cache) {
      reportError(errCache ?? new Error('upsert de cabida_comercial_cache sin fila'), {
        scope: 'cabida.persistir.cache',
        extra: { lat: p.lat, lng: p.lng },
      })
      return null
    }

    const { error: errComp } = await supabase.from('cabida_comercial_competencia').upsert(
      {
        cache_id: cache.id,
        formato: p.competencia.formato,
        competidores_n: p.competencia.competidores.length,
        confianza_global: p.competencia.confianzaGlobal,
        cobertura_conocida: p.competencia.coberturaConocida,
        disclosure: p.competencia.disclosure,
        gap_score: p.gapScore,
        consultado_el: new Date().toISOString(),
      },
      { onConflict: 'cache_id,formato' }
    )

    if (errComp) {
      reportError(errComp, { scope: 'cabida.persistir.competencia', extra: { cacheId: cache.id } })
    }

    return cache.id as string
  } catch (err) {
    reportError(err, { scope: 'cabida.persistir', extra: { lat: p.lat, lng: p.lng } })
    return null
  }
}

/**
 * Terciles p33/p66 de gap_score sobre los análisis REALES ya guardados para
 * un formato. Devuelve null si no hay ninguno — nunca inventa un corte, que
 * es justamente lo que calcularVeredictoCabida() se niega a hacer.
 *
 * El percentil se calcula en JS y no con percentile_cont de Postgres a
 * propósito: la muestra esperada es de decenas de filas (MUESTRA_MINIMA=10),
 * traerlas es trivial, y así el criterio de interpolación queda visible en el
 * código en vez de depender de la semántica del motor.
 */
export async function calcularPercentilesGapScore(
  formato: FormatoComercial
): Promise<PercentilesGapScore | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('cabida_comercial_competencia')
      .select('gap_score')
      .eq('formato', formato)
      .not('gap_score', 'is', null)
      .order('gap_score', { ascending: true })

    if (error || !data || data.length === 0) return null

    const valores = data.map((f) => Number(f.gap_score)).filter((n) => Number.isFinite(n))
    if (valores.length === 0) return null

    return {
      p33: percentil(valores, 0.33),
      p66: percentil(valores, 0.66),
      muestraN: valores.length,
    }
  } catch (err) {
    reportError(err, { scope: 'cabida.percentiles', extra: { formato } })
    return null
  }
}

/** Percentil por interpolación lineal sobre un arreglo YA ordenado ascendente. */
export function percentil(ordenados: number[], fraccion: number): number {
  if (ordenados.length === 1) return ordenados[0]
  const pos = (ordenados.length - 1) * fraccion
  const bajo = Math.floor(pos)
  const alto = Math.ceil(pos)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo)
}
