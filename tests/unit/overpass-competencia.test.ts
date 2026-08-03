import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { obtenerCompetidoresOverpass } from '@/lib/overpass-competencia'

// El módulo mantiene un throttle module-level (lastRequestAt, MIN_INTERVAL_MS
// = 5000ms) que persiste entre tests dentro de este archivo — sin ayuda,
// cada test tras el primero esperaría ~5s reales. Se fake-ea SOLO Date (no
// setTimeout, para no interferir con el timeout interno de vitest) y se
// adelanta el reloj simulado en cada test lo suficiente para que
// throttle() vea siempre elapsed > MIN_INTERVAL_MS y nunca entre al branch
// de espera.
let relojSimulado = Date.now()

// Fixture realista: mezcla node/way, con y sin tags.name, un shop no
// relevante (bakery) que debe ser ignorado. Coordenadas alrededor de
// Providencia, Santiago (-33.4245, -70.6132).
const overpassFixture = {
  elements: [
    {
      type: 'node',
      lat: -33.424,
      lon: -70.6128,
      tags: { shop: 'supermarket', name: 'Santa Isabel' },
    },
    {
      type: 'way',
      center: { lat: -33.4255, lon: -70.614 },
      tags: { shop: 'convenience' }, // sin name — debe usar fallback
    },
    {
      type: 'node',
      lat: -33.426,
      lon: -70.615,
      tags: { shop: 'bakery', name: 'Panadería Don Juan' }, // shop no relevante — ignorado
    },
    {
      type: 'node',
      // Fuera del polígono de test definido abajo (lejos, ~a 5km al sur)
      lat: -33.47,
      lon: -70.62,
      tags: { shop: 'mall', name: 'Mall Alejano' },
    },
  ],
}

function fetchMockOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => overpassFixture,
  })
}

describe('obtenerCompetidoresOverpass', () => {
  beforeEach(() => {
    relojSimulado += 100_000 // gap > MIN_INTERVAL_MS respecto a cualquier lastRequestAt previo
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(relojSimulado)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('mapea tag→formato correctamente (supermarket/mall→supermercado, convenience→minimarket) e ignora shops no relevantes', async () => {
    vi.stubGlobal('fetch', fetchMockOk())

    const result = await obtenerCompetidoresOverpass(-33.4245, -70.6132)

    const nombres = result.map((c) => c.nombre)
    expect(nombres).not.toContain('Panadería Don Juan')

    const santaIsabel = result.find((c) => c.nombre === 'Santa Isabel')
    expect(santaIsabel?.formato).toBe('supermercado')
    expect(santaIsabel?.fuente).toBe('osm')

    const mall = result.find((c) => c.nombre === 'Mall Alejano')
    expect(mall?.formato).toBe('supermercado')
  })

  it('usa el fallback "(sin nombre — <tag>)" cuando el POI no trae tags.name ni tags.brand', async () => {
    vi.stubGlobal('fetch', fetchMockOk())

    const result = await obtenerCompetidoresOverpass(-33.4245, -70.6132)

    const sinNombre = result.find((c) => c.formato === 'minimarket')
    expect(sinNombre?.nombre).toBe('(sin nombre — convenience)')
  })

  it('calcula distanciaM como un número razonable (positivo, dentro del radio de consulta)', async () => {
    vi.stubGlobal('fetch', fetchMockOk())

    const result = await obtenerCompetidoresOverpass(-33.4245, -70.6132)

    for (const c of result) {
      expect(c.distanciaM).toBeGreaterThan(0)
      expect(c.distanciaM).toBeLessThan(10_000)
    }
  })

  it('filtra contra isocronaGeometria: excluye puntos fuera del polígono, incluye los de adentro', async () => {
    vi.stubGlobal('fetch', fetchMockOk())

    // Polígono pequeño alrededor del origen de consulta — solo cubre los
    // primeros 2 POIs del fixture (Santa Isabel + el convenience sin
    // nombre), excluye la panadería (ya filtrada por tag) y Mall Alejano
    // (fuera geográficamente, a ~5km).
    const isocronaGeometria: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-70.62, -33.42],
          [-70.60, -33.42],
          [-70.60, -33.43],
          [-70.62, -33.43],
          [-70.62, -33.42],
        ],
      ],
    }

    const result = await obtenerCompetidoresOverpass(-33.4245, -70.6132, isocronaGeometria)

    expect(result.some((c) => c.nombre === 'Santa Isabel')).toBe(true)
    expect(result.some((c) => c.nombre === 'Mall Alejano')).toBe(false)
  })
})
