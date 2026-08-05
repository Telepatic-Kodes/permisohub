import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { parseAiJson, textoLaxo, arrayLaxo } from '@/lib/ai-parse'

const Schema = z
  .object({
    nombre: z.string().default(''),
    items: z.array(z.string()).default([]),
  })
  .passthrough()

describe('parseAiJson', () => {
  it('extrae y valida un JSON bien formado', () => {
    const text = 'Aquí tienes:\n{"nombre":"foo","items":["a","b"]}\nfin'
    const result = parseAiJson(text, Schema, 'test-route')
    expect(result).toEqual({ nombre: 'foo', items: ['a', 'b'] })
  })

  it('aplica defaults de campos faltantes (schema laxo)', () => {
    const text = '{"nombre":"foo"}'
    const result = parseAiJson(text, Schema, 'test-route')
    expect(result).toEqual({ nombre: 'foo', items: [] })
  })

  it('conserva propiedades adicionales (passthrough)', () => {
    const text = '{"nombre":"foo","extra":"dato inesperado"}'
    const result = parseAiJson(text, Schema, 'test-route')
    expect(result).toMatchObject({ nombre: 'foo', extra: 'dato inesperado' })
  })

  it('devuelve null y loguea cuando no hay bloque JSON', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = parseAiJson('no hay json aquí', Schema, 'test-route')
    expect(result).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('devuelve null y loguea cuando el JSON está mal formado', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = parseAiJson('{"nombre": "foo",}', Schema, 'test-route')
    expect(result).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('devuelve null y loguea cuando el JSON no cumple el schema (tipo incorrecto)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = parseAiJson('{"items": "no es un array"}', Schema, 'test-route')
    expect(result).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

// Regresión 05-08: `.default('')` de zod SOLO cubre undefined, no null. Al
// conectar la LGUC al copiloto el modelo empezó a mandar `"formula": null`
// —con razón: los artículos de LGUC son procedimentales y no tienen fórmula—
// y eso tumbaba el parseo entero: articulos quedaba vacío y el JSON crudo se
// volcaba dentro de `resumen`. Verificado en vivo contra la ruta real.
describe('campos de texto laxos ante null', () => {
  const textoLaxo = z.string().nullable().optional().transform((v) => v ?? '')
  const Articulo = z.object({ numero: textoLaxo, formula: textoLaxo }).passthrough()

  it('acepta null y lo normaliza a string vacío', () => {
    const r = Articulo.safeParse({ numero: 'Art. 116 LGUC', formula: null })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.formula).toBe('')
  })

  it('acepta el campo ausente', () => {
    const r = Articulo.safeParse({ numero: 'Art. 116 LGUC' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.formula).toBe('')
  })

  it('el schema estricto anterior fallaba con null — por eso existe este test', () => {
    const estricto = z.object({ formula: z.string().default('') })
    expect(estricto.safeParse({ formula: null }).success).toBe(false)
  })
})

// Auditoría 05-08: tras el bug de `formula` en copiloto se revisaron las 7
// rutas que parsean salida de LLM. 5 tenían el mismo agujero latente y solo
// extract-observations lo tenía bien — no por casualidad: es la única cuyo
// prompt dice "or null" explícitamente. Estos tests fijan los helpers
// compartidos que reemplazaron a esa decisión por-archivo.
describe('helpers laxos compartidos (lib/ai-parse)', () => {
  it('textoLaxo normaliza null y ausente a cadena vacía', () => {
    const S = z.object({ a: textoLaxo, b: textoLaxo })
    const r = S.safeParse({ a: null })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ a: '', b: '' })
  })

  it('textoLaxo preserva el valor cuando SÍ viene', () => {
    const r = z.object({ a: textoLaxo }).safeParse({ a: 'Art. 116 LGUC' })
    expect(r.success && r.data.a).toBe('Art. 116 LGUC')
  })

  it('arrayLaxo normaliza null y ausente a []', () => {
    const S = z.object({ xs: arrayLaxo(z.string()) })
    expect(S.safeParse({ xs: null }).success).toBe(true)
    expect(S.parse({ xs: null }).xs).toEqual([])
    expect(S.parse({}).xs).toEqual([])
    expect(S.parse({ xs: ['a'] }).xs).toEqual(['a'])
  })

  it('un objeto entero sobrevive aunque el modelo mande null en varios campos', () => {
    // Forma real que devolvió el modelo y tumbaba el parseo: artículo LGUC
    // procedimental, sin fórmula ni valores numéricos.
    const Articulo = z
      .object({ numero: textoLaxo, formula: textoLaxo, cumple: z.boolean().nullable().default(null) })
      .passthrough()
    const r = Articulo.safeParse({ numero: 'Art. 116 LGUC', formula: null, cumple: null })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.formula).toBe('')
  })
})
