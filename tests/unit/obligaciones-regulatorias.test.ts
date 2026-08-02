import { describe, expect, it } from 'vitest'
import {
  OBLIGACIONES_REGULATORIAS,
  obligacionesAplicables,
  calcularEstadoObligacion,
} from '@/lib/obligaciones-regulatorias'

const ascensor = OBLIGACIONES_REGULATORIAS.find((o) => o.slug === 'certificacion-ascensores')!
const gas = OBLIGACIONES_REGULATORIAS.find((o) => o.slug === 'inspeccion-gas-sello-verde')!
const extintores = OBLIGACIONES_REGULATORIAS.find((o) => o.slug === 'mantencion-extintores')!

describe('obligacionesAplicables', () => {
  it('excluye ascensor y gas cuando la propiedad no los tiene', () => {
    const slugs = obligacionesAplicables(false, false).map((o) => o.slug)
    expect(slugs).not.toContain('certificacion-ascensores')
    expect(slugs).not.toContain('inspeccion-gas-sello-verde')
    expect(slugs).toContain('mantencion-extintores')
  })

  it('incluye ascensor y gas cuando la propiedad los tiene', () => {
    const slugs = obligacionesAplicables(true, true).map((o) => o.slug)
    expect(slugs).toContain('certificacion-ascensores')
    expect(slugs).toContain('inspeccion-gas-sello-verde')
  })
})

describe('calcularEstadoObligacion', () => {
  const hoy = new Date('2026-08-01T12:00:00')

  it('sin_registro cuando no hay fecha de último cumplimiento', () => {
    const r = calcularEstadoObligacion(extintores, null, hoy)
    expect(r.estado).toBe('sin_registro')
    expect(r.proximaFecha).toBeNull()
  })

  it('verificar (nunca una fecha fabricada) cuando la periodicidad es variable', () => {
    const r = calcularEstadoObligacion(ascensor, '2025-06-01', hoy)
    expect(r.estado).toBe('verificar')
    expect(r.proximaFecha).toBeNull()
  })

  it('al_dia cuando falta más de 30 días para la próxima fecha', () => {
    const r = calcularEstadoObligacion(extintores, '2026-01-01', hoy) // vence 2027-01-01
    expect(r.estado).toBe('al_dia')
    expect(r.proximaFecha).toBe('2027-01-01')
  })

  it('por_vencer dentro de la ventana de 30 días', () => {
    const r = calcularEstadoObligacion(gas, '2024-08-15', hoy) // vence 2026-08-15, 14 días
    expect(r.estado).toBe('por_vencer')
  })

  it('vencido cuando la próxima fecha ya pasó', () => {
    const r = calcularEstadoObligacion(gas, '2024-01-01', hoy) // vence 2026-01-01
    expect(r.estado).toBe('vencido')
  })

  it('el día exacto de vencimiento es "por_vencer" sin importar la hora del día', () => {
    // extintores: 12 meses. Último cumplimiento 2025-08-02 → vence 2026-08-02.
    const temprano = calcularEstadoObligacion(extintores, '2025-08-02', new Date('2026-08-02T09:00:00'))
    const tarde = calcularEstadoObligacion(extintores, '2025-08-02', new Date('2026-08-02T23:30:00'))
    expect(temprano.estado).toBe('por_vencer')
    expect(tarde.estado).toBe('por_vencer')
  })
})
