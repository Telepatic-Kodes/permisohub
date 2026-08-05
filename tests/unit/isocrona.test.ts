import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerIsocrona, radioEquivalenteKm } from '@/lib/isocrona'

// Coordenada real usada para verificar Valhalla en vivo antes de escribir el
// módulo (Plaza Ñuñoa, Santiago).
const LAT = -33.4543164
const LNG = -70.5936358

/** Polígono mínimo con forma de isócrona (no un círculo). */
const POLIGONO_VALHALLA: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.5906, -33.4444],
      [-70.5921, -33.4448],
      [-70.5936, -33.4465],
      [-70.5946, -33.4456],
      [-70.5906, -33.4444],
    ],
  ],
}

function fetchMockJson(payload: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  })
}

describe('radioEquivalenteKm', () => {
  it('usa velocidades conservadoras — nunca sobreestima el alcance', () => {
    // 15 min caminando a 4,2 km/h = 1,05 km. Una persona promedio camina a
    // ~5 km/h en línea recta, así que el respaldo queda deliberadamente corto.
    expect(radioEquivalenteKm(15, 'caminando')).toBeCloseTo(1.05, 2)
    expect(radioEquivalenteKm(10, 'auto')).toBeCloseTo(3.67, 2)
  })

  it('el modo auto siempre alcanza más lejos que caminando a igual tiempo', () => {
    expect(radioEquivalenteKm(15, 'auto')).toBeGreaterThan(radioEquivalenteKm(15, 'caminando'))
  })
})

describe('obtenerIsocrona', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marca metodo=red_vial y nombra el proveedor cuando Valhalla responde', async () => {
    vi.stubGlobal('fetch', fetchMockJson({ features: [{ geometry: POLIGONO_VALHALLA }] }))

    const r = await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'caminando' })

    expect(r.metodo).toBe('red_vial')
    expect(r.proveedor).toBe('valhalla')
    expect(r.geometria).toEqual(POLIGONO_VALHALLA)
    expect(r.minutos).toBe(15)
    expect(r.modo).toBe('caminando')
  })

  it('cae a círculo y lo DECLARA cuando el proveedor devuelve error HTTP', async () => {
    vi.stubGlobal('fetch', fetchMockJson({}, false, 403))

    const r = await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'caminando' })

    // El punto central de todo el módulo: un círculo jamás se presenta como
    // isócrona de red vial — calcularVeredictoCabida() depende de esto para
    // degradar la confianza y negarse a emitir veredicto.
    expect(r.metodo).toBe('circulo_equivalente')
    expect(r.proveedor).toBeNull()
    expect(r.geometria.type).toBe('Polygon')
  })

  it('cae a círculo cuando la red falla, sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))

    const r = await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'caminando' })

    expect(r.metodo).toBe('circulo_equivalente')
    expect(r.proveedor).toBeNull()
  })

  it('cae a círculo cuando la respuesta no trae features utilizables', async () => {
    vi.stubGlobal('fetch', fetchMockJson({ features: [] }))
    expect((await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'auto' })).metodo).toBe(
      'circulo_equivalente'
    )

    // geometría presente pero de un tipo que no sirve para consultar el censo
    vi.stubGlobal('fetch', fetchMockJson({ features: [{ geometry: { type: 'LineString', coordinates: [[0, 0]] } }] }))
    expect((await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'auto' })).metodo).toBe(
      'circulo_equivalente'
    )
  })

  it('el círculo de respaldo es más chico en caminando que en auto (mismo tiempo)', async () => {
    vi.stubGlobal('fetch', fetchMockJson({}, false, 500))

    const caminando = await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'caminando' })
    const auto = await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 15, modo: 'auto' })

    const ancho = (g: GeoJSON.Polygon | GeoJSON.MultiPolygon) => {
      const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]
      const lngs = ring.map((p) => p[0])
      return Math.max(...lngs) - Math.min(...lngs)
    }

    expect(ancho(auto.geometria)).toBeGreaterThan(ancho(caminando.geometria))
  })

  it('pide a Valhalla el costing correcto según el modo', async () => {
    const fetchMock = fetchMockJson({ features: [{ geometry: POLIGONO_VALHALLA }] })
    vi.stubGlobal('fetch', fetchMock)

    await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 10, modo: 'auto' })
    expect(decodeURIComponent(fetchMock.mock.calls[0][0] as string)).toContain('"costing":"auto"')

    await obtenerIsocrona({ lat: LAT, lng: LNG, minutos: 10, modo: 'caminando' })
    expect(decodeURIComponent(fetchMock.mock.calls[1][0] as string)).toContain('"costing":"pedestrian"')
  })
})
