import { describe, expect, it } from 'vitest'
import { percentil } from '@/lib/cabida-comercial-server'
import { calcularVeredictoCabida } from '@/lib/veredicto-cabida'
import type { AnalisisParaVeredicto } from '@/lib/veredicto-cabida'

describe('percentil', () => {
  it('interpola linealmente entre los dos valores que rodean la posición', () => {
    // pos = (5-1)*0.5 = 2 → exacto sobre el índice 2
    expect(percentil([0, 1, 2, 3, 4], 0.5)).toBe(2)
    // pos = (4-1)*0.5 = 1.5 → mitad entre 10 y 20
    expect(percentil([0, 10, 20, 30], 0.5)).toBe(15)
  })

  it('devuelve el único valor cuando la muestra tiene un solo elemento', () => {
    expect(percentil([7], 0.33)).toBe(7)
    expect(percentil([7], 0.66)).toBe(7)
  })

  it('los extremos devuelven mínimo y máximo', () => {
    const v = [1, 2, 3, 4, 5]
    expect(percentil(v, 0)).toBe(1)
    expect(percentil(v, 1)).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Prueba de que la siembra del 04-08 DESBLOQUEÓ el veredicto: hasta entonces
// calcularVeredictoCabida() siempre devolvía 'evidencia_insuficiente' porque
// (a) la isócrona era un círculo y (b) no había percentiles. Los números de
// abajo son los REALMENTE observados en la primera corrida del batch sobre
// terrenos de producción, no inventados.
// ---------------------------------------------------------------------------

const PERCENTILES_REALES = { p33: 0, p66: 0.0673, muestraN: 17 }

function analisisReal(overrides: {
  competidores: number
  personas: number
  confianzaGlobal: 'alta' | 'media' | 'baja'
  metodoIsocrona?: 'red_vial' | 'circulo_equivalente'
}): AnalisisParaVeredicto {
  return {
    formato: 'supermercado',
    generadoEl: '2026-08-05T03:00:00.000Z',
    isocrona: {
      metodo: overrides.metodoIsocrona ?? 'red_vial',
      geometria: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] },
      modo: 'caminando',
      minutos: 15,
      proveedor: overrides.metodoIsocrona === 'circulo_equivalente' ? null : 'valhalla',
      consultadoEl: '2026-08-05T03:00:00.000Z',
      cacheHit: false,
    },
    competencia: {
      formato: 'supermercado',
      competidores: Array.from({ length: overrides.competidores }, (_, i) => ({
        nombre: `competidor-${i}`,
        formato: 'supermercado' as const,
        fuente: 'osm' as const,
        lat: -33.45,
        lng: -70.59,
        distanciaM: 100 + i,
        confianza: 'media' as const,
      })),
      coberturaConocida: false,
      confianzaGlobal: overrides.confianzaGlobal,
      disclosure: 'cobertura parcial',
      consultadoEl: '2026-08-05T03:00:00.000Z',
    },
    demografia: {
      poblacion: {
        ok: true,
        totalPersonas: overrides.personas,
        totalViviendas: Math.round(overrides.personas * 0.46),
        manzanasIntersectadas: 156,
        comunasTocadas: ['ÑUÑOA'],
        censoAno: 2017,
        fuente: 'INE Censo 2017 — manzana censal',
        consultadoEl: '2026-08-05T03:00:00.000Z',
        paginado: false,
      },
      consumo: {
        comuna: 'Ñuñoa',
        categorias: [],
        categoriasPendientes: [],
        tasaPobrezaComunal: 5.7,
        nivelGeografico: 'macro_zona_gran_santiago',
        disclosure: 'macro-zona',
        epfAno: 2022,
        casenAno: 2024,
        fuente: 'IX EPF + CASEN',
      },
    },
  }
}

describe('veredicto con la muestra real sembrada el 04-08', () => {
  it('el terreno de Ñuñoa ya emite un veredicto concluyente (antes era imposible)', () => {
    // Datos reales: 8 competidores sobre 60.094 personas → gapScore 0,133,
    // por encima del p66 observado (0,0673) → el mercado ya está cubierto.
    const v = calcularVeredictoCabida(analisisReal({ competidores: 8, personas: 60094, confianzaGlobal: 'media' }), 'supermercado', PERCENTILES_REALES)

    expect(v.estado).toBe('mercado_parece_cubierto')
    expect(v.gapScore).toBeCloseTo(0.1331, 3)
    expect(v.razonInsuficiencia).toBeUndefined()
  })

  it('sigue negándose a concluir cuando la isócrona cayó a círculo', () => {
    const v = calcularVeredictoCabida(
      analisisReal({ competidores: 8, personas: 60094, confianzaGlobal: 'media', metodoIsocrona: 'circulo_equivalente' }),
      'supermercado',
      PERCENTILES_REALES
    )

    expect(v.estado).toBe('evidencia_insuficiente')
    expect(v.razonInsuficiencia).toBe('confianza_degradada')
  })

  it('las 9 ubicaciones con 0 competidores siguen sin concluir — confianza baja, no "hay espacio"', () => {
    // El hallazgo incómodo de la primera corrida: 9 de 17 filas dieron cero
    // competidores Y confianzaGlobal 'baja'. Cero competidores detectados NO
    // es evidencia de espacio cuando la fuente se sabe incompleta — el
    // veredicto lo trata como falta de evidencia, que es lo correcto.
    const v = calcularVeredictoCabida(analisisReal({ competidores: 0, personas: 40000, confianzaGlobal: 'baja' }), 'supermercado', PERCENTILES_REALES)

    expect(v.estado).toBe('evidencia_insuficiente')
    expect(v.razonInsuficiencia).toBe('confianza_degradada')
    expect(v.estado).not.toBe('evidencia_de_espacio')
  })

  it('sin percentiles (cold-start previo a la siembra) nunca concluye', () => {
    const v = calcularVeredictoCabida(analisisReal({ competidores: 8, personas: 60094, confianzaGlobal: 'media' }), 'supermercado', null)

    expect(v.estado).toBe('evidencia_insuficiente')
    expect(v.razonInsuficiencia).toBe('muestra_comparativa_insuficiente')
  })
})
