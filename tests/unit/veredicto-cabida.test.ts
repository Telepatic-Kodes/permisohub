import { describe, expect, it } from 'vitest'
import { calcularVeredictoCabida } from '@/lib/veredicto-cabida'
import type { AnalisisParaVeredicto, DemografiaYConsumo, PercentilesGapScore } from '@/lib/veredicto-cabida'
import type { CompetidorDetectado, ResultadoCompetenciaFormato, IsocronaResultado } from '@/lib/cabida-comercial'

const ISOCRONA_RED_VIAL: IsocronaResultado = {
  metodo: 'red_vial',
  geometria: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] },
  modo: 'caminando',
  minutos: 10,
  proveedor: 'openrouteservice',
  consultadoEl: '2026-08-01T12:00:00.000Z',
  cacheHit: false,
}

const ISOCRONA_DEGRADADA: IsocronaResultado = { ...ISOCRONA_RED_VIAL, metodo: 'circulo_equivalente', proveedor: null }

function demografiaFixture(totalPersonas: number, overrides?: Partial<DemografiaYConsumo['poblacion']>): DemografiaYConsumo {
  return {
    poblacion: {
      ok: true, totalPersonas, totalViviendas: Math.round(totalPersonas / 3),
      manzanasIntersectadas: 12, comunasTocadas: ['Providencia'], censoAno: 2017,
      fuente: 'INE Censo 2017 — manzana censal', consultadoEl: '2026-08-01T12:00:00.000Z', paginado: false,
      ...overrides,
    },
    consumo: {
      categorias: [{ nombre: 'Alimentos', participacionPct: 30 }], categoriasPendientes: [],
      tasaPobrezaComunal: 8.5, disclosure: 'estimado agregado a nivel macro-zona', epfAno: 2022, casenAno: 2024,
    },
  }
}

function competenciaFixture(n: number, confianzaGlobal: ResultadoCompetenciaFormato['confianzaGlobal'] = 'media'): ResultadoCompetenciaFormato {
  const competidores: CompetidorDetectado[] = Array.from({ length: n }, (_, i) => ({
    nombre: `Competidor ${i}`, formato: 'supermercado', fuente: 'osm', lat: -33.4 + i * 0.001, lng: -70.6,
    distanciaM: 500 + i * 10, confianza: 'media',
  }))
  return { formato: 'supermercado', competidores, coberturaConocida: false, confianzaGlobal, disclosure: 'disclosure de prueba', consultadoEl: '2026-08-01T12:00:00.000Z' }
}

function analisisFixture(overrides?: Partial<AnalisisParaVeredicto>): AnalisisParaVeredicto {
  return {
    formato: 'supermercado', isocrona: ISOCRONA_RED_VIAL,
    demografia: demografiaFixture(40000), competencia: competenciaFixture(15),
    generadoEl: '2026-08-01T12:00:00.000Z', ...overrides,
  }
}

// Terciles fixture reusable — NUNCA representa un umbral inventado por este
// test: en producción (Plan 19-03, gateado) estos valores vienen de
// percentile_cont() sobre gap scores reales de otros análisis ya
// cacheados. Elegidos acá para que 15/40.000*1000=0.375 caiga bajo p33,
// 60/40.000*1000=1.5 caiga sobre p66, y 30/40.000*1000=0.75 caiga en la
// banda intermedia.
const PERCENTILES_FIXTURE: PercentilesGapScore = { p33: 0.5, p66: 1.0, muestraN: 50 }

const FORMATO_FIXTURE = 'supermercado'

