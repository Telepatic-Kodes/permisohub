import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CompetidorDetectado, UbicacionCabida } from '@/lib/cabida-comercial'
import type { CadenaGeocodificada } from '@/lib/cadenas-sucursales-server'

const obtenerCompetidoresOverpassMock = vi.fn()
vi.mock('@/lib/overpass-competencia', () => ({
  obtenerCompetidoresOverpass: (...args: unknown[]) => obtenerCompetidoresOverpassMock(...args),
}))

const obtenerCadenasGeocodificadasPorComunaMock = vi.fn()
vi.mock('@/lib/cadenas-sucursales-server', () => ({
  obtenerCadenasGeocodificadasPorComuna: (...args: unknown[]) =>
    obtenerCadenasGeocodificadasPorComunaMock(...args),
}))

const obtenerCompetidoresSeedListMock = vi.fn()
vi.mock('@/lib/strip-power-centers-chile', () => ({
  obtenerCompetidoresSeedList: (...args: unknown[]) => obtenerCompetidoresSeedListMock(...args),
}))

// Import DESPUÉS de los vi.mock — mismo criterio que
// tests/unit/cadenas-sucursales-geocoding.test.ts.
import { obtenerCompetenciaPorFormato } from '@/lib/competencia-formato'

const UBICACION: UbicacionCabida = {
  lat: -33.45,
  lng: -70.6,
  comuna: 'Ñuñoa',
  precision: 'aproximada',
  direccionLabel: 'Av. Irarrázaval 3000',
  fuenteTexto: 'Av. Irarrázaval 3000, Ñuñoa',
}

const poiOsmCercaDeCadena: CompetidorDetectado = {
  nombre: 'supermarket',
  formato: 'supermercado',
  fuente: 'osm',
  lat: -33.4501, // ~muy cerca de la cadena mockeada abajo
  lng: -70.6001,
  distanciaM: 500,
  confianza: 'media',
}

const poiOsmLejosDeCadena: CompetidorDetectado = {
  nombre: 'convenience',
  formato: 'supermercado',
  fuente: 'osm',
  lat: -33.5, // lejos de la cadena mockeada
  lng: -70.7,
  distanciaM: 900,
  confianza: 'media',
}

const cadenaSiiCercana: CadenaGeocodificada = {
  cadena: 'Líder Express',
  lat: -33.45,
  lng: -70.6,
  direccionLabel: 'Av. Irarrázaval 3050',
}

describe('obtenerCompetenciaPorFormato', () => {
  afterEach(() => {
    obtenerCompetidoresOverpassMock.mockReset()
    obtenerCadenasGeocodificadasPorComunaMock.mockReset()
    obtenerCompetidoresSeedListMock.mockReset()
  })

  it('strip_center → llama obtenerCompetidoresSeedList, nunca Overpass ni geocoding SII', async () => {
    obtenerCompetidoresSeedListMock.mockReturnValue([])

    await obtenerCompetenciaPorFormato(UBICACION, 'strip_center')

    expect(obtenerCompetidoresSeedListMock).toHaveBeenCalledTimes(1)
    expect(obtenerCompetidoresSeedListMock).toHaveBeenCalledWith(
      'strip_center',
      UBICACION,
      expect.any(Number),
      undefined
    )
    expect(obtenerCompetidoresOverpassMock).not.toHaveBeenCalled()
    expect(obtenerCadenasGeocodificadasPorComunaMock).not.toHaveBeenCalled()
  })

  it('supermercado → llama Overpass y geocoding SII en paralelo (Promise.all, no secuencial)', async () => {
    const orden: string[] = []
    let resolverOverpass!: (v: CompetidorDetectado[]) => void
    let resolverCadenas!: (v: CadenaGeocodificada[]) => void

    obtenerCompetidoresOverpassMock.mockImplementation(() => {
      orden.push('overpass-llamado')
      return new Promise<CompetidorDetectado[]>((resolve) => {
        resolverOverpass = resolve
      })
    })
    obtenerCadenasGeocodificadasPorComunaMock.mockImplementation(() => {
      orden.push('cadenas-llamado')
      return new Promise<CadenaGeocodificada[]>((resolve) => {
        resolverCadenas = resolve
      })
    })

    const promesaResultado = obtenerCompetenciaPorFormato(UBICACION, 'supermercado')

    // Ambas llamadas deben haberse disparado ANTES de que ninguna resuelva —
    // si fuera secuencial, 'cadenas-llamado' solo aparecería después de
    // resolver Overpass.
    await Promise.resolve() // deja correr microtasks para que ambos mocks se invoquen
    expect(orden).toEqual(['overpass-llamado', 'cadenas-llamado'])

    resolverOverpass([])
    resolverCadenas([])
    await promesaResultado

    expect(obtenerCompetidoresOverpassMock).toHaveBeenCalledTimes(1)
    expect(obtenerCadenasGeocodificadasPorComunaMock).toHaveBeenCalledTimes(1)
  })

  it('POI OSM a <150m de una cadena SII geocodificada → nombre real, fuente sii_geocodificado, confianza alta', async () => {
    obtenerCompetidoresOverpassMock.mockResolvedValue([poiOsmCercaDeCadena])
    obtenerCadenasGeocodificadasPorComunaMock.mockResolvedValue([cadenaSiiCercana])

    const resultado = await obtenerCompetenciaPorFormato(UBICACION, 'supermercado')

    expect(resultado.competidores).toHaveLength(1)
    expect(resultado.competidores[0]).toMatchObject({
      nombre: 'Líder Express',
      fuente: 'sii_geocodificado',
      confianza: 'alta',
    })
  })

  it('POI OSM a >150m de cualquier cadena SII → conserva nombre/fuente original de Overpass, sin match', async () => {
    obtenerCompetidoresOverpassMock.mockResolvedValue([poiOsmLejosDeCadena])
    obtenerCadenasGeocodificadasPorComunaMock.mockResolvedValue([cadenaSiiCercana])

    const resultado = await obtenerCompetenciaPorFormato(UBICACION, 'supermercado')

    expect(resultado.competidores).toHaveLength(1)
    expect(resultado.competidores[0]).toMatchObject({
      nombre: 'convenience',
      fuente: 'osm',
      confianza: 'media',
    })
  })

  it('el resultado final siempre pasa por calcularResultadoCompetencia (coberturaConocida: false)', async () => {
    obtenerCompetidoresOverpassMock.mockResolvedValue([])
    obtenerCadenasGeocodificadasPorComunaMock.mockResolvedValue([])

    const resultado = await obtenerCompetenciaPorFormato(UBICACION, 'supermercado')

    expect(resultado.coberturaConocida).toBe(false)
    expect(resultado.formato).toBe('supermercado')
    expect(typeof resultado.disclosure).toBe('string')
    expect(new Date(resultado.consultadoEl).toString()).not.toBe('Invalid Date')
  })
})
