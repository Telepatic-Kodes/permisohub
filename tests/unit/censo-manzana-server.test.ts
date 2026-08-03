import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  geometriaGeoJsonARings,
  obtenerPoblacionEnPoligono,
} from '@/lib/censo-manzana-server'

// Polígono de prueba pequeño (bounding box) alrededor de Providencia,
// Santiago — mismo estilo que el usado en 17-RESEARCH.md.
const poligonoProvidencia: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.618, -33.423],
      [-70.61, -33.423],
      [-70.61, -33.43],
      [-70.618, -33.43],
      [-70.618, -33.423],
    ],
  ],
}

function fixtureManzanas() {
  return {
    features: [
      {
        attributes: {
          TOTAL_PERS: 320,
          TOTAL_VIVI: 110,
          MANZENT_I: '13123010010001',
          NOM_COMUNA: 'PROVIDENCIA',
        },
      },
      {
        attributes: {
          TOTAL_PERS: 275,
          TOTAL_VIVI: 95,
          MANZENT_I: '13123010010002',
          NOM_COMUNA: 'PROVIDENCIA',
        },
      },
      {
        attributes: {
          TOTAL_PERS: 180,
          TOTAL_VIVI: 60,
          MANZENT_I: '13120010020015',
          NOM_COMUNA: 'ÑUÑOA',
        },
      },
    ],
  }
}

function fetchMockJson(json: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({ ok, status, json: async () => json })
}

describe('obtenerPoblacionEnPoligono', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('agrega TOTAL_PERS/TOTAL_VIVI correctamente y deduplica comunas', async () => {
    const fetchMock = fetchMockJson(fixtureManzanas())
    vi.stubGlobal('fetch', fetchMock)

    const result = await obtenerPoblacionEnPoligono(poligonoProvidencia)

    expect(result.ok).toBe(true)
    expect(result.totalPersonas).toBe(320 + 275 + 180)
    expect(result.totalViviendas).toBe(110 + 95 + 60)
    expect(result.manzanasIntersectadas).toBe(3)
    expect(result.comunasTocadas.sort()).toEqual(['PROVIDENCIA', 'ÑUÑOA'])
    expect(result.censoAno).toBe(2017)

    // Guard de regresión de URL — este test es el más importante del archivo:
    // el URL correcto (services9, cobertura RM real) debe ser el usado.
    expect(fetchMock.mock.calls[0][0]).toContain('services9.arcgis.com/kKJR3Qt68ohAWuet')
  })

  it('guard de regresión: NUNCA usa el URL incorrecto citado en STACK.md/ARCHITECTURE.md', async () => {
    const fetchMock = fetchMockJson(fixtureManzanas())
    vi.stubGlobal('fetch', fetchMock)

    await obtenerPoblacionEnPoligono(poligonoProvidencia)

    // Un revert accidental a este URL no produciría ningún error visible —
    // solo ceros silenciosos (cero cobertura RM). Este test existe
    // específicamente para que ese revert falle en CI.
    expect(fetchMock.mock.calls[0][0]).not.toContain('services3.arcgis.com/cTnMkBRk4HWkUCRo')
  })

  it('features: [] (respuesta bien formada pero vacía) → ok:true, totales en 0, no es un error', async () => {
    vi.stubGlobal('fetch', fetchMockJson({ features: [] }))

    const result = await obtenerPoblacionEnPoligono(poligonoProvidencia)

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.totalPersonas).toBe(0)
    expect(result.totalViviendas).toBe(0)
    expect(result.manzanasIntersectadas).toBe(0)
  })

  it('exceededTransferLimit: true → paginado: true', async () => {
    vi.stubGlobal(
      'fetch',
      fetchMockJson({ ...fixtureManzanas(), exceededTransferLimit: true })
    )

    const result = await obtenerPoblacionEnPoligono(poligonoProvidencia)

    expect(result.paginado).toBe(true)
  })

  it('HTTP no-200 → ok:false, totales en 0, error poblado, nunca lanza', async () => {
    vi.stubGlobal('fetch', fetchMockJson({}, false, 500))

    await expect(obtenerPoblacionEnPoligono(poligonoProvidencia)).resolves.toMatchObject({
      ok: false,
      totalPersonas: 0,
      totalViviendas: 0,
      manzanasIntersectadas: 0,
    })
    const result = await obtenerPoblacionEnPoligono(poligonoProvidencia)
    expect(result.error).toBeTruthy()
  })

  it('excepción de red → ok:false, totales en 0, error poblado, nunca lanza', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network fail'))
    )

    await expect(obtenerPoblacionEnPoligono(poligonoProvidencia)).resolves.toMatchObject({
      ok: false,
      totalPersonas: 0,
      totalViviendas: 0,
      manzanasIntersectadas: 0,
    })
    const result = await obtenerPoblacionEnPoligono(poligonoProvidencia)
    expect(result.error).toBeTruthy()
  })
})

describe('geometriaGeoJsonARings', () => {
  it('Polygon: retorna coordinates tal cual', () => {
    const result = geometriaGeoJsonARings(poligonoProvidencia)
    expect(result).toBe(poligonoProvidencia.coordinates)
  })

  it('MultiPolygon: aplana los rings de ambos polígonos en un solo array', () => {
    const polygon1Rings = [
      [
        [-70.618, -33.423],
        [-70.61, -33.423],
        [-70.61, -33.43],
        [-70.618, -33.423],
      ],
    ]
    const polygon2Rings = [
      [
        [-70.6, -33.44],
        [-70.59, -33.44],
        [-70.59, -33.45],
        [-70.6, -33.44],
      ],
    ]
    const multiPolygon: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [polygon1Rings, polygon2Rings],
    }

    const result = geometriaGeoJsonARings(multiPolygon)

    expect(result.length).toBe(polygon1Rings.length + polygon2Rings.length)
  })
})
