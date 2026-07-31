// Parseo seguro de salidas JSON de la IA — M5 (auditoría 2026-07-30).
//
// Todas las rutas app/api/ai/** extraían el JSON de la respuesta del modelo
// con el mismo patrón fragil: `text.match(/\{[\s\S]*\}/)` + `JSON.parse` +
// cast `as X` sin validación de runtime. Un cambio de forma del modelo (campo
// faltante, tipo distinto, JSON truncado) pasaba directo a la UI o rompía con
// un 500 sin registro útil.
//
// `parseAiJson` centraliza extracción + validación con zod (ya era
// dependencia, no se usaba en app/api/ai/**). En éxito devuelve los datos
// validados; en cualquier fallo devuelve `null` y deja un console.error con
// el nombre de la ruta — el llamador decide el fallback degradado (cada ruta
// ya tenía uno antes de esta migración; se preserva tal cual).
import type { ZodType } from 'zod'

export function parseAiJson<T>(text: string, schema: ZodType<T>, routeName: string): T | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    console.error(`[ai:${routeName}] parseAiJson: no se encontró un bloque JSON en la respuesta del modelo`)
    // TODO: migrar a reportError
    return null
  }

  let raw: unknown
  try {
    raw = JSON.parse(match[0])
  } catch (err) {
    console.error(`[ai:${routeName}] parseAiJson: JSON.parse falló`, err)
    // TODO: migrar a reportError
    return null
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    console.error(`[ai:${routeName}] parseAiJson: la respuesta no cumple el schema esperado`, result.error.issues)
    // TODO: migrar a reportError
    return null
  }

  return result.data
}
