import { describe, expect, it, vi, afterEach } from 'vitest'

import { contarDiasHabiles, getEstadoPlazoLey21718 } from '@/lib/dias-habiles'

describe('getEstadoPlazoLey21718 — regresión 2026', () => {
  it('calcula correctamente un caso conocido de 2026 (30 días hábiles, sin revisor)', () => {
    // fechaIngreso: lunes 15-jun-2026. hoy: miércoles 15-jul-2026.
    // Verificado a mano contra la tabla FERIADOS_CHILE[2026]: entre ambas
    // fechas caen 2 feriados hábiles (22-jun Pueblos Indígenas, 29-jun San
    // Pedro y San Pablo), ambos lunes, y ningún fin de semana adicional
    // rompe el conteo salvo los normales. Resultado esperado: 20 días
    // hábiles transcurridos de 30.
    const fechaIngreso = new Date('2026-06-15T00:00:00')
    const hoy = new Date('2026-07-15T00:00:00')

    const r = getEstadoPlazoLey21718(fechaIngreso, false, hoy)

    expect(r.diasHabilesDesdeIngreso).toBe(20)
    expect(r.plazoTotal).toBe(30)
    expect(r.diasHabilesRestantes).toBe(10)
    expect(r.estado).toBe('EN_PLAZO')
    expect(r.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-07-30')
    expect(r.feriadosIncompletos).toBe(false)
  })
})

describe('getEstadoPlazoLey21718 — guard de feriados incompletos (A3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('feriadosIncompletos=true cuando el año no está en FERIADOS_CHILE', () => {
    const r = getEstadoPlazoLey21718(
      new Date('2035-01-08T00:00:00'),
      false,
      new Date('2035-02-05T00:00:00')
    )
    expect(r.feriadosIncompletos).toBe(true)
  })

  it('feriadosIncompletos=false para un rango totalmente cubierto (2026)', () => {
    const r = getEstadoPlazoLey21718(
      new Date('2026-01-05T00:00:00'),
      false,
      new Date('2026-02-05T00:00:00')
    )
    expect(r.feriadosIncompletos).toBe(false)
  })

  it('emite console.warn cuando el año no está cubierto', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getEstadoPlazoLey21718(
      new Date('2036-01-08T00:00:00'),
      false,
      new Date('2036-02-05T00:00:00')
    )
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toContain('2036')
  })
})

describe('FERIADOS_CHILE 2028/2029 — extensión de la tabla', () => {
  it('trata el 26-jun-2028 (San Pedro y San Pablo, ley de lunes) como feriado', () => {
    // 26-jun-2028 es lunes (día hábil por calendario). Si no estuviera en
    // FERIADOS_CHILE, contarDiasHabiles devolvería 1 en vez de 0.
    const count = contarDiasHabiles(
      new Date('2028-06-26T00:00:00'),
      new Date('2028-06-27T00:00:00')
    )
    expect(count).toBe(0)
  })

  it('trata el 27-oct-2028 (Iglesias Evangélicas, trasladado a viernes) como feriado', () => {
    // 27-oct-2028 es viernes (día hábil por calendario).
    const count = contarDiasHabiles(
      new Date('2028-10-27T00:00:00'),
      new Date('2028-10-28T00:00:00')
    )
    expect(count).toBe(0)
  })

  it('trata el 2-jul-2029 (San Pedro y San Pablo, trasladado a lunes) como feriado', () => {
    // 2-jul-2029 es lunes (día hábil por calendario).
    const count = contarDiasHabiles(
      new Date('2029-07-02T00:00:00'),
      new Date('2029-07-03T00:00:00')
    )
    expect(count).toBe(0)
  })

  it('no trata un día laboral normal de 2029 como feriado', () => {
    // 20-jun-2029 es feriado (Pueblos Indígenas, solsticio); 25-jun-2029
    // (lunes) no debería serlo.
    const count = contarDiasHabiles(
      new Date('2029-06-25T00:00:00'),
      new Date('2029-06-26T00:00:00')
    )
    expect(count).toBe(1)
  })
})
