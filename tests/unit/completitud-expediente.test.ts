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

// Cada bloque abajo prueba la checklist REAL de un formulario Minvu concreto
// (descargado de minvu.gob.cl/elementos-tecnicos/formularios/, 31 jul 2026),
// no la lista curada aproximada. Ver comentarios en completitud-expediente.ts.

describe('Formulario 1-1.1 (S.OM-Am 5.1.4 1A) — obra_menor_con_permiso', () => {
  it('detecta los ítems reales por nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Listado de documentos y planos.pdf' },
      { tipo: 'Otro', nombre: 'Patentes profesionales.pdf' },
      { tipo: 'Otro', nombre: 'Declaración simple del arquitecto.pdf' },
      { tipo: 'Otro', nombre: 'Croquis de emplazamiento.pdf' },
      { tipo: 'Especificaciones técnicas', nombre: '05_eett.pdf' },
    ]
    const r = evaluarCompletitud('obra_menor_con_permiso', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('listado_documentos_planos')).toBe(true)
    expect(porClave.get('patentes_profesionales')).toBe(true)
    expect(porClave.get('declaracion_simple_arquitecto')).toBe(true)
    expect(porClave.get('croquis_ubicacion')).toBe(true)
    expect(porClave.get('especificaciones_tecnicas_resumidas')).toBe(true)
    // "Cuando corresponda" no se sube en este expediente → ausente pero no bloquea
    expect(porClave.get('certificado_imiv_seim')).toBe(false)
    const imiv = r.items.find((i) => i.requisito.clave === 'certificado_imiv_seim')
    expect(imiv?.requisito.obligatorio).toBe(false)
  })
})

describe('Formulario 2-3.1/2-3.2 (Art. 5.1.6 OGUC) — permiso_edificacion y ampliacion', () => {
  it('comparten la misma checklist (secciones idénticas en ambos PDF)', () => {
    expect(DOCS_REQUERIDOS_POR_TIPO.permiso_edificacion).toBe(DOCS_REQUERIDOS_POR_TIPO.ampliacion)
  })

  it('detecta los ítems reales por tipo y nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Plano de arquitectura', nombre: 'planta_01.pdf' },
      { tipo: 'Otro', nombre: 'Cuadro de superficies.pdf' },
      { tipo: 'Otro', nombre: 'Certificado ingreso INE estadísticas edificación.pdf' },
      { tipo: 'Otro', nombre: 'Levantamiento topográfico.pdf' },
    ]
    const r = evaluarCompletitud('permiso_edificacion', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('planos_arquitectura_completos')).toBe(true)
    expect(porClave.get('cuadro_superficies')).toBe(true)
    expect(porClave.get('certificado_ingreso_ine_estadisticas')).toBe(true)
    expect(porClave.get('levantamiento_topografico')).toBe(true)
    // No tiene EETT: el Formulario 2-3.x no la exige (a diferencia del 1-1.1 de obra menor)
    expect(r.items.some((i) => i.requisito.clave === 'especificaciones_tecnicas_resumidas')).toBe(false)
  })
})

describe('Formulario 2-1.1 (S.A.A.ON, Art. 5.1.5 OGUC) — anteproyecto', () => {
  it('detecta los ítems reales por nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Patente del arquitecto.pdf' },
      { tipo: 'Otro', nombre: 'Cuadro general de superficies.pdf' },
    ]
    const r = evaluarCompletitud('anteproyecto', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('patente_arquitecto')).toBe(true)
    expect(porClave.get('cuadro_superficies_general')).toBe(true)
  })
})

