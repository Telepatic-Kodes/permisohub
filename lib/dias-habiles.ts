// Chilean holidays, pre-calculated per year.
// Source: Ley N°2.977 (feriados base) + Ley N°19.973/20.983 ("ley de lunes":
// San Pedro y San Pablo, Encuentro de Dos Mundos), Ley N°20.299 (Iglesias
// Evangélicas y Protestantes, con traslado a viernes), Ley N°21.357 (Día
// Nacional de los Pueblos Indígenas = solsticio de invierno).
//
// MANTENCIÓN: Tabla requiere refresco anual — feriados nuevos por ley
// (irrenunciables, únicos, ad-hoc) no son predecibles y no están cubiertos
// aquí. Antes de cada año nuevo, verificar el Diario Oficial / boletín de
// feriados y agregar la entrada correspondiente. Si un año no está en esta
// tabla, `getEstadoPlazoLey21718` lo señala vía `feriadosIncompletos` y se
// emite un console.warn — no falla silenciosamente, pero tampoco calcula
// bien los días hábiles de ese año hasta que se agregue.
//
// DECISIÓN (1 ago 2026, ver .planning/data-sources.yaml): no reemplazar por
// una API externa. La API oficial (apis.digital.gob.cl/fl) está deprecada;
// Boostr.cl requiere cuenta/posible costo; las alternativas gratuitas no
// oficiales no son más confiables que esta tabla para un cálculo de plazo
// legal (Ley 21.718) — acá cada feriado cita la ley exacta que lo crea, algo
// que una API de terceros no garantiza. Cobertura actual: 2024-2029. Revisar
// de nuevo cuando falten <12 meses de cobertura.

