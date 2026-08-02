import { describe, expect, it } from 'vitest'
import { binarValores } from '@/components/mercado-inmobiliario/charts/histograma'

describe('binarValores', () => {
  it('nunca pierde el valor máximo (bug real: acumulación de punto flotante en desde/hasta por tramo)', () => {
    const valores = [673.79, 387.71, 199.35, 456.49, 754.5, 294.73]
    const conteos = binarValores(valores, 8)
    expect(conteos.reduce((a, b) => a + b, 0)).toBe(valores.length)
  })

  it('cada valor cae en exactamente un tramo — barrido amplio de casos', () => {
    let semilla = 42
    function siguiente(): number {
      semilla = (semilla * 1103515245 + 12345) % 2147483648
      return semilla / 2147483648
    }

    for (let intento = 0; intento < 500; intento++) {
      const n = 5 + Math.floor(siguiente() * 20)
      const valores = Array.from({ length: n }, () => siguiente() * 1000)
      const conteos = binarValores(valores, 8)
      expect(conteos.reduce((a, b) => a + b, 0)).toBe(valores.length)
    }
  })

  it('max === min no lanza y cuenta todo en el primer tramo', () => {
    const conteos = binarValores([50, 50, 50], 8)
    expect(conteos.reduce((a, b) => a + b, 0)).toBe(3)
    expect(conteos[0]).toBe(3)
  })
})
