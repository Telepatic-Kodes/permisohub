export type TipoObra =
  | 'obra_nueva'
  | 'ampliacion'
  | 'alteracion'
  | 'reconstruccion'
  | 'modificacion_proyecto'
  | 'regularizacion'
  | 'demolicion'

export interface CalculoDerechos {
  presupuestoObra: number
  tipoObra: TipoObra
  superficieConstruida: number
  esDFL2: boolean
  municipio: string
  montoDerechos: number
  porcentajeAplicado: number
  detalle: string[]
  advertencias: string[]
}

// Porcentajes según Art. 130 LGUC (DFL 458).
// Verificado contra fuentes secundarias concordantes 2026-07-30 — confirmar
// contra texto D.O. ante cualquier discrepancia.
//
// Obra nueva / ampliación:        1.5% del presupuesto de obra
// Alteración / reparación /
//   obra menor:                   1.0% del presupuesto de obra
// Reconstrucción:                 1.0% del presupuesto de obra
// Modificación de proyecto:       0.75% del presupuesto de obra
// Demolición:                     0.5% del presupuesto de obra
// Regularización: no tiene una tasa propia y estable en el Art. 130 — hoy se
//   calcula referencialmente con la tasa de obra nueva (1.5%), pero el
//   régimen legal aplicable a regularizaciones puede regirse por la Ley
//   20.898 en vez del Art. 130 puro; ver advertencia en el resultado.
const PORCENTAJE_POR_TIPO: Record<TipoObra, number> = {
  obra_nueva: 0.015,
  ampliacion: 0.015,
  alteracion: 0.01,
  reconstruccion: 0.01,
  modificacion_proyecto: 0.0075,
  regularizacion: 0.015,
  demolicion: 0.005,
}

// Mínimos referenciales sin fuente verificada (auditoría 2026-07-30) —
// confirmar contra tabla de cobros de cada DOM.
const MINIMOS_UF: Record<string, number> = {
  'Santiago': 5,
  'Providencia': 6,
  'Las Condes': 7,
  'Vitacura': 8,
  'Ñuñoa': 5,
  'Macul': 4,
  'La Florida': 4,
  'San Miguel': 4,
  'Maipú': 4,
  'default': 3,
}

// Art. 116 bis LGUC: obras con revisor independiente acceden a una rebaja
// del 30% en el derecho municipal.
const REDUCCION_REVISOR_INDEPENDIENTE = 0.3

export function calcularDerechosMunicipales(
  presupuestoObra: number,
  tipoObra: TipoObra,
  superficieConstruida: number,
  esDFL2: boolean,
  municipio: string,
  ufCLP: number = 38000,
  tieneRevisorIndependiente?: boolean
): CalculoDerechos {
  const detalle: string[] = []
  const advertencias: string[] = []

  const porcentaje = PORCENTAJE_POR_TIPO[tipoObra]

  // DFL2: la evidencia disponible indica que el beneficio del 50% aplica a
  // inscripción CBR y contribuciones, NO al derecho municipal del Art. 130.
  // No se aplica ningún descuento al monto — solo se deja constancia.
  if (esDFL2) {
    advertencias.push(
      'Vivienda DFL2: podría aplicar beneficios en otros costos del proceso (CBR, contribuciones). El beneficio sobre derechos municipales Art. 130 no está confirmado — consultar con la DOM antes de asumir descuento.'
    )
  }

  // Regularizaciones: el Art. 130 no fija una tasa propia estable para este
  // caso; el régimen legal (Ley 20.898) puede diferir del Art. 130 puro.
  if (tipoObra === 'regularizacion') {
    detalle.push(`Regularización: ${(porcentaje * 100).toFixed(2)}% del presupuesto (tasa referencial de obra nueva)`)
    advertencias.push(
      'La base legal aplicable a regularizaciones puede diferir del Art. 130 LGUC (régimen Ley 20.898) — la DOM debe confirmar la tasa y eventual multa adicional de hasta 100% de los derechos por obra sin permiso.'
    )
  } else {
    detalle.push(`${(porcentaje * 100).toFixed(2)}% × $${presupuestoObra.toLocaleString('es-CL')} = $${(presupuestoObra * porcentaje).toLocaleString('es-CL')}`)
  }

  let montoCalculado = presupuestoObra * porcentaje

  // Art. 116 bis LGUC: revisor independiente reduce el derecho en 30%.
  // TODO(Art. 131): unidades repetidas (10-50% de reducción) no se
  // implementa en esta iteración — fuera de alcance.
  if (tieneRevisorIndependiente) {
    const montoAntesRevisor = montoCalculado
    montoCalculado = montoCalculado * (1 - REDUCCION_REVISOR_INDEPENDIENTE)
    detalle.push(
      `Reducción por revisor independiente (Art. 116 bis LGUC): -30% → $${montoAntesRevisor.toLocaleString('es-CL')} → $${montoCalculado.toLocaleString('es-CL')}`
    )
    advertencias.push(
      'La reducción por revisor independiente se aplicó antes de comparar contra el mínimo municipal — confirmar con la DOM la interacción exacta entre esta rebaja y los mínimos de cobro.'
    )
  }

  // Apply minimum
  const minimoUF = MINIMOS_UF[municipio] ?? MINIMOS_UF['default']
  const minimoCLP = minimoUF * ufCLP
  if (montoCalculado < minimoCLP) {
    detalle.push(`Se aplica mínimo de ${minimoUF} UF (≈ $${minimoCLP.toLocaleString('es-CL')}) en ${municipio}`)
    montoCalculado = minimoCLP
  }

  // Round to nearest 1000
  const montoDerechos = Math.round(montoCalculado / 1000) * 1000

  detalle.push(`Total estimado: $${montoDerechos.toLocaleString('es-CL')}`)
  advertencias.push('Monto referencial. El monto exacto lo determina la DOM según su tabla de cobros vigente.')

  return {
    presupuestoObra,
    tipoObra,
    superficieConstruida,
    esDFL2,
    municipio,
    montoDerechos,
    porcentajeAplicado: porcentaje,
    detalle,
    advertencias,
  }
}

export const TIPO_OBRA_LABELS: Record<TipoObra, string> = {
  obra_nueva: 'Obra nueva',
  ampliacion: 'Ampliación',
  alteracion: 'Alteración',
  reconstruccion: 'Reconstrucción',
  modificacion_proyecto: 'Modificación de proyecto',
  regularizacion: 'Regularización',
  demolicion: 'Demolición',
}
