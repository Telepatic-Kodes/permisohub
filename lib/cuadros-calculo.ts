// ---------------------------------------------------------------------------
// Cuadros de cálculo normativo — cómputo DETERMINISTA (nunca por el LLM).
//
// "La arquitectura es dibujo": los cuadros de superficies y la comparación
// proyecto vs. instrumento (PRC/OGUC) que la DOM exige sobre la lámina son
// ARITMÉTICA. Aquí vive esa aritmética, aislada y testeable. El LLM, a lo más,
// SUGIERE valores desde el expediente (marcados "por verificar"); el cálculo
// y el veredicto cumple/excede los hace este módulo, no el modelo.
// ---------------------------------------------------------------------------

export interface NivelSuperficie {
  // Nombre del nivel/piso (ej. "Piso 1", "Subterráneo", "Ampliación 1996").
  nombre: string
  // Superficie edificada del nivel, en m².
  edificada: number
  // Superficie que el nivel ocupa en el suelo (proyección), en m². Normalmente
  // solo el/los nivel(es) de contacto con el terreno aportan ocupación de suelo.
  ocupadaSuelo?: number
}

// Envolvente (Δ4) — inputs de rasante y distanciamiento por reglas OGUC.
// Ambos opcionales: el cálculo solo agrega su fila cuando hay datos. El factor
// de rasante por defecto es 70° (pendiente 2.75/1) según el Art. 2.6.3; si el
// PRC fija otro, lo ingresa el arquitecto. Los distanciamientos varían por PRC.
export interface RasanteInput {
  distanciaAlDeslindeM?: number // distancia horizontal desde el deslinde al punto
  factorPendiente?: number // default 2.75 (70°); override si el PRC fija otro
  alturaEnPuntoM?: number // altura proyectada en ese punto (para el veredicto)
}
export interface DistanciamientoInput {
  alturaEdificacionM?: number
  muro?: 'con_vanos' | 'ciego' // default 'con_vanos'
  distanciaProyectadaM?: number // distancia proyectada al deslinde (para el veredicto)
}

export interface CuadroInput {
  // Superficie del predio (terreno), en m². Denominador de los coeficientes.
  superficiePredio: number
  niveles: NivelSuperficie[]
  // Límites del instrumento de planificación (PRC de la comuna) u OGUC.
  // Los ingresa el arquitecto; la app NO inventa valores del PRC.
  coefConstructibilidadMax?: number // ej. 1.2 (adimensional)
  ocupacionSueloMaxPct?: number // ej. 40 (%)
  alturaMaxM?: number // ej. 10.5 (m)
  alturaProyectoM?: number // altura del proyecto, en m
  // Envolvente (Δ4) — opcionales, aditivos (jsonb viejo sigue válido).
  rasante?: RasanteInput
  distanciamiento?: DistanciamientoInput
}

export type Veredicto = 'cumple' | 'excede' | 'sin_limite'

export interface FilaCuadro {
  concepto: string
  valor: number
  unidad: string
  limite: number | null
  veredicto: Veredicto
  // Detalle legible (ej. "184.21 / 500 m²").
  detalle?: string
  // Dirección del límite: 'max' = incumple por encima (default; constructibilidad,
  // altura, rasante); 'min' = incumple por debajo (distanciamiento).
  sentido?: 'max' | 'min'
}

export interface CuadroResultado {
  superficieTotalEdificada: number
  superficieOcupadaSuelo: number
  constructibilidad: number
  ocupacionSueloPct: number
  filas: FilaCuadro[]
  // Conceptos que exceden su límite (para alertar).
  incumplimientos: string[]
  // true si algún dato base es inválido/incompleto y el cálculo no es confiable.
  incompleto: boolean
}

// Redondeo estable a `d` decimales evitando -0 y errores de coma flotante.
export function round(n: number, d = 2): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** d
  const r = Math.round((n + Number.EPSILON) * f) / f
  return Object.is(r, -0) ? 0 : r
}

function num(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0
}

// Tolerancia relativa para el veredicto cumple/excede (evita falsos "excede"
// por redondeo). 0.5% del límite.
function excede(valor: number, limite: number): boolean {
  return valor > limite * 1.005
}

function veredictoDe(valor: number, limite: number | null): Veredicto {
  if (limite === null || limite <= 0) return 'sin_limite'
  return excede(valor, limite) ? 'excede' : 'cumple'
}

// Veredicto para reglas de MÍNIMO (distanciamiento): incumple cuando el valor
// proyectado queda por debajo del mínimo exigido (con la misma tolerancia 0.5%).
// Usa el mismo enum: 'excede' = "no cumple la norma" (aquí, bajo el mínimo).
function veredictoMin(valor: number, minimo: number | null): Veredicto {
  if (minimo === null || minimo <= 0) return 'sin_limite'
  return valor < minimo * 0.995 ? 'excede' : 'cumple'
}

