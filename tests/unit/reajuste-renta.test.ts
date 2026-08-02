import { afterEach, describe, expect, it, vi } from 'vitest'
import { calcularEstadoReajuste, estimarRentaReajustadaIPC } from '@/lib/reajuste-renta'

describe('calcularEstadoReajuste', () => {
  const hoy = new Date('2026-08-02T12:00:00')

  it('no_aplica cuando la propiedad no tiene cláusula de reajuste', () => {
    const r = calcularEstadoReajuste({ reajusteAplica: false, periodicidadMeses: 12, fechaUltimo: '2025-01-01' }, hoy)
    expect(r.estado).toBe('no_aplica')
    expect(r.proximaFecha).toBeNull()
    expect(r.diasParaProximo).toBeNull()
  })

  it('sin_registro cuando aplica pero falta la periodicidad', () => {
    const r = calcularEstadoReajuste({ reajusteAplica: true, periodicidadMeses: null, fechaUltimo: '2025-01-01' }, hoy)
    expect(r.estado).toBe('sin_registro')
    expect(r.proximaFecha).toBeNull()
  })

  it('sin_registro cuando aplica pero falta la fecha del último reajuste', () => {
    const r = calcularEstadoReajuste({ reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: null }, hoy)
    expect(r.estado).toBe('sin_registro')
    expect(r.proximaFecha).toBeNull()
  })

  it('vencido cuando la próxima fecha ya pasó (1 día después)', () => {
    // periodicidad 12 meses, último reajuste 2025-08-01 → próxima 2026-08-01, ya pasó.
    const r = calcularEstadoReajuste({ reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: '2025-08-01' }, hoy)
    expect(r.estado).toBe('vencido')
    expect(r.proximaFecha).toBe('2026-08-01')
    expect(r.diasParaProximo).toBeLessThan(0)
  })

  it('proximo cuando faltan 30 días o menos para el próximo reajuste', () => {
    // último reajuste 2025-08-15, periodicidad 12 → próxima 2026-08-15 (13 días desde hoy 2026-08-02)
    const r = calcularEstadoReajuste({ reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: '2025-08-15' }, hoy)
    expect(r.estado).toBe('proximo')
    expect(r.diasParaProximo).toBe(13)
  })

  it('al_dia cuando el reajuste recién se aplicó', () => {
    // último reajuste hoy mismo, periodicidad 12 → próxima 2027-08-02, muy lejos.
    const r = calcularEstadoReajuste({ reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: '2026-08-02' }, hoy)
    expect(r.estado).toBe('al_dia')
    expect(r.proximaFecha).toBe('2027-08-02')
  })

  it('el día exacto de la próxima fecha ya es "vencido" (boundary), sin importar la hora', () => {
    // último reajuste 2025-08-02, periodicidad 12 → próxima 2026-08-02.
    const temprano = calcularEstadoReajuste(
      { reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: '2025-08-02' },
      new Date('2026-08-02T00:05:00'),
    )
    const tarde = calcularEstadoReajuste(
      { reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: '2025-08-02' },
      new Date('2026-08-02T23:50:00'),
    )
    expect(temprano.estado).toBe('vencido')
    expect(tarde.estado).toBe('vencido')
    expect(temprano.diasParaProximo).toBe(0)
  })

  it('un día antes del boundary todavía es "proximo", no "vencido"', () => {
    const r = calcularEstadoReajuste({ reajusteAplica: true, periodicidadMeses: 12, fechaUltimo: '2025-08-02' }, new Date('2026-08-01T12:00:00'))
    expect(r.estado).toBe('proximo')
    expect(r.diasParaProximo).toBe(1)
  })
})

describe('estimarRentaReajustadaIPC', () => {
  // `obtenerIpcMensualDelAnio` cachea la respuesta por año a nivel de
  // módulo (a propósito, para no repetir el fetch entre propiedades del
  // mismo portafolio) — por eso cada test de acá usa un año DISTINTO que
  // ningún otro test toca, para no leer la respuesta cacheada de otro caso.
  const fetchMock = vi.fn()

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('devuelve 0% cuando no ha pasado ni un mes completo desde el último reajuste', async () => {
    vi.stubGlobal('fetch', fetchMock)
    const r = await estimarRentaReajustadaIPC(100, '2026-07-20', new Date('2026-08-02T00:00:00'))
    expect(r).toEqual({ variacionAcumuladaPct: 0, rentaEstimadaUf: 100 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('compone la variación mensual real cuando todos los meses de la ventana están disponibles', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        serie: [
          { fecha: '2031-01-01T03:00:00.000Z', valor: 1 },
          { fecha: '2031-02-01T03:00:00.000Z', valor: 2 },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // último reajuste 2030-12-15 → ventana: 2031-01 y 2031-02 (hoy=2031-03-10, mes en curso excluido)
    const r = await estimarRentaReajustadaIPC(100, '2030-12-15', new Date('2031-03-10T00:00:00'))
    expect(r).not.toBeNull()
    expect(r!.variacionAcumuladaPct).toBeCloseTo(3.02, 2) // (1.01 * 1.02 - 1) * 100
    expect(r!.rentaEstimadaUf).toBeCloseTo(103.02, 2)
  })

  it('devuelve null (nunca un parcial) si falta el IPC de algún mes de la ventana', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ serie: [{ fecha: '2032-01-01T03:00:00.000Z', valor: 1 }] }), // falta febrero
    })
    vi.stubGlobal('fetch', fetchMock)

    const r = await estimarRentaReajustadaIPC(100, '2031-12-15', new Date('2032-03-10T00:00:00'))
    expect(r).toBeNull()
  })

  it('devuelve null si el fetch falla', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchMock)

    const r = await estimarRentaReajustadaIPC(100, '2032-12-15', new Date('2033-03-10T00:00:00'))
    expect(r).toBeNull()
  })
})
