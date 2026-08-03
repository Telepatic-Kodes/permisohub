import type { AnalisisCabidaComercial, FormatoComercial, NivelConfianza } from '@/lib/cabida-comercial'
import type { PoblacionCensoResultado } from '@/lib/censo-manzana-server'
import type { ConsumoEstimadoResultado } from '@/lib/consumo-macro-zona'

/**
 * Espejo LOCAL del contrato documentado en 17-03-PLAN.md. lib/cabida-comercial.ts
 * TODAVÍA no declara este campo (Plan 17-03 está gateado por Phase 16, no
 * ejecutado a la fecha en que se escribió este archivo). Compone los dos tipos
 * YA reales y committeados (Fase 17, Plans 17-01/17-02). Cuando Plan 17-03
 * ejecute y agregue `demografia?: DemografiaYConsumo` real a
 * AnalisisCabidaComercial, Plan 19-03 (gateado) debe verificar que ambos
 * shapes sigan siendo estructuralmente idénticos.
 */
export interface DemografiaYConsumo {
  poblacion: PoblacionCensoResultado
  consumo: ConsumoEstimadoResultado
}

/** AnalisisCabidaComercial real + demografia? local (ver comentario arriba). */
export type AnalisisParaVeredicto = AnalisisCabidaComercial & { demografia?: DemografiaYConsumo }

// Nombres literales tomados de ROADMAP.md/19-RESEARCH.md — no inventar wording distinto.
export type VeredictoEstado = 'evidencia_de_espacio' | 'mercado_parece_cubierto' | 'evidencia_insuficiente'

/**
 * Por qué el veredicto quedó en 'evidencia_insuficiente' — distinto del
 * `explicacion` en prosa, para que la UI (Plan 19-04) pueda renderizar cada
 * motivo de forma distinta si quiere (ej. destacar "todavía no hay muestra
 * comparativa" de forma distinta a "faltan datos de entrada"). SIEMPRE
 * presente cuando estado === 'evidencia_insuficiente', SIEMPRE undefined en
 * los otros dos estados.
 */
export type RazonInsuficiencia =
  | 'datos_base_faltantes' // demografia y/o competencia === undefined
  | 'poblacion_no_utilizable' // poblacion.ok === false o manzanasIntersectadas === 0
  | 'confianza_degradada' // isócrona degradada a círculo, o confianzaGlobal de competencia muy baja
  | 'muestra_comparativa_insuficiente' // percentiles null o muestraN < MUESTRA_MINIMA — cold-start
  | 'banda_intermedia_no_concluyente' // gapScore entre p33 y p66 — no es un problema de datos, es estadístico

/**
 * Terciles de gap score calculados a partir de análisis REALES ya existentes
 * en cabida_comercial_cache (Plan 19-03, gateado — computación async con I/O,
 * fuera de este archivo puro). NUNCA un corte inventado por esta función.
 * `muestraN` es cuántas filas reales se usaron para calcular p33/p66 — permite
 * a calcularVeredictoCabida() desconfiar de terciles calculados sobre una
 * muestra demasiado chica (ver MUESTRA_MINIMA más abajo).
 */
export interface PercentilesGapScore {
  p33: number
  p66: number
  muestraN: number
}

export interface VeredictoCabida {
  estado: VeredictoEstado
  confianza: NivelConfianza // VERE-02: siempre junto a estado, nunca uno sin el otro — misma estructura
  gapScore: number | null // VERE-04: proxy de densidad (competidores por 1.000 habitantes), NUNCA leakage/surplus real
  razonInsuficiencia?: RazonInsuficiencia // presente SOLO cuando estado === 'evidencia_insuficiente'
  explicacion: string
  generadoEl: string
}

const NIVEL_ORDEN: Record<NivelConfianza, number> = { baja: 0, media: 1, alta: 2 }
// Defensa en profundidad — mismo criterio que TOPE_CONFIANZA_GLOBAL de
// lib/competencia-formato.ts. competencia.confianzaGlobal ya viene topeada en
// 'media' en v1.7, pero el veredicto no debe asumirlo silenciosamente.
const TOPE_CONFIANZA_VEREDICTO: NivelConfianza = 'media'

// Piso de muestra para confiar en un p33/p66 calculado — elección de
// ingeniería documentada como tal (no un benchmark externo, no un umbral de
// gap score). Con menos de MUESTRA_MINIMA análisis reales detrás de los
// terciles, cualquier corte sería tan arbitrario como el threshold fijo que
// este archivo dejó de usar — por eso el resultado es SIEMPRE
// 'evidencia_insuficiente' en ese caso, nunca una clasificación con baja
// base estadística disfrazada de conclusión.
const MUESTRA_MINIMA = 10

function insuficiente(gapScore: number | null, razon: RazonInsuficiencia, motivo: string): VeredictoCabida {
  return { estado: 'evidencia_insuficiente', confianza: 'baja', gapScore, razonInsuficiencia: razon, explicacion: motivo, generadoEl: new Date().toISOString() }
}