// --- Envolvente (Δ4): reglas OGUC deterministas, aritmética pura ---

// Altura máxima admisible en un punto por rasante (Art. 2.6.3 OGUC). Por defecto
// 70° = pendiente 2.75/1: por cada metro horizontal desde el deslinde se puede
// subir 2.75 m. Si el PRC fija otro ángulo, se pasa su factor de pendiente.
export function alturaMaxRasante(distanciaM: number, factor = 2.75): number {
  const d = num(distanciaM)
  const f = typeof factor === 'number' && factor > 0 ? factor : 2.75
  return round(d * f, 2)
}

// Distanciamiento mínimo entre la edificación y el deslinde (Art. 2.6.6 pto 3):
// un tercio de la altura, con piso de 3 m entre muros con vanos y 1,5 m entre
// muros ciegos.
export function distanciamientoMinimo(
  alturaM: number,
  muro: 'con_vanos' | 'ciego' = 'con_vanos',
): number {
  const h = num(alturaM)
  const piso = muro === 'ciego' ? 1.5 : 3
  return round(Math.max(h / 3, piso), 2)
}

/**
 * Calcula el cuadro normativo a partir de las superficies del proyecto y los
 * límites del instrumento. Todo es aritmética pura y determinista.
 */
export function calcularCuadro(input: CuadroInput): CuadroResultado {
  const predio = num(input.superficiePredio)
  const niveles = Array.isArray(input.niveles) ? input.niveles : []

  const superficieTotalEdificada = round(
    niveles.reduce((acc, n) => acc + num(n.edificada), 0),
  )
  const superficieOcupadaSuelo = round(
    niveles.reduce((acc, n) => acc + num(n.ocupadaSuelo), 0),
  )

  const constructibilidad = predio > 0 ? round(superficieTotalEdificada / predio, 2) : 0
  const ocupacionSueloPct = predio > 0 ? round((superficieOcupadaSuelo / predio) * 100, 1) : 0

  const coefMax =
    typeof input.coefConstructibilidadMax === 'number' && input.coefConstructibilidadMax > 0
      ? round(input.coefConstructibilidadMax, 2)
      : null
  const ocupMax =
    typeof input.ocupacionSueloMaxPct === 'number' && input.ocupacionSueloMaxPct > 0
      ? round(input.ocupacionSueloMaxPct, 1)
      : null
  const alturaMax =
    typeof input.alturaMaxM === 'number' && input.alturaMaxM > 0
      ? round(input.alturaMaxM, 2)
      : null
  const alturaProyecto = num(input.alturaProyectoM)

  const filas: FilaCuadro[] = [
    {
      concepto: 'Superficie del predio',
      valor: round(predio),
      unidad: 'm²',
      limite: null,
      veredicto: 'sin_limite',
    },
    {
      concepto: 'Superficie total edificada',
      valor: superficieTotalEdificada,
      unidad: 'm²',
      limite: null,
      veredicto: 'sin_limite',
    },
    {
      concepto: 'Superficie ocupada en suelo',
      valor: superficieOcupadaSuelo,
      unidad: 'm²',
      limite: null,
      veredicto: 'sin_limite',
    },
    {
      concepto: 'Constructibilidad',
      valor: constructibilidad,
      unidad: '',
      limite: coefMax,
      veredicto: veredictoDe(constructibilidad, coefMax),
      detalle: `${superficieTotalEdificada} m² / ${round(predio)} m²`,
    },
    {
      concepto: 'Ocupación de suelo',
      valor: ocupacionSueloPct,
      unidad: '%',
      limite: ocupMax,
      veredicto: veredictoDe(ocupacionSueloPct, ocupMax),
      detalle: `${superficieOcupadaSuelo} m² / ${round(predio)} m²`,
    },
  ]

  if (alturaProyecto > 0 || alturaMax !== null) {
    filas.push({
      concepto: 'Altura de edificación',
      valor: round(alturaProyecto, 2),
      unidad: 'm',
      limite: alturaMax,
      veredicto: veredictoDe(alturaProyecto, alturaMax),
    })
  }

  // Envolvente — Rasante (Art. 2.6.3): altura máxima admisible en el punto.
  const rasante = input.rasante
  const distRasante = rasante ? num(rasante.distanciaAlDeslindeM) : 0
  if (distRasante > 0) {
    const factor =
      typeof rasante?.factorPendiente === 'number' && rasante.factorPendiente > 0
        ? round(rasante.factorPendiente, 2)
        : 2.75
    const maxAltura = alturaMaxRasante(distRasante, factor)
    const alturaEnPunto = num(rasante?.alturaEnPuntoM)
    filas.push({
      concepto: 'Rasante',
      valor: alturaEnPunto > 0 ? round(alturaEnPunto, 2) : maxAltura,
      unidad: 'm',
      limite: maxAltura,
      veredicto: alturaEnPunto > 0 ? veredictoDe(alturaEnPunto, maxAltura) : 'sin_limite',
      detalle: `${round(distRasante, 2)} m × ${factor} = ${maxAltura} m`,
      sentido: 'max',
    })
  }

  // Envolvente — Distanciamiento (Art. 2.6.6): mínimo exigido (regla de MÍNIMO).
  const dist = input.distanciamiento
  const alturaDist = dist ? num(dist.alturaEdificacionM) : 0
  if (alturaDist > 0) {
    const muro = dist?.muro === 'ciego' ? 'ciego' : 'con_vanos'
    const minimo = distanciamientoMinimo(alturaDist, muro)
    const proyectada = num(dist?.distanciaProyectadaM)
    const etiquetaMuro = muro === 'ciego' ? 'muro ciego' : 'muro con vanos'
    filas.push({
      concepto: 'Distanciamiento',
      valor: proyectada > 0 ? round(proyectada, 2) : minimo,
      unidad: 'm',
      limite: minimo,
      veredicto: proyectada > 0 ? veredictoMin(proyectada, minimo) : 'sin_limite',
      detalle:
        proyectada > 0
          ? `proyectado ${round(proyectada, 2)} m · mínimo ${minimo} m (${etiquetaMuro})`
          : `mínimo ${minimo} m (${etiquetaMuro})`,
      sentido: 'min',
    })
  }

  const incumplimientos = filas
    .filter((f) => f.veredicto === 'excede')
    .map((f) => {
      if (f.limite === null) return f.concepto
      return f.sentido === 'min'
        ? `${f.concepto}: ${f.valor}${f.unidad} bajo el mínimo ${f.limite}${f.unidad}`
        : `${f.concepto}: ${f.valor}${f.unidad} excede el máximo ${f.limite}${f.unidad}`
    })

  const incompleto = predio <= 0 || superficieTotalEdificada <= 0

  return {
    superficieTotalEdificada,
    superficieOcupadaSuelo,
    constructibilidad,
    ocupacionSueloPct,
    filas,
    incumplimientos,
    incompleto,
  }
}

