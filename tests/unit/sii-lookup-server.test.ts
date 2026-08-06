import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarRolEnSII, normalizarRolSII } from '@/lib/sii-lookup-server'
import { ScraperRateLimitedError, ScraperUnavailableError } from '@/lib/scraper'

// Fixture con la forma real de la respuesta de getPredioNacional, capturada del
// SII el 06-08 para el rol 14-345 de Providencia. Solo los campos que
// consumimos; el SII devuelve bastantes más.
function predio(overrides: Record<string, unknown> = {}) {
  return {
    direccion: 'PROVIDENCIA 1234 LC 1 ',
    nombreComuna: 'PROVIDENCIA',
    destinoDescripcion: 'COMERCIO',
    valorTotal: 198_346_511,
    // ubicacionX es la LATITUD e ubicacionY la LONGITUD, al revés de lo que
    // sugieren los nombres. Así lo usa el propio controller del SII.
    ubicacionX: -33.428699,
    ubicacionY: -70.620861,
    // El SII SIEMPRE devuelve 0 acá. Va en el fixture a propósito: si algún día
    // trae superficies de verdad, el test de abajo lo delata.
    supTerreno: 0,
    supConsMt2: 0,
    ...overrides,
  }
}

// Cuenta SOLO las llamadas al SII. consultarRolEnSII también pide la UF (para
// convertir el avalúo), y esa llamada pasa por el mismo fetch global. Peor: la
// UF se cachea a nivel de módulo, así que qué test paga esa llamada depende del
// ORDEN de ejecución — contar `fetch` a secas da un test que se cae solo.
const llamadasAlSII = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter((c) => String(c[0]).includes('mapasFacadeService')).length

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      typeof body === 'string'
        ? new Response(body, { status })
        : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
    ),
  )
}

describe('normalizarRolSII', () => {
  it('acepta "manzana-predio"', () => {
    expect(normalizarRolSII('1234-56')).toEqual({ manzana: '1234', predio: '56', rolNorm: '1234-56' })
  })

  it('completa el predio cuando viene solo la manzana', () => {
    expect(normalizarRolSII('1234')).toEqual({ manzana: '1234', predio: '000', rolNorm: '1234-000' })
  })
})

