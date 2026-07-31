import { describe, expect, it } from 'vitest'

import {
  calcularDerechosMunicipales,
  TIPO_OBRA_LABELS,
  type TipoObra,
} from '@/lib/derechos-municipales'

// Presupuesto alto para evitar que el mínimo UF de cualquier comuna
// interfiera con las pruebas de porcentaje puro.
const PRESUPUESTO_ALTO = 1_000_000_000
const UF_CLP = 38_000

describe('calcularDerechosMunicipales — porcentajes Art. 130 LGUC por tipo de obra', () => {
  const casos: Array<{ tipo: TipoObra; porcentajeEsperado: number }> = [
    { tipo: 'obra_nueva', porcentajeEsperado: 0.015 },
    { tipo: 'ampliacion', porcentajeEsperado: 0.015 },
    { tipo: 'alteracion', porcentajeEsperado: 0.01 },
    { tipo: 'reconstruccion', porcentajeEsperado: 0.01 },
    { tipo: 'modificacion_proyecto', porcentajeEsperado: 0.0075 },
    { tipo: 'demolicion', porcentajeEsperado: 0.005 },
    { tipo: 'regularizacion', porcentajeEsperado: 0.015 },
  ]

  it.each(casos)(
    '$tipo aplica $porcentajeEsperado de porcentaje',
    ({ tipo, porcentajeEsperado }) => {
      const r = calcularDerechosMunicipales(
        PRESUPUESTO_ALTO,
        tipo,
        100,
        false,
        'Santiago',
        UF_CLP
      )
      expect(r.porcentajeAplicado).toBeCloseTo(porcentajeEsperado)
      expect(r.montoDerechos).toBeCloseTo(
        PRESUPUESTO_ALTO * porcentajeEsperado,
        -2 // redondeo a miles
      )
    }
  )

  it('todos los TipoObra tienen label definido', () => {
    for (const tipo of casos.map((c) => c.tipo)) {
      expect(TIPO_OBRA_LABELS[tipo]).toBeTruthy()
    }
  })

  it('demolición ya no usa la heurística plana de $2.000/m² inventada', () => {
    const r = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'demolicion',
      500,
      false,
      'Santiago',
      UF_CLP
    )
    // La heurística vieja habría dado 500 * 2000 = 1.000.000
    expect(r.montoDerechos).not.toBe(1_000_000)
    expect(r.montoDerechos).toBeCloseTo(PRESUPUESTO_ALTO * 0.005, -2)
  })

  it('regularización deja advertencia sobre régimen Ley 20.898', () => {
    const r = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'regularizacion',
      100,
      false,
      'Santiago',
      UF_CLP
    )
    expect(r.advertencias.some((a) => a.includes('20.898'))).toBe(true)
  })
})

describe('calcularDerechosMunicipales — revisor independiente (Art. 116 bis LGUC)', () => {
  it('aplica -30% cuando tieneRevisorIndependiente es true', () => {
    const sinRevisor = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      false,
      'Santiago',
      UF_CLP,
      false
    )
    const conRevisor = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      false,
      'Santiago',
      UF_CLP,
      true
    )
    expect(conRevisor.montoDerechos).toBeCloseTo(sinRevisor.montoDerechos * 0.7, -2)
    expect(
      conRevisor.detalle.some((d) => d.includes('116 bis'))
    ).toBe(true)
  })

  it('no cambia el monto cuando tieneRevisorIndependiente es false u omitido', () => {
    const omitido = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      false,
      'Santiago',
      UF_CLP
    )
    const explicitoFalse = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      false,
      'Santiago',
      UF_CLP,
      false
    )
    expect(omitido.montoDerechos).toBe(explicitoFalse.montoDerechos)
  })
})

describe('calcularDerechosMunicipales — DFL2 no aplica descuento al monto (C2)', () => {
  it('el monto con esDFL2=true es igual al monto sin DFL2 (mismo tipo/superficie)', () => {
    const sinDFL2 = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      false,
      'Santiago',
      UF_CLP
    )
    const conDFL2 = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      true,
      'Santiago',
      UF_CLP
    )
    expect(conDFL2.montoDerechos).toBe(sinDFL2.montoDerechos)
    expect(conDFL2.porcentajeAplicado).toBe(sinDFL2.porcentajeAplicado)
  })

  it('agrega advertencia consultiva sobre DFL2 en vez de aplicar descuento', () => {
    const r = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      true,
      'Santiago',
      UF_CLP
    )
    expect(
      r.advertencias.some((a) => a.includes('DFL2') && a.includes('DOM'))
    ).toBe(true)
  })

  it('DFL2 con superficie > 140m² también deja la misma advertencia consultiva (sin trato especial por superficie)', () => {
    const r = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      200,
      true,
      'Santiago',
      UF_CLP
    )
    expect(r.advertencias.some((a) => a.includes('DFL2'))).toBe(true)
  })
})

describe('calcularDerechosMunicipales — mínimo por comuna (MINIMOS_UF)', () => {
  it('aplica el mínimo cuando el porcentaje calculado queda bajo el piso UF', () => {
    const presupuestoBajo = 10_000 // monto irrisorio → cae bajo cualquier mínimo
    const r = calcularDerechosMunicipales(
      presupuestoBajo,
      'obra_nueva',
      50,
      false,
      'Las Condes',
      UF_CLP
    )
    const minimoEsperado = 7 * UF_CLP // Las Condes = 7 UF
    expect(r.montoDerechos).toBeGreaterThanOrEqual(minimoEsperado - 1000)
    expect(r.detalle.some((d) => d.includes('mínimo'))).toBe(true)
  })

  it('usa el mínimo default cuando la comuna no está en la tabla', () => {
    const presupuestoBajo = 10_000
    const r = calcularDerechosMunicipales(
      presupuestoBajo,
      'obra_nueva',
      50,
      false,
      'Comuna Inexistente',
      UF_CLP
    )
    const minimoEsperado = 3 * UF_CLP // default = 3 UF
    expect(r.montoDerechos).toBeGreaterThanOrEqual(minimoEsperado - 1000)
  })

  it('no aplica el mínimo cuando el cálculo porcentual ya lo supera', () => {
    const r = calcularDerechosMunicipales(
      PRESUPUESTO_ALTO,
      'obra_nueva',
      100,
      false,
      'Las Condes',
      UF_CLP
    )
    expect(r.detalle.some((d) => d.includes('mínimo'))).toBe(false)
  })
})