// Textos de `explicacion` extraídos a funciones nombradas — mismo criterio
// que Task 3 de Plan 18-05 (constantes de disclosure grep-eables en
// lib/competencia-formato.ts), acá como funciones porque interpolan valores
// calculados (gapScore, muestra, terciles) en vez de ser texto fijo.
function motivoConfianzaDegradada(isocronaDegradada: boolean, confianzaCruda: NivelConfianza, gapScore: number): string {
  const proxy = `Proxy de densidad: ${gapScore.toFixed(2)} competidores por cada 1.000 habitantes.`
  return isocronaDegradada
    ? `Área de influencia calculada como círculo aproximado (no red vial real) — confianza insuficiente para concluir. ${proxy}`
    : `La confianza combinada de competencia (${confianzaCruda}) es demasiado baja para concluir. ${proxy}`
}

function motivoMuestraComparativaInsuficiente(formato: FormatoComercial, percentiles: PercentilesGapScore | null, gapScore: number): string {
  const muestraTexto = percentiles ? String(percentiles.muestraN) : '0'
  return (
    `Todavía no hay suficientes análisis comparables de formato ${formato} (muestra: ${muestraTexto}, mínimo requerido: ${MUESTRA_MINIMA}) ` +
    `para ubicar este gap score (${gapScore.toFixed(2)} competidores por cada 1.000 habitantes) contra una distribución real — ` +
    `el veredicto no puede concluir sin inventar un corte.`
  )
}

/**
 * Función PURA — no hace fetch/I/O. Compone demografia + competencia + isocrona
 * (ya resueltos por otro código) + terciles de gap score YA calculados por el
 * llamador (Plan 19-03) en un veredicto de 3 estados, siempre con su
 * confianza adjunta (VERE-02). PRIMERO chequea undefined explícito — nunca
 * colapsa "campo nunca poblado" con "campo poblado, valor cero" (Pitfall 1,
 * 19-RESEARCH.md). `formato` se recibe explícito (no solo `analisis.formato`)
 * porque los percentiles son específicos de un formato — el llamador debe
 * pasar el mismo formato con el que calculó `percentiles`; normalmente es
 * igual a `analisis.formato`.
 */
export function calcularVeredictoCabida(
  analisis: AnalisisParaVeredicto,
  formato: FormatoComercial,
  percentiles: PercentilesGapScore | null,
): VeredictoCabida {
  if (!analisis.demografia || !analisis.competencia) {
    return insuficiente(null, 'datos_base_faltantes', 'No hay datos suficientes de demografía y/o competencia para calcular un veredicto.')
  }

  if (!analisis.demografia.poblacion.ok || analisis.demografia.poblacion.manzanasIntersectadas === 0) {
    return insuficiente(null, 'poblacion_no_utilizable', 'El área de influencia no intersectó manzanas censales utilizables — sin base poblacional para el veredicto.')
  }

  const gapScore = (analisis.competencia.competidores.length / analisis.demografia.poblacion.totalPersonas) * 1000

  const isocronaDegradada = analisis.isocrona.metodo === 'circulo_equivalente'
  const confianzaCruda = analisis.competencia.confianzaGlobal
  const confianza: NivelConfianza = isocronaDegradada
    ? 'baja'
    : NIVEL_ORDEN[confianzaCruda] > NIVEL_ORDEN[TOPE_CONFIANZA_VEREDICTO]
      ? TOPE_CONFIANZA_VEREDICTO
      : confianzaCruda

  if (confianza === 'baja') {
    return insuficiente(gapScore, 'confianza_degradada', motivoConfianzaDegradada(isocronaDegradada, confianzaCruda, gapScore))
  }

  // Cold-start / muestra comparativa insuficiente — NUNCA un corte absoluto
  // inventado cuando no hay (o hay muy pocos) análisis reales de este
  // `formato` contra los cuales comparar. gapScore YA se calculó arriba y se
  // reporta igual — lo que falta es la distribución, no el dato. Este guard
  // corre ANTES del banding por terciles — nunca comparar gapScore contra
  // p33/p66 si la muestra que los originó no alcanza el mínimo.
  if (!percentiles || percentiles.muestraN < MUESTRA_MINIMA) {
    return insuficiente(gapScore, 'muestra_comparativa_insuficiente', motivoMuestraComparativaInsuficiente(formato, percentiles, gapScore))
  }

  // Banding por terciles REALES (Plan 19-03) — nunca un corte absoluto
  // hardcodeado en esta función. La banda intermedia es su propia zona
  // honesta de "no concluyente", no un catch-all de datos faltantes.
  let estado: VeredictoEstado
  let razonInsuficiencia: RazonInsuficiencia | undefined
  if (gapScore < percentiles.p33) {
    estado = 'evidencia_de_espacio'
  } else if (gapScore > percentiles.p66) {
    estado = 'mercado_parece_cubierto'
  } else {
    estado = 'evidencia_insuficiente'
    razonInsuficiencia = 'banda_intermedia_no_concluyente'
  }

  const explicacion =
    `${analisis.competencia.competidores.length} competidor(es) detectado(s) de formato ${formato} en el área de influencia, ` +
    `con ${analisis.demografia.poblacion.totalPersonas.toLocaleString('es-CL')} habitantes estimados (Censo ${analisis.demografia.poblacion.censoAno}) — ` +
    `proxy de densidad: ${gapScore.toFixed(2)} competidores por cada 1.000 habitantes, comparado contra ${percentiles.muestraN} análisis reales de este formato ` +
    `(terciles p33=${percentiles.p33.toFixed(2)}, p66=${percentiles.p66.toFixed(2)}). No es un índice de fuga de ventas real, ver metodología.`

  return { estado, confianza, gapScore, razonInsuficiencia, explicacion, generadoEl: new Date().toISOString() }
}
