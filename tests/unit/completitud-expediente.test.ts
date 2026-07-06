import { describe, expect, it } from 'vitest'

import {
  checklistDe,
  evaluarCompletitud,
  CHECKLIST_GENERICA,
  DOCS_REQUERIDOS_POR_TIPO,
  type DocEntrada,
} from '@/lib/completitud-expediente'

describe('checklistDe', () => {
  it('devuelve la checklist específica del tipo', () => {
    expect(checklistDe('permiso_edificacion')).toBe(DOCS_REQUERIDOS_POR_TIPO.permiso_edificacion)
  })

  it('degrada a la genérica para tipo ausente o desconocido', () => {
    expect(checklistDe(undefined)).toBe(CHECKLIST_GENERICA)
    expect(checklistDe('tipo_que_no_existe')).toBe(CHECKLIST_GENERICA)
  })
})

describe('evaluarCompletitud', () => {
  it('expediente vacío → todos los obligatorios faltantes', () => {
    const r = evaluarCompletitud('permiso_edificacion', [])
    expect(r.resumen.presentes).toBe(0)
    expect(r.resumen.total).toBeGreaterThan(0)
    expect(r.resumen.faltantes).toBe(r.resumen.total)
    expect(r.items.every((i) => !i.presente)).toBe(true)
  })

  it('detecta documentos por tipo clasificado', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Memoria', nombre: '02_memoria.pdf' },
      { tipo: 'Especificaciones técnicas', nombre: '05_eett.pdf' },
      { tipo: 'Plano de arquitectura', nombre: 'lamina_01.pdf' },
    ]
    const r = evaluarCompletitud('permiso_edificacion', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('memoria')).toBe(true)
    expect(porClave.get('especificaciones_tecnicas')).toBe(true)
    expect(porClave.get('planos_arquitectura')).toBe(true)
    // No subimos formulario ni CIP → faltan
    expect(porClave.get('formulario_solicitud')).toBe(false)
    expect(porClave.get('certificado_informaciones_previas')).toBe(false)
  })

  it('detecta por nombre de archivo cuando el tipo es "Otro"', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Certificado de Informaciones Previas.pdf' },
      { tipo: 'Otro', nombre: 'Formulario de solicitud.pdf' },
    ]
    const r = evaluarCompletitud('permiso_edificacion', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('certificado_informaciones_previas')).toBe(true)
    expect(porClave.get('formulario_solicitud')).toBe(true)
  })

  it('el resumen cuenta SOLO obligatorios (los opcionales no bloquean el gate)', () => {
    // permiso_edificacion incluye R_PLANO_ESTRUCTURAL (opcional).
    const r = evaluarCompletitud('permiso_edificacion', [])
    const obligatorios = r.items.filter((i) => i.requisito.obligatorio).length
    const opcionales = r.items.filter((i) => !i.requisito.obligatorio).length
    expect(r.resumen.total).toBe(obligatorios)
    expect(opcionales).toBeGreaterThan(0) // hay al menos un opcional que no cuenta
    expect(r.items.length).toBe(obligatorios + opcionales)
  })

  it('es determinista', () => {
    const docs: DocEntrada[] = [{ tipo: 'Memoria', nombre: 'memoria.pdf' }]
    expect(evaluarCompletitud('ampliacion', docs)).toEqual(evaluarCompletitud('ampliacion', docs))
  })
})
