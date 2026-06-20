// Chilean holidays 2024-2030 (fixed + movable dates pre-calculated)
// Source: Ley N°2.977 + modifications

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
}

function isFeriado(date: Date): boolean {
  const year = date.getFullYear()
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
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
}

/**
 * Calculate the legal status of a DOM permit under Ley 21.718
 * @param fechaIngreso - Date the permit was submitted to DOM
 * @param tieneRevisorIndependiente - Whether independent reviewer (RI) was used
 * @param hoy - Current date (defaults to now, accept parameter for testing)
 */
export function getEstadoPlazoLey21718(
  fechaIngreso: Date,
  tieneRevisorIndependiente: boolean,
  hoy?: Date
): EstadoPlazoLey21718 {
  const today = hoy ?? new Date()
  const plazoTotal = tieneRevisorIndependiente ? 15 : 30

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
  }
}

export function formatFecha(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