describe('Formulario 2-7.1 (S.R.D.ON) — recepcion_final', () => {
  it('detecta los ítems reales por nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Informe del arquitecto ejecución conforme.pdf' },
      { tipo: 'Otro', nombre: 'Declaración jurada constructor.pdf' },
      { tipo: 'Otro', nombre: 'Libro de obras.pdf' },
      { tipo: 'Otro', nombre: 'Certificado dotación de agua potable y alcantarillado.pdf' },
    ]
    const r = evaluarCompletitud('recepcion_final', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('informe_arquitecto_ejecucion')).toBe(true)
    expect(porClave.get('declaracion_jurada_constructor')).toBe(true)
    expect(porClave.get('libro_de_obras')).toBe(true)
    expect(porClave.get('certificado_dotacion_agua_alcantarillado')).toBe(true)
  })
})

describe('Formulario 1.1.2.1.1 (Art. 1.6.3/5.1.4 N°1A OGUC) — obra_menor_sin_permiso', () => {
  it('detecta los ítems reales por nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Listado de documentos y planos.pdf' },
      { tipo: 'Otro', nombre: 'Certificado ingreso SEIM IMIV.pdf' },
    ]
    const r = evaluarCompletitud('obra_menor_sin_permiso', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('listado_documentos_planos')).toBe(true)
    // A diferencia del 1-1.1 (con permiso), aquí el IMIV es obligatorio (o el
    // certificado de que no se requiere) — no "cuando corresponda".
    const imiv = r.items.find((i) => i.requisito.clave === 'certificado_imiv_o_no_requiere')
    expect(imiv?.requisito.obligatorio).toBe(true)
  })
})

describe('Formulario 3.1.1.1 (Art. 3.1.5 OGUC) — loteo', () => {
  it('detecta los ítems reales por nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Memoria explicativa del loteo.pdf' },
      { tipo: 'Otro', nombre: 'Planos de red de agua potable.pdf' },
    ]
    const r = evaluarCompletitud('loteo', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('memoria_explicativa_loteo')).toBe(true)
    expect(porClave.get('planos_red_agua_potable')).toBe(true)
  })
})

describe('Formulario 4.1.1 (Art. 3.1.2 OGUC) — subdivision', () => {
  it('detecta los ítems reales por nombre de archivo', () => {
    const docs: DocEntrada[] = [
      { tipo: 'Otro', nombre: 'Plano de subdivisión.pdf' },
      { tipo: 'Otro', nombre: 'Plano de ubicación del terreno.pdf' },
    ]
    const r = evaluarCompletitud('subdivision', docs)
    const porClave = new Map(r.items.map((i) => [i.requisito.clave, i.presente]))
    expect(porClave.get('plano_subdivision')).toBe(true)
    expect(porClave.get('plano_ubicacion_terreno')).toBe(true)
  })

  it('es más corta que la de loteo (subdivisión no lleva obras de urbanización)', () => {
    expect(DOCS_REQUERIDOS_POR_TIPO.subdivision.length).toBeLessThan(DOCS_REQUERIDOS_POR_TIPO.loteo.length)
  })
})

describe('recepcion_parcial reutiliza el Formulario 2-7.1 (misma casilla de tipo de solicitud)', () => {
  it('apunta al mismo array que recepcion_final', () => {
    expect(DOCS_REQUERIDOS_POR_TIPO.recepcion_parcial).toBe(DOCS_REQUERIDOS_POR_TIPO.recepcion_final)
  })
})

describe('cambio_destino — sin formulario Minvu propio', () => {
  it('no tiene entrada específica y degrada a la checklist genérica', () => {
    expect(DOCS_REQUERIDOS_POR_TIPO.cambio_destino).toBeUndefined()
    expect(checklistDe('cambio_destino')).toBe(CHECKLIST_GENERICA)
  })
})

describe('integridad de las checklists por tipo', () => {
  it('ningún tipo tiene claves duplicadas dentro de su propia checklist', () => {
    for (const [tipo, lista] of Object.entries(DOCS_REQUERIDOS_POR_TIPO)) {
      const claves = lista.map((r) => r.clave)
      expect(new Set(claves).size, `duplicado en ${tipo}`).toBe(claves.length)
    }
  })
})
