import { describe, expect, it } from 'vitest'
import { evaluarOportunidad } from '@/lib/mercado-locales-server'

// Firma esperada (la función aún no existe en este punto — RED):
//
// function evaluarOportunidad(params: {
//   precioUf: number
//   precioUfM2: number | null
//   cohortP25Uf: number | null
//   cohortP25UfM2: number | null
//   historialReciente: { precio_monto: number; capturado_el: string }[]
// }): string[]

describe('evaluarOportunidad', () => {
  it('precioUfM2 <= cohortP25UfM2 → solo below_p25_ufm2 (mutuamente excluyente con below_p25_uf)', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 1000,
      precioUfM2: 30,
      cohortP25Uf: 1200, // precioUf <= cohortP25Uf también sería cierto
      cohortP25UfM2: 35,
      historialReciente: [],
    })
    expect(reasonCodes).toEqual(['below_p25_ufm2'])
  })

  it('precioUfM2 null y precioUf <= cohortP25Uf → below_p25_uf', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 1000,
      precioUfM2: null,
      cohortP25Uf: 1200,
      cohortP25UfM2: 35,
      historialReciente: [],
    })
    expect(reasonCodes).toEqual(['below_p25_uf'])
  })

  it('precioUfM2 no null pero no califica, precioUf <= cohortP25Uf → cae al else, below_p25_uf', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 1000,
      precioUfM2: 40, // > cohortP25UfM2, no califica
      cohortP25Uf: 1200,
      cohortP25UfM2: 35,
      historialReciente: [],
    })
    expect(reasonCodes).toEqual(['below_p25_uf'])
  })

  it('cohortP25Uf y cohortP25UfM2 ambos null → nunca agrega below_p25_ufm2 ni below_p25_uf', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 1,
      precioUfM2: 1,
      cohortP25Uf: null,
      cohortP25UfM2: null,
      historialReciente: [],
    })
    expect(reasonCodes).toEqual([])
  })

  it('historialReciente con 2 entradas, la última menor que la primera → price_drop_7d', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 5000,
      precioUfM2: null,
      cohortP25Uf: null,
      cohortP25UfM2: null,
      historialReciente: [
        { precio_monto: 100, capturado_el: '2026-07-26' },
        { precio_monto: 80, capturado_el: '2026-08-02' },
      ],
    })
    expect(reasonCodes).toEqual(['price_drop_7d'])
  })

  it('historialReciente con 3 entradas que bajan y luego suben (rebote) → NO price_drop_7d (solo compara las últimas dos)', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 5000,
      precioUfM2: null,
      cohortP25Uf: null,
      cohortP25UfM2: null,
      historialReciente: [
        { precio_monto: 100, capturado_el: '2026-07-20' },
        { precio_monto: 50, capturado_el: '2026-07-26' },
        { precio_monto: 80, capturado_el: '2026-08-02' },
      ],
    })
    expect(reasonCodes).toEqual([])
  })

  it('historialReciente con 1 sola entrada → nunca agrega price_drop_7d', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 5000,
      precioUfM2: null,
      cohortP25Uf: null,
      cohortP25UfM2: null,
      historialReciente: [{ precio_monto: 100, capturado_el: '2026-08-02' }],
    })
    expect(reasonCodes).toEqual([])
  })

  it('caso combinado: below_p25_ufm2 + price_drop_7d pueden coexistir', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 1000,
      precioUfM2: 30,
      cohortP25Uf: 1200,
      cohortP25UfM2: 35,
      historialReciente: [
        { precio_monto: 100, capturado_el: '2026-07-26' },
        { precio_monto: 80, capturado_el: '2026-08-02' },
      ],
    })
    expect(reasonCodes).toEqual(['below_p25_ufm2', 'price_drop_7d'])
  })

  it('ningún criterio califica → devuelve array vacío', () => {
    const reasonCodes = evaluarOportunidad({
      precioUf: 5000,
      precioUfM2: 100,
      cohortP25Uf: 1000,
      cohortP25UfM2: 20,
      historialReciente: [],
    })
    expect(reasonCodes).toEqual([])
  })
})
