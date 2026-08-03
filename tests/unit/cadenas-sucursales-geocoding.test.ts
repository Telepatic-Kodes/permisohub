import { afterEach, describe, expect, it, vi } from 'vitest'

const geocodeDireccionMock = vi.fn()
vi.mock('@/lib/geocoding', () => ({
  geocodeDireccion: (...args: unknown[]) => geocodeDireccionMock(...args),
}))

interface FilaCadena {
  id: string
  cadena: string
  calle: string
  numero: string
  comuna: string
  lat: number | null
  lng: number | null
}

let filasSimuladas: FilaCadena[] = []
const updateMock = vi.fn((_valores: { lat: number; lng: number; geocodificado_el: string }) => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      // Cadena de select() usada por obtenerCadenasGeocodificadasPorComuna:
      // .select(...).eq('vigente', true).in('cadena', cadenasActivas)
      select: () => ({
        eq: () => ({
          in: () => Promise.resolve({ data: filasSimuladas, error: null }),
        }),
      }),
      update: updateMock,
    }),
  }),
}))

// Import DESPUÉS de los vi.mock — hoisting de vitest los aplica antes igual,
// pero mantener el orden hace explícito que el módulo bajo prueba consume
// los mocks, no los módulos reales.
import { obtenerCadenasGeocodificadasPorComuna } from '@/lib/cadenas-sucursales-server'

describe('obtenerCadenasGeocodificadasPorComuna', () => {
  afterEach(() => {
    filasSimuladas = []
    geocodeDireccionMock.mockReset()
    updateMock.mockClear()
  })

  it('no vuelve a geocodificar una fila que ya tiene lat/lng (cache-through, Pitfall 4)', async () => {
    filasSimuladas = [
      {
        id: 'fila-1',
        cadena: 'Walmart Chile (Líder Express)',
        calle: 'Av. Pajaritos',
        numero: '1234',
        comuna: 'MAIPU',
        lat: -33.5,
        lng: -70.75,
      },
    ]

    const resultado = await obtenerCadenasGeocodificadasPorComuna('Maipú')

    expect(geocodeDireccionMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(resultado).toEqual([
      {
        cadena: 'Walmart Chile (Líder Express)',
        lat: -33.5,
        lng: -70.75,
        direccionLabel: 'Av. Pajaritos 1234',
      },
    ])
  })

  it('geocodifica UNA vez una fila sin lat/lng y persiste el resultado vía update()', async () => {
    filasSimuladas = [
      {
        id: 'fila-2',
        cadena: 'SMU (Alvi)',
        calle: 'Camino Rinconada',
        numero: '500',
        comuna: 'MAIPU',
        lat: null,
        lng: null,
      },
    ]
    geocodeDireccionMock.mockResolvedValue({
      ok: true,
      lat: -33.51,
      lng: -70.76,
      displayName: 'Camino Rinconada 500, Maipú, Chile',
    })

    const resultado = await obtenerCadenasGeocodificadasPorComuna('Maipú')

    expect(geocodeDireccionMock).toHaveBeenCalledTimes(1)
    expect(geocodeDireccionMock).toHaveBeenCalledWith('Camino Rinconada 500', 'MAIPU')
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock.mock.calls[0][0]).toMatchObject({ lat: -33.51, lng: -70.76 })
    expect(resultado).toEqual([
      {
        cadena: 'SMU (Alvi)',
        lat: -33.51,
        lng: -70.76,
        direccionLabel: 'Camino Rinconada 500, Maipú, Chile',
      },
    ])
  })

  it('no lanza cuando geocodeDireccion falla — la fila simplemente no aparece en el resultado', async () => {
    filasSimuladas = [
      {
        id: 'fila-3',
        cadena: 'SMU (Super10)',
        calle: 'Calle Inexistente',
        numero: '999',
        comuna: 'MAIPU',
        lat: null,
        lng: null,
      },
    ]
    geocodeDireccionMock.mockResolvedValue({ ok: false, error: 'Dirección no encontrada' })

    const resultado = await obtenerCadenasGeocodificadasPorComuna('Maipú')

    expect(updateMock).not.toHaveBeenCalled()
    expect(resultado).toEqual([])
  })
})
