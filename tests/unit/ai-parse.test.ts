import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { parseAiJson } from '@/lib/ai-parse'

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