// Margen determinista contra un límite del instrumento: cuánto se puede
// edificar/ocupar como máximo y cuánto hay que REDUCIR para cumplir.
export interface MargenCuadro {
  concepto: string
  actual: number
  maximoPermitido: number
  // > 0: lo que sobra respecto del límite (hay que reducir esto para cumplir).
  // <= 0: holgura disponible (se cumple).
  exceso: number
  unidad: string
}

/**
 * Traduce los límites del PRC a metas concretas en m²/m: máximo edificable,
 * máxima ocupación de suelo y altura. Es la base numérica que el asesor de
 * vía entrega al arquitecto ("reducir X m²"), calculada aquí y NUNCA por el
 * LLM. Solo incluye conceptos con límite declarado.
 */
export function margenesCuadro(input: CuadroInput): MargenCuadro[] {
  const r = calcularCuadro(input)
  const predio = num(input.superficiePredio)
  const margenes: MargenCuadro[] = []
  if (predio > 0 && typeof input.coefConstructibilidadMax === 'number' && input.coefConstructibilidadMax > 0) {
    const maximo = round(predio * input.coefConstructibilidadMax)
    margenes.push({
      concepto: 'Superficie edificada (constructibilidad)',
      actual: r.superficieTotalEdificada,
      maximoPermitido: maximo,
      exceso: round(r.superficieTotalEdificada - maximo),
      unidad: 'm²',
    })
  }
  if (predio > 0 && typeof input.ocupacionSueloMaxPct === 'number' && input.ocupacionSueloMaxPct > 0) {
    const maximo = round((predio * input.ocupacionSueloMaxPct) / 100)
    margenes.push({
      concepto: 'Superficie ocupada en suelo',
      actual: r.superficieOcupadaSuelo,
      maximoPermitido: maximo,
      exceso: round(r.superficieOcupadaSuelo - maximo),
      unidad: 'm²',
    })
  }
  if (typeof input.alturaMaxM === 'number' && input.alturaMaxM > 0 && num(input.alturaProyectoM) > 0) {
    const actual = round(num(input.alturaProyectoM), 2)
    const maximo = round(input.alturaMaxM, 2)
    margenes.push({
      concepto: 'Altura de edificación',
      actual,
      maximoPermitido: maximo,
      exceso: round(actual - maximo, 2),
      unidad: 'm',
    })
  }
  return margenes
}

// Input vacío de arranque para la UI.
export function cuadroVacio(): CuadroInput {
  return {
    superficiePredio: 0,
    niveles: [{ nombre: 'Piso 1', edificada: 0, ocupadaSuelo: 0 }],
    coefConstructibilidadMax: undefined,
    ocupacionSueloMaxPct: undefined,
    alturaMaxM: undefined,
    alturaProyectoM: undefined,
  }
}
