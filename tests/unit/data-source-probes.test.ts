import { describe, expect, it } from 'vitest'
import { correrProbe, PROBES } from '@/lib/data-source-probes'
import type { Probe } from '@/lib/data-source-probes'

// Probes falsos: ninguno toca la red. La verificación contra los servicios
// reales se hizo en vivo (05-08) y NO vive en la suite a propósito — un test
// que depende de Valhalla/ArcGIS/Nominatim/Overpass estando arriba convierte
// una caída de terceros en un CI rojo, que es justamente la confusión que
// este subsistema existe para evitar.
function probeFalso(overrides: Partial<Probe> & Pick<Probe, 'ejecutar'>): Probe {
  return {
    sourceId: 'fuente-de-prueba',
    nombre: 'Fuente de prueba',
    umbralLatenciaMs: 1000,
    pausaReintentoMs: 0,
    ...overrides,
  }
}

describe('correrProbe', () => {
  it('éxito a la primera: 1 intento y detalle sin anotación', async () => {
    const r = await correrProbe(probeFalso({ ejecutar: async () => ({ ok: true, detalle: '53 manzanas' }) }))
    expect(r.ok).toBe(true)
    expect(r.intentosUsados).toBe(1)
    expect(r.detalle).toBe('53 manzanas')
  })

  it('éxito en el segundo intento NO se guarda igual que un éxito limpio', async () => {
    // El caso que motivó intentosUsados: medido en vivo, Overpass devolvió
    // 429 → 20 s de backoff → éxito. La fila persistida decía "ok, 2.433 ms",
    // indistinguible de un servicio sano, escondiendo 18 s de reloj real.
    let llamadas = 0
    const r = await correrProbe(
      probeFalso({
        ejecutar: async () => {
          llamadas++
          if (llamadas === 1) return { ok: false, detalle: '429' }
          return { ok: true, detalle: '7 anchors' }
        },
      })
    )
    expect(r.ok).toBe(true)
    expect(r.intentosUsados).toBe(2)
    expect(r.detalle).toBe('7 anchors [2 intentos]')
  })

  it('agota los intentos configurados antes de declarar fallo', async () => {
    let llamadas = 0
    const r = await correrProbe(
      probeFalso({
        intentos: 3,
        ejecutar: async () => {
          llamadas++
          return { ok: false, detalle: 'sigue caído' }
        },
      })
    )
    expect(r.ok).toBe(false)
    expect(llamadas).toBe(3)
    expect(r.intentosUsados).toBe(3)
  })

  it('un probe que LANZA es un probe que falló, no una corrida que revienta', async () => {
    const r = await correrProbe(
      probeFalso({
        ejecutar: async () => {
          throw new TypeError('fetch failed')
        },
      })
    )
    expect(r.ok).toBe(false)
    expect(r.detalle).toContain('TypeError: fetch failed')
    expect(r.durationMs).not.toBeNull()
  })

  it('totalMs cubre todos los intentos, durationMs solo el último', async () => {
    let llamadas = 0
    const r = await correrProbe(
      probeFalso({
        pausaReintentoMs: 50,
        ejecutar: async () => {
          llamadas++
          if (llamadas === 1) {
            await new Promise((resolve) => setTimeout(resolve, 80))
            return { ok: false, detalle: 'lento y fallido' }
          }
          return { ok: true, detalle: 'ok' }
        },
      })
    )
    expect(r.totalMs).toBeGreaterThanOrEqual(130) // 80 del fallido + 50 de pausa
    expect(r.durationMs!).toBeLessThan(80)
  })
})

describe('registro de PROBES', () => {
  it('cada probe declara un sourceId único', () => {
    const ids = PROBES.map((p) => p.sourceId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo probe define un umbral de latencia positivo', () => {
    // Un umbral en 0 o negativo haría que la fuente saliera 'lento' siempre,
    // que es la forma más rápida de que nadie mire más este tablero.
    for (const p of PROBES) {
      expect(p.umbralLatenciaMs).toBeGreaterThan(0)
    }
  })
})
