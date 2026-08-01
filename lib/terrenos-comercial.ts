// ---------------------------------------------------------------------------
// Capa de filtrado por potencial de desarrollo comercial (local / strip
// center / power center) — ver conversación con Estefanía 31 jul 2026: los
// terrenos descubiertos son principalmente para evaluar desarrollo comercial,
// no residencial, así que el "ruido" a filtrar es justamente lo que NO sirve
// para ese fin.
//
// Dos señales, deliberadamente separadas (nunca combinarlas en un solo score
// oculto — cada una tiene una fuente y confiabilidad distinta):
// 1. formatoComercial(): determinista, solo superficie — instantáneo, gratis.
// 2. Clasificación de uso permitido: vía IA sobre zona_uperm/zona_uproh ya
//    resueltos (ver USO_COMERCIAL_PROMPT + su uso en lib/terrenos-server.ts),
//    la señal que de verdad separa "nunca va a poder tener un power center
//    por normativa" de "sí califica".
// ---------------------------------------------------------------------------

export type FormatoComercial = 'local' | 'strip_center' | 'power_center'

// Rangos estándar de la industria en Chile, confirmados con Estefanía
// (31 jul 2026) — ajustar acá si cambian, es la única fuente de verdad.
const UMBRAL_STRIP_CENTER_M2 = 2_000
const UMBRAL_POWER_CENTER_M2 = 15_000
const UMBRAL_LOCAL_MINIMO_M2 = 300

export const FORMATO_COMERCIAL_LABEL: Record<FormatoComercial, string> = {
  local: 'Local comercial',
  strip_center: 'Strip center',
  power_center: 'Power center',
}

/**
 * Formato de desarrollo comercial que la superficie del lote podría soportar
 * — solo un piso de tamaño, NO reemplaza el chequeo de uso permitido (un
 * lote de 20.000 m² zonificado exclusivamente residencial sigue sin servir).
 * Retorna null para superficies desconocidas o demasiado chicas para
 * cualquiera de los 3 formatos.
 */
export function formatoComercial(superficieLoteM2: number | null | undefined): FormatoComercial | null {
  if (!superficieLoteM2 || superficieLoteM2 < UMBRAL_LOCAL_MINIMO_M2) return null
  if (superficieLoteM2 >= UMBRAL_POWER_CENTER_M2) return 'power_center'
  if (superficieLoteM2 >= UMBRAL_STRIP_CENTER_M2) return 'strip_center'
  return 'local'
}

// Uso pretendido fijo pasado a verificarCompatibilidadUso (lib/zonificacion-compat.ts)
// para la clasificación en lote — deliberadamente agrupa los 3 formatos bajo
// "equipamiento de comercio" porque así es como los PRC chilenos categorizan
// el uso de suelo (visto en vivo repetidamente en zona_uperm: "Equipamiento
// de comercio", "Zona de Uso de Comercio") — preguntar por cada formato por
// separado no cambiaría el veredicto normativo, que se resuelve a nivel de
// categoría de uso, no de formato comercial específico.
export const USO_COMERCIAL_PROMPT =
  'desarrollo comercial (local comercial, strip center o power center — equipamiento de comercio)'
