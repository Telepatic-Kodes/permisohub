import { describe, expect, it } from 'vitest'

import {
  actuacionesDe,
  buscarTramite,
  clasificarFamiliaFormulario,
  obrasEspecificasDe,
  obrasEspecificasDeGrupo,
  regimenesDeGrupo,
  tramitesDeGrupo,
  TRAMITES_MAPA,
} from '@/lib/mapa-formularios'
import type { RespuestasVia } from '@/lib/via-tramitacion'

const NO: RespuestasVia = {
  yaConstruido: false,
  cambiaDestino: false,
  alteraEstructura: false,
  aumentaSuperficie: false,
  excedePRC: false,
}

describe('clasificarFamiliaFormulario — espeja recomendarVia rama por rama', () => {
  it('sin cambios → Grupo 1, Modificación sin Alterar su Estructura (misma rama que "Obra menor")', () => {
    const r = clasificarFamiliaFormulario({ respuestas: NO })
    expect(r.determinado).toBe(true)
    if (!r.determinado) throw new Error('debería estar determinado')
    expect(r.tramite.grupo).toBe(1)
    expect(r.tramite.obraEspecificaId).toBe('modificacion_sin_alterar_estructura')
    expect(r.tramite.nombreSolicitante).toContain('Modificación sin Alterar su Estructura')
  })

  it('ya construido → Grupo 1, Regularización Edificación Antigua', () => {
    const r = clasificarFamiliaFormulario({ respuestas: { ...NO, yaConstruido: true } })
    expect(r.determinado).toBe(true)
    if (!r.determinado) throw new Error('debería estar determinado')
    expect(r.tramite.obraEspecificaId).toBe('regularizacion_edificacion_antigua')
    expect(r.notas.length).toBeGreaterThan(0)
  })

  it('cambio de destino puro → no determinado (no cubierto por el mapa de formularios)', () => {
    const r = clasificarFamiliaFormulario({ respuestas: { ...NO, cambiaDestino: true } })
    expect(r.determinado).toBe(false)
    if (r.determinado) throw new Error('no debería estar determinado')
    expect(r.razon).toMatch(/no tiene fila propia/)
  })

  it('altera estructura → Grupo 2, Alteración', () => {
    const r = clasificarFamiliaFormulario({ respuestas: { ...NO, alteraEstructura: true } })
    expect(r.determinado).toBe(true)
    if (!r.determinado) throw new Error('debería estar determinado')
    expect(r.tramite.grupo).toBe(2)
    expect(r.tramite.obraEspecificaId).toBe('alteracion')
  })

  it('aumenta superficie sin dato de m² → no determinado', () => {
    const r = clasificarFamiliaFormulario({ respuestas: { ...NO, aumentaSuperficie: true } })
    expect(r.determinado).toBe(false)
    if (r.determinado) throw new Error('no debería estar determinado')
    expect(r.razon).toMatch(/falta el m²/)
  })

  it('aumenta superficie ≤100m² → Grupo 1, Ampliación Hasta 100m2', () => {
    const r = clasificarFamiliaFormulario({ respuestas: { ...NO, aumentaSuperficie: true }, superficieAmpliacionM2: 80 })
    expect(r.determinado).toBe(true)
    if (!r.determinado) throw new Error('debería estar determinado')
    expect(r.tramite.grupo).toBe(1)
    expect(r.tramite.obraEspecificaId).toBe('ampliacion_hasta_100m2')
  })

  it('aumenta superficie >100m² → Grupo 2, Ampliación mayor a 100m2', () => {
    const r = clasificarFamiliaFormulario({ respuestas: { ...NO, aumentaSuperficie: true }, superficieAmpliacionM2: 150 })
    expect(r.determinado).toBe(true)
    if (!r.determinado) throw new Error('debería estar determinado')
    expect(r.tramite.grupo).toBe(2)
    expect(r.tramite.obraEspecificaId).toBe('ampliacion_mayor_100m2')
  })

  it('es determinista', () => {
    const input = { respuestas: { ...NO, alteraEstructura: true } }
    expect(clasificarFamiliaFormulario(input)).toEqual(clasificarFamiliaFormulario(input))
  })
})

describe('mapa de formularios — integridad de la tabla', () => {
  it('no hay filas duplicadas (grupo+regimen+actuacion+obraEspecificaId único)', () => {
    const claves = TRAMITES_MAPA.map((t) => `${t.grupo}|${t.regimen}|${t.actuacion}|${t.obraEspecificaId}`)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('cada grupo 1-5 tiene al menos una fila', () => {
    for (const g of [1, 2, 3, 4, 5] as const) {
      expect(tramitesDeGrupo(g).length).toBeGreaterThan(0)
    }
  })

  it('obrasEspecificasDeGrupo no repite ids', () => {
    const obras = obrasEspecificasDeGrupo(2)
    expect(new Set(obras.map((o) => o.id)).size).toBe(obras.length)
    expect(obras.map((o) => o.id)).toContain('obra_nueva')
  })

  it('buscarTramite devuelve undefined para una combinación inexistente', () => {
    expect(buscarTramite(4, 'declaracion_jurada', 'permiso', 'subdivision')).toBeUndefined()
  })
})

describe('consultas en cascada — explorador manual (Grupo → Régimen → Actuación → Obra específica)', () => {
  it('Grupo 1 tiene los dos regímenes (permiso y declaración jurada)', () => {
    expect(regimenesDeGrupo(1).sort()).toEqual(['declaracion_jurada', 'permiso_autorizacion'])
  })

  it('Grupo 2 (edificación) solo tiene régimen de permiso, sin DJ como vía alternativa', () => {
    expect(regimenesDeGrupo(2)).toEqual(['permiso_autorizacion'])
  })

  it('Grupo 1 régimen declaración jurada solo tiene 2 obras específicas (no las 5)', () => {
    const obras = obrasEspecificasDe(1, 'declaracion_jurada', 'inicio_obra')
    expect(obras.map((o) => o.id).sort()).toEqual(['ampliacion_hasta_100m2', 'ampliacion_vivienda_social_y_otras'])
  })

  it('Grupo 4 (subdivisión/fusión) no tiene actuación "anteproyecto"', () => {
    expect(actuacionesDe(4, 'permiso_autorizacion')).toEqual(['permiso'])
  })

  it('toda combinación devuelta por la cascada resuelve con buscarTramite (sin callejones sin salida)', () => {
    for (const g of [1, 2, 3, 4, 5] as const) {
      for (const r of regimenesDeGrupo(g)) {
        for (const a of actuacionesDe(g, r)) {
          const obras = obrasEspecificasDe(g, r, a)
          expect(obras.length).toBeGreaterThan(0)
          for (const o of obras) {
            expect(buscarTramite(g, r, a, o.id)).toBeDefined()
          }
        }
      }
    }
  })
})
