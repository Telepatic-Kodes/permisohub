import { describe, expect, it } from 'vitest'
import { calcularCapRatePropiedad, type PropiedadPortafolio } from '@/lib/propiedades-portafolio-server'
import { calcularCapRate } from '@/lib/calculadora-inversion'

function propiedadBase(overrides: Partial<PropiedadPortafolio> = {}): PropiedadPortafolio {
  return {
    id: 'prop-1',
    direccion: 'Av. Providencia 1234',
    comuna: 'Providencia',
    tipoPropiedad: 'local_comercial',
    superficieM2: 100,
    operacion: 'arriendo',
    precioActualUf: 50,
    rolSii: '1234-56',
    notas: null,
    fechaVencimientoContrato: null,
    tieneAscensor: false,
    tieneGas: false,
    siiDestino: 'LOCAL COMERCIAL',
    siiAvaluoFiscalUf: 8000,
    siiConsultadoEl: '2026-08-01',
    reajusteAplica: false,
    reajustePeriodicidadMeses: null,
    reajusteFechaUltimo: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('calcularCapRatePropiedad', () => {
  it('con datos completos, delega correctamente a calcularCapRate', () => {
    const prop = propiedadBase()
    const esperado = calcularCapRate({ rentaMensual: 50, precioVenta: 8000 })
    expect(calcularCapRatePropiedad(prop)).toEqual(esperado)
  })

  it('devuelve null cuando la operación es venta', () => {
    const prop = propiedadBase({ operacion: 'venta' })
    expect(calcularCapRatePropiedad(prop)).toBeNull()
  })

  it('devuelve null cuando no hay avalúo fiscal SII', () => {
    const prop = propiedadBase({ siiAvaluoFiscalUf: null })
    expect(calcularCapRatePropiedad(prop)).toBeNull()
  })

  it('devuelve null cuando no hay precio actual (renta) registrado', () => {
    const prop = propiedadBase({ precioActualUf: null })
    expect(calcularCapRatePropiedad(prop)).toBeNull()
  })
})