describe('calcularVeredictoCabida', () => {
  it('caso 1: demografia undefined → evidencia_insuficiente, confianza baja, gapScore null, datos_base_faltantes', () => {
    const resultado = calcularVeredictoCabida(analisisFixture({ demografia: undefined }), FORMATO_FIXTURE, PERCENTILES_FIXTURE)
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.confianza).toBe('baja')
    expect(resultado.gapScore).toBeNull()
    expect(resultado.razonInsuficiencia).toBe('datos_base_faltantes')
  })

  it('caso 2: competencia undefined → mismo resultado que caso 1', () => {
    const resultado = calcularVeredictoCabida(analisisFixture({ competencia: undefined }), FORMATO_FIXTURE, PERCENTILES_FIXTURE)
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.confianza).toBe('baja')
    expect(resultado.gapScore).toBeNull()
    expect(resultado.razonInsuficiencia).toBe('datos_base_faltantes')
  })

  it('caso 3: poblacion.ok false → evidencia_insuficiente, gapScore null, poblacion_no_utilizable', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({ demografia: demografiaFixture(40000, { ok: false }) }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.gapScore).toBeNull()
    expect(resultado.razonInsuficiencia).toBe('poblacion_no_utilizable')
  })

  it('caso 4: manzanasIntersectadas 0 → evidencia_insuficiente, gapScore null, poblacion_no_utilizable', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({ demografia: demografiaFixture(40000, { manzanasIntersectadas: 0 }) }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.gapScore).toBeNull()
    expect(resultado.razonInsuficiencia).toBe('poblacion_no_utilizable')
  })

  it('caso 5: isocrona degradada con datos completos → evidencia_insuficiente, confianza baja, confianza_degradada, gapScore NO null', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({ isocrona: ISOCRONA_DEGRADADA }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.confianza).toBe('baja')
    expect(resultado.razonInsuficiencia).toBe('confianza_degradada')
    expect(resultado.gapScore).not.toBeNull()
  })

  it('caso 6 (cold-start): percentiles null con datos completos → evidencia_insuficiente SIEMPRE, muestra_comparativa_insuficiente, gapScore NO null', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({ competencia: competenciaFixture(15), demografia: demografiaFixture(40000) }),
      FORMATO_FIXTURE,
      null
    )
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.razonInsuficiencia).toBe('muestra_comparativa_insuficiente')
    expect(resultado.gapScore).not.toBeNull()
    expect(resultado.gapScore).toBeCloseTo(0.375)
  })

  it('caso 7: muestraN bajo el mínimo → mismo resultado que cold-start aunque terciles sean válidos', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({ competencia: competenciaFixture(15), demografia: demografiaFixture(40000) }),
      FORMATO_FIXTURE,
      { p33: 0.5, p66: 1.0, muestraN: 5 }
    )
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.razonInsuficiencia).toBe('muestra_comparativa_insuficiente')
  })

  it('caso 8: banda inferior → evidencia_de_espacio, confianza media, gapScore cercano a 0.375, razonInsuficiencia undefined', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({
        competencia: competenciaFixture(15, 'media'),
        demografia: demografiaFixture(40000),
        isocrona: ISOCRONA_RED_VIAL,
      }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.estado).toBe('evidencia_de_espacio')
    expect(resultado.confianza).toBe('media')
    expect(resultado.gapScore).toBeCloseTo(0.375)
    expect(resultado.razonInsuficiencia).toBeUndefined()
  })

  it('caso 9: banda superior → mercado_parece_cubierto, confianza media, razonInsuficiencia undefined', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({
        competencia: competenciaFixture(60, 'media'),
        demografia: demografiaFixture(40000),
        isocrona: ISOCRONA_RED_VIAL,
      }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.estado).toBe('mercado_parece_cubierto')
    expect(resultado.confianza).toBe('media')
    expect(resultado.razonInsuficiencia).toBeUndefined()
  })

  it('caso 10: banda intermedia → evidencia_insuficiente por banda_intermedia_no_concluyente, PERO confianza media (no forzada a baja)', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({
        competencia: competenciaFixture(30, 'media'),
        demografia: demografiaFixture(40000),
        isocrona: ISOCRONA_RED_VIAL,
      }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.estado).toBe('evidencia_insuficiente')
    expect(resultado.razonInsuficiencia).toBe('banda_intermedia_no_concluyente')
    expect(resultado.confianza).toBe('media')
  })

  it('caso 11: tope duro de confianza — confianzaGlobal alta nunca produce confianza alta en el veredicto', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({
        competencia: competenciaFixture(15, 'alta'),
        demografia: demografiaFixture(40000),
        isocrona: ISOCRONA_RED_VIAL,
      }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.confianza).not.toBe('alta')
    expect(resultado.confianza).toBe('media')
  })

  it('caso 12: gapScore es la razón exacta competidores/poblacion*1000, no el conteo crudo', () => {
    const resultado = calcularVeredictoCabida(
      analisisFixture({
        competencia: competenciaFixture(20, 'media'),
        demografia: demografiaFixture(10000),
        isocrona: ISOCRONA_RED_VIAL,
      }),
      FORMATO_FIXTURE,
      PERCENTILES_FIXTURE
    )
    expect(resultado.gapScore).toBeCloseTo(2.0)
  })

  it('caso 13: generadoEl es un string ISO parseable en todos los casos, incluidos insuficiente y cold-start', () => {
    const casos = [
      calcularVeredictoCabida(analisisFixture({ demografia: undefined }), FORMATO_FIXTURE, PERCENTILES_FIXTURE),
      calcularVeredictoCabida(analisisFixture(), FORMATO_FIXTURE, null),
      calcularVeredictoCabida(analisisFixture(), FORMATO_FIXTURE, PERCENTILES_FIXTURE),
    ]
    for (const resultado of casos) {
      expect(new Date(resultado.generadoEl).toString()).not.toBe('Invalid Date')
    }
  })

  it('caso 14: explicacion es un string no vacío en todos los casos, incluido cold-start', () => {
    const casos = [
      calcularVeredictoCabida(analisisFixture({ demografia: undefined }), FORMATO_FIXTURE, PERCENTILES_FIXTURE),
      calcularVeredictoCabida(analisisFixture(), FORMATO_FIXTURE, null),
      calcularVeredictoCabida(analisisFixture(), FORMATO_FIXTURE, PERCENTILES_FIXTURE),
    ]
    for (const resultado of casos) {
      expect(typeof resultado.explicacion).toBe('string')
      expect(resultado.explicacion.length).toBeGreaterThan(0)
    }
  })
})
