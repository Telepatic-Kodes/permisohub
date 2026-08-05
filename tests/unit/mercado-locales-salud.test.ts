import { afterEach, describe, expect, it, vi } from 'vitest'
import { saludDeCorrida } from '@/lib/mercado-locales-server'
import type { ResultadoDescubrimientoMercadoLocales } from '@/lib/mercado-locales-server'
import { ScraperUnavailableError } from '@/lib/scrapers/mercado-locales-common'
import { buscarLocalesComerciales as buscarDoomos } from '@/lib/scrapers/doomos'
import { buscarLocalesComerciales as buscarPortal } from '@/lib/scrapers/portalinmobiliario'

function corrida(overrides: Partial<ResultadoDescubrimientoMercadoLocales> = {}): ResultadoDescubrimientoMercadoLocales {
  return {
    comunasBuscadas: 72,
    encontrados: 450,
    guardados: 380,
    dadosDeBaja: 12,
    errors: [],
    fallosDeFuente: 0,
    ...overrides,
  }
}

describe('saludDeCorrida', () => {
  it('una corrida normal es ok', () => {
    expect(saludDeCorrida(corrida()).status).toBe('ok')
  })

  it('cero encontrados CON fallos de fuente es error — el caso que se veía verde', () => {
    // Reproduce lo que pasó el 5 ago: mercado-locales-doomos quedó registrado
    // como `status: 'ok', row_count: 0` viniendo de 452 filas, y el tablero lo
    // mostró sano durante un día.
    const salud = saludDeCorrida(corrida({ encontrados: 0, guardados: 0, fallosDeFuente: 72, errors: ['Providencia/arriendo: Doomos no disponible: HTTP 503'] }))
    expect(salud.status).toBe('error')
    expect(salud.errorMessage).toContain('no se pudo consultar')
  })

  it('cero en TODO el universo es error aunque nadie haya reportado un fallo', () => {
    // El caso que se me escapó en la primera versión de esta función, y que
    // solo apareció corriendo la ruta real: Portalinmobiliario devolvió 200 en
    // los 72 pares (redirigido a /gz/account-verification) y la corrida salía
    // `ok` con fallosDeFuente: 0, porque técnicamente nada había fallado.
    const salud = saludDeCorrida(corrida({ encontrados: 0, guardados: 0, fallosDeFuente: 0 }))
    expect(salud.status).toBe('error')
    expect(salud.errorMessage).toContain('no devolvió nada parseable')
  })

  it('cero en un universo chico sigue siendo ok — ahí sí es plausible', () => {
    // Una comuna sin locales de un tipo poco común es un cero legítimo. El
    // umbral existe para no convertir ese caso en una alerta.
    expect(saludDeCorrida(corrida({ comunasBuscadas: 2, encontrados: 0, guardados: 0, fallosDeFuente: 0 })).status).toBe('ok')
  })

  it('mayoría de pares caídos es error aunque algo se haya guardado', () => {
    const salud = saludDeCorrida(corrida({ encontrados: 8, guardados: 8, fallosDeFuente: 70 }))
    expect(salud.status).toBe('error')
    expect(salud.errorMessage).toContain('70 de 72')
  })

  it('fallos aislados NO son error — una alerta diaria por un timeout suelto deja de leerse', () => {
    const salud = saludDeCorrida(corrida({ fallosDeFuente: 2 }))
    expect(salud.status).toBe('ok')
    // Pero quedan en la serie, que es donde se ve si están creciendo.
    expect(salud.detail).toContain('2/72 pares sin respuesta')
  })

  it('detail siempre lleva los tres números, también en las corridas sanas', () => {
    expect(saludDeCorrida(corrida()).detail).toBe('450 encontrados, 380 guardados, 0/72 pares sin respuesta de la fuente')
  })
})

describe('scrapers: "no pude buscar" ya no se disfraza de "no hay nada"', () => {
  afterEach(() => vi.unstubAllGlobals())

  for (const [nombre, buscar] of [
    ['doomos', buscarDoomos],
    ['portalinmobiliario', buscarPortal],
  ] as const) {
    it(`${nombre} lanza ante HTTP no-2xx en vez de devolver []`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
      await expect(buscar('Providencia', 'arriendo')).rejects.toBeInstanceOf(ScraperUnavailableError)
    })

    it(`${nombre} lanza ante error de red`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
      await expect(buscar('Providencia', 'arriendo')).rejects.toBeInstanceOf(ScraperUnavailableError)
    })

    it(`${nombre} sigue devolviendo [] para una comuna fuera del mapa de slugs`, async () => {
      // Este SÍ es un vacío legítimo: es configuración, determinista y ya
      // avisada — no un fallo de la fuente.
      await expect(buscar('Comuna Inventada', 'arriendo')).resolves.toEqual([])
    })
  }
})

describe('bloqueo suave: 200 sobre una página de verificación', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('portalinmobiliario lanza si lo redirigen fuera del listado', async () => {
    // Verificado en vivo el 05-08: 302 → /gz/account-verification, y como
    // fetch sigue redirects, res.ok termina en true sobre 19 KB de desafío.
    vi.stubGlobal('fetch', vi.fn(async () => {
      const r = new Response('<html><body>verificación</body></html>', { status: 200 })
      Object.defineProperty(r, 'url', { value: 'https://www.portalinmobiliario.com/gz/account-verification?go=x' })
      return r
    }))
    await expect(buscarPortal('Providencia', 'arriendo')).rejects.toThrow(/redirigido fuera del listado/)
  })

  it('portalinmobiliario NO lanza cuando la URL final sigue siendo la del listado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const r = new Response('<html><body>sin resultados</body></html>', { status: 200 })
      Object.defineProperty(r, 'url', { value: 'https://www.portalinmobiliario.com/arriendo/local/providencia-metropolitana' })
      return r
    }))
    await expect(buscarPortal('Providencia', 'arriendo')).resolves.toEqual([])
  })
})
