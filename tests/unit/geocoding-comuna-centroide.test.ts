import { afterEach, describe, expect, it, vi } from 'vitest'
import { geocodeComunaCentroide } from '@/lib/geocoding'

describe('geocodeComunaCentroide', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('usa parámetros estructurados city=/country=Chile, no q= libre', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '-33.42', lon: '-70.61', display_name: 'Providencia, Chile', address: { suburb: 'Providencia' } }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await geocodeComunaCentroide('Providencia')

    expect(result.ok).toBe(true)
    expect(result.lat).toBeCloseTo(-33.42)
    const [url] = fetchMock.mock.calls[0]
    const parsed = new URL(url as string)
    expect(parsed.searchParams.get('city')).toBe('Providencia')
    expect(parsed.searchParams.get('country')).toBe('Chile')
    expect(parsed.searchParams.has('q')).toBe(false)
  })

  it('retorna ok:false sin lanzar cuando Nominatim no encuentra la comuna', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    const result = await geocodeComunaCentroide('Comuna Inexistente')
    expect(result.ok).toBe(false)
  })
})
