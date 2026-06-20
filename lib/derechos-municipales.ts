export type TipoObra =
  | 'obra_nueva'
  | 'ampliacion'
  | 'alteracion'
  | 'reconstruccion'
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

// Derecho base: 1.5% del presupuesto de obra (Art. 130 LGUC)
// DFL2: Ley 20.659 — viviendas económicas hasta 140m² pueden tener reducción
// Mínimo: varía por municipio (usamos UF como referencia)
const PORCENTAJE_BASE = 0.015

// Reference: 1 UF ≈ CLP 38,000 (mid 2025)
const UF_CLP = 38000

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

export function calcularDerechosMunicipales(
  presupuestoObra: number,
  tipoObra: TipoObra,
  superficieConstruida: number,
  esDFL2: boolean,
  municipio: string
): CalculoDerechos {
  const detalle: string[] = []
  const advertencias: string[] = []

  let porcentaje = PORCENTAJE_BASE

  // DFL2 reduction: 50% descuento en derechos para viviendas DFL2
  if (esDFL2 && superficieConstruida <= 140) {
    porcentaje = PORCENTAJE_BASE * 0.5
    detalle.push(`Descuento DFL2 aplicado: 50% (vivienda ≤ 140m²)`)
  } else if (esDFL2 && superficieConstruida > 140) {
    advertencias.push(`La obra supera los 140m² — no aplica descuento DFL2. Se usa tarifa normal.`)
  }

  // Regularizaciones: 1.5% con posible multa adicional
  if (tipoObra === 'regularizacion') {
    detalle.push(`Regularización: ${(porcentaje * 100).toFixed(2)}% del presupuesto`)
    advertencias.push(`Puede aplicar multa adicional de hasta 100% de los derechos por obra sin permiso. Verificar con la DOM.`)
  }

  // Demolition: flat fee approximation
  if (tipoObra === 'demolicion') {
    const montoFijo = superficieConstruida * 2000 // CLP per m2
    detalle.push(`Demolición: tarifa plana estimada ~$${montoFijo.toLocaleString('es-CL')} (verificar con DOM)`)
    return {
      presupuestoObra,
      tipoObra,
      superficieConstruida,
      esDFL2,
      municipio,
      montoDerechos: montoFijo,
      porcentajeAplicado: 0,
      detalle,
      advertencias: [...advertencias, 'Los derechos de demolición varían por municipio — confirmar monto exacto.'],
    }
  }

  let montoCalculado = presupuestoObra * porcentaje
  detalle.push(`${(porcentaje * 100).toFixed(2)}% × $${presupuestoObra.toLocaleString('es-CL')} = $${montoCalculado.toLocaleString('es-CL')}`)

  // Apply minimum
  const minimoUF = MINIMOS_UF[municipio] ?? MINIMOS_UF['default']
  const minimoCLP = minimoUF * UF_CLP
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
  regularizacion: 'Regularización',
  demolicion: 'Demolición',
}
