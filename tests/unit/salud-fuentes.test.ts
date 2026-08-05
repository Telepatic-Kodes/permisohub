import { describe, expect, it } from 'vitest'
import { clasificarSalud, medianaLatencia, ameritaAlerta, VENTANA_LATENCIA } from '@/lib/salud-fuentes'
import type { MedicionProbe } from '@/lib/salud-fuentes'

const UMBRAL = 3000

function medicion(ok: boolean, durationMs: number | null, diasAtras = 0): MedicionProbe {
  const fecha = new Date('2026-08-05T12:00:00.000Z')
  fecha.setUTCDate(fecha.getUTCDate() - diasAtras)
  return { ok, durationMs, ranAt: fecha.toISOString() }
}

describe('clasificarSalud', () => {
  it('sin historial devuelve sin_datos, NUNCA ok', () => {
    // El caso que hace que un tablero mienta: si el probe dejó de correr,
    // "verde" sería una afirmación sobre algo que nadie midió.
    expect(clasificarSalud([], UMBRAL)).toBe('sin_datos')
  })

  it('último probe fallido devuelve caido aunque el resto del historial esté sano', () => {
    const historial = [medicion(false, null, 0), medicion(true, 500, 1), medicion(true, 480, 2)]
    expect(clasificarSalud(historial, UMBRAL)).toBe('caido')
  })

  it('último probe ok con mediana bajo el umbral devuelve ok', () => {
    const historial = [medicion(true, 700, 0), medicion(true, 800, 1), medicion(true, 750, 2)]
    expect(clasificarSalud(historial, UMBRAL)).toBe('ok')
  })

  it('un pico aislado NO dispara lento — la mediana lo absorbe', () => {
    const historial = [
      medicion(true, 9000, 0),
      medicion(true, 700, 1),
      medicion(true, 750, 2),
      medicion(true, 690, 3),
      medicion(true, 720, 4),
    ]
    expect(clasificarSalud(historial, UMBRAL)).toBe('ok')
  })

  it('degradación sostenida sí devuelve lento', () => {
    const historial = [
      medicion(true, 8000, 0),
      medicion(true, 7600, 1),
      medicion(true, 9100, 2),
      medicion(true, 700, 3),
      medicion(true, 720, 4),
    ]
    expect(clasificarSalud(historial, UMBRAL)).toBe('lento')
  })

  it('solo mira las últimas VENTANA_LATENCIA mediciones', () => {
    // 5 recientes rápidas + historia vieja lentísima: la vieja no debe pesar.
    const recientes = Array.from({ length: VENTANA_LATENCIA }, (_, i) => medicion(true, 500, i))
    const viejas = Array.from({ length: 10 }, (_, i) => medicion(true, 30_000, i + VENTANA_LATENCIA))
    expect(clasificarSalud([...recientes, ...viejas], UMBRAL)).toBe('ok')
  })

  it('un historial ok pero sin latencias medidas no se inventa un veredicto de lentitud', () => {
    // duration_ms null = corridas viejas, previas a la migración. Que no haya
    // medición no puede leerse como "midió 0 y por lo tanto está rapidísimo".
    const historial = [medicion(true, null, 0), medicion(true, null, 1)]
    expect(clasificarSalud(historial, UMBRAL)).toBe('ok')
    expect(medianaLatencia(historial)).toBeNull()
  })
})

describe('medianaLatencia', () => {
  it('ignora los probes fallidos — su duración es "cuánto tardó en fallar"', () => {
    const historial = [medicion(true, 1000, 0), medicion(false, 15_000, 1), medicion(true, 1200, 2)]
    expect(medianaLatencia(historial)).toBe(1100)
  })

  it('con cantidad impar toma el valor del medio', () => {
    const historial = [medicion(true, 300, 0), medicion(true, 100, 1), medicion(true, 200, 2)]
    expect(medianaLatencia(historial)).toBe(200)
  })

  it('devuelve null si no hay ninguna latencia utilizable', () => {
    expect(medianaLatencia([medicion(false, null, 0)])).toBeNull()
    expect(medianaLatencia([])).toBeNull()
  })
})

describe('ameritaAlerta', () => {
  it('alerta en caido y lento', () => {
    expect(ameritaAlerta('caido')).toBe(true)
    expect(ameritaAlerta('lento')).toBe(true)
  })

  it('NO alerta en sin_datos — no hay nada que reportar, y un falso rojo diario mata el canal', () => {
    expect(ameritaAlerta('sin_datos')).toBe(false)
    expect(ameritaAlerta('ok')).toBe(false)
  })
})