const FERIADOS_CHILE: Record<number, string[]> = {
  2024: [
    '2024-01-01', // Año Nuevo
    '2024-03-29', // Viernes Santo
    '2024-03-30', // Sábado de Gloria
    '2024-05-01', // Día del Trabajo
    '2024-05-21', // Glorias Navales
    '2024-06-20', // Día de los Pueblos Indígenas
    '2024-06-29', // San Pedro y San Pablo
    '2024-07-16', // Virgen del Carmen
    '2024-08-15', // Asunción de la Virgen
    '2024-09-18', // Independencia Nacional
    '2024-09-19', // Glorias del Ejército
    '2024-09-20', // Feriado adicional
    '2024-10-12', // Encuentro de Dos Mundos
    '2024-10-27', // Día de las Iglesias Evangélicas
    '2024-11-01', // Todos los Santos
    '2024-12-08', // Inmaculada Concepción
    '2024-12-25', // Navidad
  ],
  2025: [
    '2025-01-01', // Año Nuevo
    '2025-04-18', // Viernes Santo
    '2025-04-19', // Sábado de Gloria
    '2025-05-01', // Día del Trabajo
    '2025-05-21', // Glorias Navales
    '2025-06-20', // Día de los Pueblos Indígenas
    '2025-06-29', // San Pedro y San Pablo
    '2025-07-16', // Virgen del Carmen
    '2025-08-15', // Asunción de la Virgen
    '2025-09-18', // Independencia Nacional
    '2025-09-19', // Glorias del Ejército
    '2025-10-12', // Encuentro de Dos Mundos
    '2025-10-27', // Día de las Iglesias Evangélicas
    '2025-11-01', // Todos los Santos
    '2025-12-08', // Inmaculada Concepción
    '2025-12-25', // Navidad
  ],
  2026: [
    '2026-01-01', // Año Nuevo
    '2026-04-03', // Viernes Santo
    '2026-04-04', // Sábado de Gloria
    '2026-05-01', // Día del Trabajo
    '2026-05-21', // Glorias Navales
    '2026-06-22', // Día de los Pueblos Indígenas (Monday)
    '2026-06-29', // San Pedro y San Pablo
    '2026-07-16', // Virgen del Carmen
    '2026-08-15', // Asunción de la Virgen
    '2026-09-18', // Independencia Nacional
    '2026-09-19', // Glorias del Ejército
    '2026-10-12', // Encuentro de Dos Mundos
    '2026-10-27', // Día de las Iglesias Evangélicas
    '2026-11-01', // Todos los Santos
    '2026-12-08', // Inmaculada Concepción
    '2026-12-25', // Navidad
  ],
  2027: [
    '2027-01-01',
    '2027-03-26', // Viernes Santo
    '2027-03-27', // Sábado de Gloria
    '2027-05-01',
    '2027-05-21',
    '2027-06-21', // Pueblos Indígenas (Monday)
    '2027-06-28', // San Pedro (Monday — Ley Zanartu)
    '2027-07-16',
    '2027-08-15',
    '2027-09-18',
    '2027-09-19',
    '2027-10-11', // Encuentro Dos Mundos (Monday)
    '2027-10-27',
    '2027-11-01',
    '2027-12-08',
    '2027-12-25',
  ],
  2028: [
    '2028-01-01', // Año Nuevo — fijo
    '2028-04-14', // Viernes Santo — movible religioso (searched: feriadoschilenos.cl / calendariochile.com)
    '2028-04-15', // Sábado Santo — movible religioso (searched)
    '2028-05-01', // Día del Trabajo — fijo
    '2028-05-21', // Glorias Navales — fijo
    // Día Nacional de los Pueblos Indígenas (Ley 21.357): coincide con el
    // solsticio de invierno. 2028-06-20 es martes (día de semana), por lo
    // que no aplica el traslado a lunes que sí opera si cae fin de semana.
    // fecha por confirmar en D.O. — el decreto específico del año aún no
    // ha sido gazetado a esta distancia; calculada astronómicamente y
    // cruzada con feriadoschilenos.cl.
    '2028-06-20', // Día de los Pueblos Indígenas — solsticio, por confirmar en D.O.
    '2028-06-26', // San Pedro y San Pablo — ley de lunes: 29-jun-2028 es jueves → traslada al lunes anterior (26-jun)
    '2028-07-16', // Virgen del Carmen — fijo
    '2028-08-15', // Asunción de la Virgen — fijo
    '2028-09-18', // Independencia Nacional — fijo
    '2028-09-19', // Glorias del Ejército — fijo
    '2028-10-09', // Encuentro de Dos Mundos — ley de lunes: 12-oct-2028 es jueves → traslada al lunes anterior (9-oct)
    '2028-10-27', // Iglesias Evangélicas y Protestantes — Ley 20.299: 31-oct-2028 es martes → traslada al viernes de la semana anterior (27-oct)
    '2028-11-01', // Todos los Santos — fijo
    '2028-12-08', // Inmaculada Concepción — fijo
    '2028-12-25', // Navidad — fijo
  ],
  2029: [
    '2029-01-01', // Año Nuevo — fijo
    '2029-03-30', // Viernes Santo — movible religioso (searched)
    '2029-03-31', // Sábado Santo — movible religioso (searched)
    '2029-05-01', // Día del Trabajo — fijo
    '2029-05-21', // Glorias Navales — fijo
    // 2029-06-20 es miércoles (día de semana) → no aplica traslado a lunes.
    // fecha por confirmar en D.O. — mismo criterio que 2028 (ver comentario arriba).
    '2029-06-20', // Día de los Pueblos Indígenas — solsticio, por confirmar en D.O.
    '2029-07-02', // San Pedro y San Pablo — ley de lunes: 29-jun-2029 es viernes → traslada al lunes siguiente (2-jul)
    '2029-07-16', // Virgen del Carmen — fijo
    '2029-08-15', // Asunción de la Virgen — fijo
    '2029-09-18', // Independencia Nacional — fijo
    '2029-09-19', // Glorias del Ejército — fijo
    '2029-10-15', // Encuentro de Dos Mundos — ley de lunes: 12-oct-2029 es viernes → traslada al lunes siguiente (15-oct)
    '2029-11-01', // Todos los Santos — fijo
    '2029-11-02', // Iglesias Evangélicas y Protestantes — Ley 20.299: 31-oct-2029 es miércoles → traslada al viernes de la misma semana (2-nov)
    '2029-12-08', // Inmaculada Concepción — fijo
    '2029-12-25', // Navidad — fijo
  ],
}

