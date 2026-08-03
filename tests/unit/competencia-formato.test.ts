import { describe, expect, it } from 'vitest'
import { calcularResultadoCompetencia } from '@/lib/competencia-formato'
import type { CompetidorDetectado } from '@/lib/cabida-comercial'

// Firma esperada (la función aún no existe en este punto — RED):
//
// function calcularResultadoCompetencia(
//   competidores: CompetidorDetectado[],
//   formato: FormatoComercial
// ): ResultadoCompetenciaFormato

const competidorConfianzaAlta: CompetidorDetectado = {
  nombre: 'Jumbo Ñuñoa',
  formato: 'supermercado',
  fuente: 'sii_geocodificado',
  lat: -33.45,
  lng: -70.6,
  distanciaM: 850,
  confianza: 'alta',
}

const competidorMedia: CompetidorDetectado = {
  nombre: 'OK Market',
  formato: 'minimarket',
  fuente: 'osm',
  lat: -33.45,
  lng: -70.6,
  distanciaM: 300,
  confianza: 'media',
}

const competidorBaja: CompetidorDetectado = {
  nombre: 'Almacén sin nombre claro',
  formato: 'minimarket',
  fuente: 'seed_list',
  lat: -33.45,
  lng: -70.6,
  distanciaM: 120,
  confianza: 'baja',
}

const competidorMediaPower: CompetidorDetectado = {
  nombre: 'Mall Plaza Egaña',
  formato: 'power_center',
  fuente: 'seed_list',
  lat: -33.45,
  lng: -70.6,
  distanciaM: 1200,
  confianza: 'media',
}

describe('calcularResultadoCompetencia', () => {
  it('[] + supermercado → coberturaConocida false, confianzaGlobal baja, disclosure cita el id SII y Unimarc', () => {
    const resultado = calcularResultadoCompetencia([], 'supermercado')
    expect(resultado.coberturaConocida).toBe(false)
    expect(resultado.confianzaGlobal).toBe('baja')
    expect(resultado.disclosure).toContain('sii-nomina-sucursales-holdings-sin-tiendas')
    expect(resultado.disclosure).toContain('Unimarc')
  })

  it('[] + strip_center → disclosure cita el id del seed list y Grupo Patio o Más Center', () => {
    const resultado = calcularResultadoCompetencia([], 'strip_center')
    expect(resultado.disclosure).toContain('strip-power-centers-chile-seed')
    expect(
      resultado.disclosure.includes('Grupo Patio') || resultado.disclosure.includes('Más Center')
    ).toBe(true)
  })

  it('[competidorConfianzaAlta] + supermercado → confianzaGlobal capada a media, NUNCA alta', () => {
    const resultado = calcularResultadoCompetencia([competidorConfianzaAlta], 'supermercado')
    expect(resultado.confianzaGlobal).toBe('media')
  })

  it('[competidorMedia, competidorBaja] + minimarket → confianzaGlobal es el mínimo (baja), no promedio ni el primero', () => {
    const resultado = calcularResultadoCompetencia([competidorMedia, competidorBaja], 'minimarket')
    expect(resultado.confianzaGlobal).toBe('baja')
  })

  it('[competidorMediaPower] + power_center → confianzaGlobal media, disclosure con id/formato correctos de strip/power', () => {
    const resultado = calcularResultadoCompetencia([competidorMediaPower], 'power_center')
    expect(resultado.confianzaGlobal).toBe('media')
    expect(resultado.disclosure).toContain('strip-power-centers-chile-seed')
  })

  it('coberturaConocida es SIEMPRE false, para cualquier combinación de formato/competidores usada arriba', () => {
    expect(calcularResultadoCompetencia([], 'supermercado').coberturaConocida).toBe(false)
    expect(calcularResultadoCompetencia([], 'minimarket').coberturaConocida).toBe(false)
    expect(calcularResultadoCompetencia([], 'strip_center').coberturaConocida).toBe(false)
    expect(calcularResultadoCompetencia([], 'power_center').coberturaConocida).toBe(false)
    expect(calcularResultadoCompetencia([competidorConfianzaAlta], 'supermercado').coberturaConocida).toBe(
      false
    )
    expect(
      calcularResultadoCompetencia([competidorMedia, competidorBaja], 'minimarket').coberturaConocida
    ).toBe(false)
    expect(calcularResultadoCompetencia([competidorMediaPower], 'power_center').coberturaConocida).toBe(
      false
    )
  })

  it('disclosure distingue explícitamente el caso 0 competidores del caso con competidores (texto no genérico)', () => {
    const sinCompetidores = calcularResultadoCompetencia([], 'supermercado')
    const conCompetidores = calcularResultadoCompetencia([competidorConfianzaAlta], 'supermercado')
    expect(sinCompetidores.disclosure).not.toBe(conCompetidores.disclosure)
  })

  it('consultadoEl es un string ISO parseable', () => {
    const resultado = calcularResultadoCompetencia([], 'supermercado')
    expect(new Date(resultado.consultadoEl).toString()).not.toBe('Invalid Date')
  })

  it('competidores en el resultado es el mismo array de entrada, sin filtrar/reordenar', () => {
    const entrada = [competidorMedia, competidorBaja]
    const resultado = calcularResultadoCompetencia(entrada, 'minimarket')
    expect(resultado.competidores).toBe(entrada)
  })
})