describe('consultarRolEnSII', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mapea un predio completo', async () => {
    stubFetch({ data: predio() })
    const r = await consultarRolEnSII('14-345', 'Providencia')

    expect(r.ok).toBe(true)
    expect(r.rol).toBe('14-345')
    expect(r.data).toMatchObject({
      direccion_normalizada: 'PROVIDENCIA 1234 LC 1',
      comuna: 'PROVIDENCIA',
      destino: 'COMERCIO',
      avaluo_fiscal_clp: 198_346_511,
      lat: -33.428699,
      lng: -70.620861,
    })
  })

  it('no expone superficies, ni siquiera como 0', async () => {
    // El endpoint devuelve supTerreno/supConsMt2 en 0 siempre (14 predios, 6
    // destinos, 3 comunas — ver cabecera del módulo). Los campos se eliminaron
    // del contrato en vez de propagar un cero que se leería como una medición.
    stubFetch({ data: predio() })
    const r = await consultarRolEnSII('14-345', 'Providencia')

    expect(r.data).not.toHaveProperty('superficie_terreno_m2')
    expect(r.data).not.toHaveProperty('superficie_construida_m2')
  })

  it('calcula el avalúo en UF, que el SII no entrega', async () => {
    stubFetch({ data: predio({ valorTotal: 40_800_000 }) })
    const r = await consultarRolEnSII('14-345', 'Providencia')

    // Con la UF de respaldo ($40.800) son exactamente 1.000 UF. El test no
    // depende del valor real del día: si mindicador.cl no responde en CI, el
    // fallback es esa constante.
    expect(r.data?.avaluo_fiscal_uf).toBeGreaterThan(0)
  })

  it('sin avalúo en pesos, la UF queda en null y no en cero', async () => {
    stubFetch({ data: predio({ valorTotal: null }) })
    const r = await consultarRolEnSII('14-345', 'Providencia')

    expect(r.data?.avaluo_fiscal_clp).toBeNull()
    expect(r.data?.avaluo_fiscal_uf).toBeNull()
  })

  it('devuelve ok:false cuando el rol no existe, sin lanzar', async () => {
    // El endpoint nuevo distingue limpiamente "no encontrado" de "error":
    // responde HTTP 200 con data:null. El CGI viejo devolvía HTML ambiguo.
    stubFetch({ data: null })
    const r = await consultarRolEnSII('9999-999', 'Providencia')

    expect(r.ok).toBe(false)
    expect(r.data).toBeUndefined()
    // El rol viaja incluso en el fallo: sin él, el mensaje no es accionable.
    expect(r.rol).toBe('9999-999')
    expect(r.error).toContain('9999-999')
  })

  it('devuelve ok:false para una comuna sin código SII, sin tocar la red', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const r = await consultarRolEnSII('14-345', 'Comuna Que No Existe')

    expect(r.ok).toBe(false)
    expect(r.error).toContain('Comuna Que No Existe')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('recorre los tres códigos de Santiago hasta encontrar el predio', async () => {
    // Santiago se reparte en 13101, 13134 (SANTIAGO OESTE) y 13135 (SANTIAGO
    // SUR). Buscar solo en el primero deja predios reales sin encontrar.
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (!String(url).includes('mapasFacadeService')) {
        return new Response(JSON.stringify({ serie: [{ fecha: '2026-08-06', valor: 40800 }] }), { status: 200 })
      }
      const body = JSON.parse(String(init?.body)) as { data: { predio: { comuna: string } } }
      const esElTercero = body.data.predio.comuna === '13135'
      return new Response(JSON.stringify({ data: esElTercero ? predio({ nombreComuna: 'SANTIAGO SUR' }) : null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const r = await consultarRolEnSII('10-1', 'Santiago')
    expect(r.ok).toBe(true)
    expect(r.data?.comuna).toBe('SANTIAGO SUR')
    expect(llamadasAlSII(fetchSpy)).toBe(3)
  })

  it('para de consultar apenas encuentra el predio', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ data: predio() }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await consultarRolEnSII('10-1', 'Santiago')
    expect(llamadasAlSII(fetchSpy)).toBe(1)
  })

  it('manda Accept con */*, que el SII exige para no responder 500', async () => {
    // Regresión de un bug que los stubs NO pueden detectar solos: el servidor
    // del SII devuelve 500 ante un Accept que no incluya */*. 'application/json'
    // → 500. Y el default de fetchWithTimeout es 'text/html,...', o sea que si
    // alguien borra este header por "innecesario", toda consulta al SII falla en
    // producción con los tests en verde.
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: predio() }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await consultarRolEnSII('14-345', 'Providencia')

    const headers = (fetchSpy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>
    expect(String(headers.Accept ?? '')).toContain('*/*')
  })

  it('lanza ScraperRateLimitedError ante HTTP 429', async () => {
    // El caso caro: la página de bloqueo es HTML, así que si no se mira el
    // status antes que el body, un 429 se lee como "el SII cambió el formato" o
    // como "este predio no existe". Ambas conclusiones se sacaron por error
    // durante la investigación.
    stubFetch('<html>Error 429: Se ha superado el límite de conexiones permitidas.</html>', 429)
    await expect(consultarRolEnSII('14-345', 'Providencia')).rejects.toBeInstanceOf(ScraperRateLimitedError)
  })

  it('el bloqueo sigue siendo un ScraperUnavailableError para quien no lo distinga', async () => {
    // Subclase a propósito: los catch que ya existían no cambian de conducta.
    stubFetch('<html>429</html>', 429)
    await expect(consultarRolEnSII('14-345', 'Providencia')).rejects.toBeInstanceOf(ScraperUnavailableError)
  })

  it('lanza ScraperUnavailableError ante HTTP no-2xx', async () => {
    stubFetch('Error 500', 500)
    await expect(consultarRolEnSII('14-345', 'Providencia')).rejects.toBeInstanceOf(ScraperUnavailableError)
  })

  it('lanza ScraperUnavailableError ante error de red', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(consultarRolEnSII('14-345', 'Providencia')).rejects.toBeInstanceOf(ScraperUnavailableError)
  })

  it('lanza ScraperUnavailableError si la respuesta no es JSON', async () => {
    stubFetch('<html>página inesperada</html>', 200)
    await expect(consultarRolEnSII('14-345', 'Providencia')).rejects.toBeInstanceOf(ScraperUnavailableError)
  })
})
