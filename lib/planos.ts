// Helpers para documentos de tipo plano/lámina.
//
// El uploader de la app usa etiquetas como "Plano de arquitectura" o
// "Plano estructural", mientras que el seed y algunas partes usan el tipo
// escueto "Plano". Este helper normaliza el criterio en un solo lugar para que
// el flujo de anotación reconozca cualquier documento que sea un plano.

const PLANO_RE = /plano|lámina|lamina|elevaci|planta|corte/i

/** True si el `tipo` de un documento corresponde a un plano/lámina. */
export function esPlano(tipo: string | null | undefined): boolean {
  if (!tipo) return false
  return PLANO_RE.test(tipo)
}