/** Años con datos completos en FERIADOS_CHILE. Se usa para el runtime guard. */
function anioTieneFeriados(year: number): boolean {
  return year in FERIADOS_CHILE
}

// Set module-level: evita spamear console.warn en cada llamada para el
// mismo año faltante (p. ej. un cron que corre a diario).
const aniosAdvertidos = new Set<number>()

function advertirFeriadosIncompletos(year: number): void {
  if (aniosAdvertidos.has(year)) return
  aniosAdvertidos.add(year)
  console.warn(
    `[dias-habiles] FERIADOS_CHILE no tiene datos para el año ${year}. ` +
      'Los cálculos de días hábiles para ese año solo excluyen sábado/domingo ' +
      '(sin feriados), lo que puede entregar plazos legales incorrectos. ' +
      'Agregar el año a la tabla en lib/dias-habiles.ts.'
  )
}

function isFeriado(date: Date): boolean {
  const year = date.getFullYear()
  if (!anioTieneFeriados(year)) {
    advertirFeriadosIncompletos(year)
  }
  const dateStr = date.toISOString().split('T')[0]
  const holidays = FERIADOS_CHILE[year] ?? []
  return holidays.includes(dateStr)
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isFeriado(date)
}

/**
 * Count business days between two dates (inclusive of start, exclusive of end)
 */
