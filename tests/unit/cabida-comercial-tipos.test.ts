import { describe, expect, it } from 'vitest'
import type {
  CompetidorDetectado,
  FormatoComercial as FormatoCabida,
  ResultadoCompetenciaFormato,
} from '@/lib/cabida-comercial'
import type { FormatoComercial as FormatoTerreno } from '@/lib/terrenos-comercial'

describe('FormatoComercial — colisión de nombres cabida-comercial vs terrenos-comercial', () => {
  it('cabida-comercial.FormatoComercial incluye los 4 formatos objetivo de Fase 18', () => {
    const valores: FormatoCabida[] = ['supermercado', 'minimarket', 'strip_center', 'power_center']
    expect(valores).toHaveLength(4)
  })

  it('terrenos-comercial.FormatoComercial NO es intercambiable con cabida-comercial.FormatoComercial (tipos deliberadamente distintos)', () => {
    const valorTerreno: FormatoTerreno = 'local'
    // @ts-expect-error 'local' no es un FormatoComercial válido en cabida-comercial — si este error deja de existir, alguien unificó los dos tipos por error
    const cruzado: FormatoCabida = valorTerreno
    expect(valorTerreno).toBe('local')
    void cruzado
  })

  it('CompetidorDetectado y ResultadoCompetenciaFormato tienen la forma esperada (compila = correcto)', () => {
    const competidor: CompetidorDetectado = {
      nombre: 'Santa Isabel',
      formato: 'supermercado',
      fuente: 'osm',
      lat: -33.45,
      lng: -70.66,
      distanciaM: 350,
      confianza: 'media',
    }
    const resultado: ResultadoCompetenciaFormato = {
      formato: 'supermercado',
      competidores: [competidor],
      coberturaConocida: false,
      confianzaGlobal: 'media',
      disclosure: 'test',
      consultadoEl: new Date().toISOString(),
    }
    expect(resultado.competidores).toHaveLength(1)
  })
})
