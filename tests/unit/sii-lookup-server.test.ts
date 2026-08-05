import { afterEach, describe, expect, it, vi } from 'vitest'
import { consultarRolEnSII, normalizarRolSII } from '@/lib/sii-lookup-server'
import { ScraperUnavailableError } from '@/lib/scraper'

// Fixture con la forma real de la ficha del SII: los marcadores del parser son
// `CAMPO</TD>` y el valor vive hasta el `</TD>` siguiente.
function fichaHtml(overrides: Partial<Record<string, string>> = {}): string {
  const c = {
    direccion: 'AV PROVIDENCIA 1234',
    region: 'METROPOLITANA',
    comuna: 'PROVIDENCIA',
    destino: 'COMERCIO',
    avaluo: '$ 48.500.000',
    avaluoUf: 'UF 1.234,5',
    terreno: '250,5 m²',
    construida: '180 m²',
    ...overrides,
  }
  return `<TABLE>
    <TR><TD>DIRECCIÓN</TD><TD>${c.direccion}</TD></TR>
    <TR><TD>REGIÓN</TD><TD>${c.region}</TD></TR>
    <TR><TD>COMUNA</TD><TD>${c.comuna}</TD></TR>
    <TR><TD>DESTINO</TD><TD>${c.destino}</TD></TR>
    <TR><TD>SUP.TERRENO</TD><TD>${c.terreno}</TD></TR>
    <TR><TD>SUP.CONSTRUIDA</TD><TD>${c.construida}</TD></TR>
    <TR><TD>AVALÚO FISCAL TOTAL UF</TD><TD>${c.avaluoUf}</TD></TR>
    <TR><TD>AVALÚO FISCAL TOTAL</TD><TD>${c.avaluo}</TD></TR>
  </TABLE>`
}

function stubFetch(body: string, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
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

  it('parsea una ficha completa', async () => {
    stubFetch(fichaHtml())
    const r = await consultarRolEnSII('1234-056')

    expect(r.ok).toBe(true)
    expect(r.rol).toBe('1234-056')
    expect(r.data).toMatchObject({
      direccion_normalizada: 'AV PROVIDENCIA 1234',
      comuna: 'PROVIDENCIA',
      destino: 'COMERCIO',
      avaluo_fiscal_clp: 48_500_000,
      superficie_terreno_m2: 250.5,
      superficie_construida_m2: 180,
    })
  })

  it('devuelve ok:false cuando responde pero no se parsea NINGÚN campo', async () => {
    // El caso que motivó la extracción: antes esto salía `ok: true` con
    // direccion:'', comuna:'' y todos los números en null, así que "cambió el
    // markup del SII" y "esta propiedad no tiene datos" se veían idénticos —
    // y la ficha pintaba los huecos como si fueran el dato real del predio.
    stubFetch('<html><body>Servicio en mantenimiento</body></html>')
    const r = await consultarRolEnSII('1234-056')

    expect(r.ok).toBe(false)
    expect(r.data).toBeUndefined()
    expect(r.error).toContain('no se parseó ningún campo')
    // El rol viaja incluso en el fallo: sin él, el mensaje no es accionable.
    expect(r.rol).toBe('1234-056')
  })

  it('una ficha parcial NO se descarta — hay predios sin construcción ni avalúo', async () => {
    stubFetch(fichaHtml({ construida: '', avaluo: '', avaluoUf: '' }))
    const r = await consultarRolEnSII('1234-056')

    expect(r.ok).toBe(true)
    expect(r.data?.comuna).toBe('PROVIDENCIA')
    // Sin dato ≠ cero: se guarda null, no 0.
    expect(r.data?.superficie_construida_m2).toBeNull()
    expect(r.data?.avaluo_fiscal_clp).toBeNull()
  })

  it('lanza ScraperUnavailableError ante HTTP no-2xx', async () => {
    // Exactamente lo que devuelve hoy zeus.sii.cl/avalu_cgi/br/erc0000.sh
    // (verificado en vivo el 05-08 con tres roles distintos).
    stubFetch('Error 404', 404)
    await expect(consultarRolEnSII('1234-056')).rejects.toBeInstanceOf(ScraperUnavailableError)
  })

  it('lanza ScraperUnavailableError ante error de red', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(consultarRolEnSII('1234-056')).rejects.toBeInstanceOf(ScraperUnavailableError)
  })
})