export function contarDiasHabiles(inicio: Date, fin: Date): number {
  let count = 0
  const current = new Date(inicio)
  current.setHours(0, 0, 0, 0)
  const end = new Date(fin)
  end.setHours(0, 0, 0, 0)

  while (current < end) {
    if (isBusinessDay(current)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

/**
 * Get the date that is N business days from start
 */
export function sumarDiasHabiles(inicio: Date, diasHabiles: number): Date {
  const current = new Date(inicio)
  current.setHours(0, 0, 0, 0)
  let remaining = diasHabiles

  while (remaining > 0) {
    current.setDate(current.getDate() + 1)
    if (isBusinessDay(current)) remaining--
  }
  return current
}

export interface EstadoPlazoLey21718 {
  diasHabilesTranscurridos: number
  diasHabilesRestantes: number
  fechaVencimiento: Date
  plazoTotal: number
  porcentajeUsado: number
  estado: 'EN_PLAZO' | 'PROXIMO_VENCER' | 'VENCIDO'
  urgencia: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  tieneRevisorIndependiente: boolean
  labelEstado: string
  diasHabilesDesdeIngreso: number
  /**
   * true si algún año involucrado en el cálculo (entre fechaIngreso y el
   * mayor de {hoy, fechaVencimiento}) no está cubierto por FERIADOS_CHILE.
   * En ese caso el conteo de días hábiles de ese año solo excluye
   * sábado/domingo (sin feriados) y el resultado puede variar respecto al
   * cálculo legal real. La UI debe mostrar una advertencia cuando es true.
   */
  feriadosIncompletos: boolean
  /**
   * true si el proyecto corresponde al tramo extendido de 60 días hábiles
   * de Ley 21.718 (proyectos habitacionales de mayor envergadura). Ver
   * parámetro `plazoExtendido60` de getEstadoPlazoLey21718 para el detalle
   * de la condición gatillante y su fuente.
   */
  plazoExtendido60: boolean
}

/**
 * Calculate the legal status of a DOM permit under Ley 21.718
 * @param fechaIngreso - Date the permit was submitted to DOM
 * @param tieneRevisorIndependiente - Whether independent reviewer (RI) was used
 * @param hoy - Current date (defaults to now, accept parameter for testing)
 * @param plazoExtendido60 - Whether the extended 60-business-day tier applies
 *   instead of the standard 30. Per Ley 21.718 this tier applies to
 *   "proyectos habitacionales de mayor envergadura" with carga de ocupación
 *   igual o superior a 1.000 personas (confirmed via DLA Piper's summary of
 *   the law, Dec-2024, and corroborated by portal.ijuridica.cl / arqydom.cl —
 *   no direct BCN primary-text citation obtained in this pass; if this
 *   trigger condition needs to be re-verified against the Diario Oficial
 *   text, treat it as the thing to check). Defaults to false so existing
 *   callers are unaffected. When true, this OVERRIDES the 30/15 logic: the
 *   base plazo becomes 60 (or 30 with revisor independiente) instead of 30
 *   (or 15). The same sources indicate the revisor-independiente discount
 *   ("los plazos indicados se reducen a la mitad") applies uniformly to
 *   both tiers, so the 60-day tier is halved to 30 just like 30→15 — this
 *   was confirmed by two independent secondary sources, not primary BCN text.
 */
export function getEstadoPlazoLey21718(
  fechaIngreso: Date,
  tieneRevisorIndependiente: boolean,
  hoy?: Date,
  plazoExtendido60 = false
): EstadoPlazoLey21718 {
  const today = hoy ?? new Date()
  const plazoBase = plazoExtendido60 ? 60 : 30
  const plazoTotal = tieneRevisorIndependiente ? plazoBase / 2 : plazoBase

  const diasHabilesDesdeIngreso = contarDiasHabiles(fechaIngreso, today)
  const fechaVencimiento = sumarDiasHabiles(fechaIngreso, plazoTotal)
  const diasHabilesRestantes = Math.max(0, plazoTotal - diasHabilesDesdeIngreso)
  const diasHabilesTranscurridos = Math.min(diasHabilesDesdeIngreso, plazoTotal)
  const porcentajeUsado = Math.min(100, (diasHabilesDesdeIngreso / plazoTotal) * 100)

  let estado: EstadoPlazoLey21718['estado']
  let urgencia: EstadoPlazoLey21718['urgencia']
  let labelEstado: string

  if (diasHabilesDesdeIngreso > plazoTotal) {
    estado = 'VENCIDO'
    urgencia = 'CRITICA'
    const diasExcedidos = diasHabilesDesdeIngreso - plazoTotal
    labelEstado = `Plazo vencido hace ${diasExcedidos} días hábiles — Reclamar por Ley 21.718`
  } else if (diasHabilesRestantes <= 3) {
    estado = 'PROXIMO_VENCER'
    urgencia = 'ALTA'
    labelEstado = `Vence en ${diasHabilesRestantes} días hábiles — Preparar reclamo`
  } else if (diasHabilesRestantes <= 7) {
    estado = 'PROXIMO_VENCER'
    urgencia = 'MEDIA'
    labelEstado = `Vence en ${diasHabilesRestantes} días hábiles`
  } else {
    estado = 'EN_PLAZO'
    urgencia = 'BAJA'
    labelEstado = `${diasHabilesRestantes} días hábiles restantes de ${plazoTotal}`
  }

  // Runtime guard (A3): señala si algún año tocado por el cálculo no está
  // en FERIADOS_CHILE. isFeriado() ya emite console.warn una vez por año
  // faltante durante contarDiasHabiles/sumarDiasHabiles; acá se resuelve
  // el flag para exponerlo a la UI incluso si el rango no llegó a iterar
  // sobre un día de ese año (p. ej. plazoTotal 0).
  const anioMax = Math.max(today.getFullYear(), fechaVencimiento.getFullYear())
  let feriadosIncompletos = false
  for (let y = fechaIngreso.getFullYear(); y <= anioMax; y++) {
    if (!anioTieneFeriados(y)) {
      advertirFeriadosIncompletos(y)
      feriadosIncompletos = true
    }
  }

  return {
    diasHabilesTranscurridos,
    diasHabilesRestantes,
    fechaVencimiento,
    plazoTotal,
    porcentajeUsado,
    estado,
    urgencia,
    tieneRevisorIndependiente,
    labelEstado,
    diasHabilesDesdeIngreso,
    feriadosIncompletos,
    plazoExtendido60,
  }
}

export function formatFecha(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
