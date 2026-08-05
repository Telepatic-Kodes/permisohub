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
import { z, type ZodType } from 'zod'

// ---------------------------------------------------------------------------
// Campos tolerantes a null para schemas que parsean SALIDA DE UN LLM.
//
// `.default()` y `.optional()` de zod solo cubren `undefined`: ante un `null`
// explícito del modelo, safeParse FALLA y tumba el objeto entero. No es
// teórico — pasó el 05-08 en /api/ai/copiloto: al sumar artículos LGUC
// (procedimentales, sin fórmula) el modelo empezó a mandar `"formula": null`
// con toda razón, el parseo falló y la ruta cayó a su fallback, mostrando
// `articulos: []` y el JSON crudo del modelo volcado en un campo de texto.
//
// Estos helpers viven acá y no en cada ruta a propósito: la auditoría del
// 05-08 encontró el mismo agujero latente en 5 rutas más, y una sola
// (extract-observations) lo tenía bien — cada archivo estaba decidiendo el
// criterio por su cuenta.
//
// Usar SOLO para parsear respuestas del modelo. Para validar el request body
// de un cliente conviene lo contrario: ser estricto y rechazar.
// ---------------------------------------------------------------------------

/** string que tolera null/ausente y normaliza a ''. */
export const textoLaxo = z
  .string()
  .nullable()
  .optional()
  .transform((v) => v ?? '')

/** array que tolera null/ausente y normaliza a []. */
export function arrayLaxo<T extends ZodType>(item: T) {
  return z
    .array(item)
    .nullable()
    .optional()
    .transform((v) => v ?? [])
}

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
