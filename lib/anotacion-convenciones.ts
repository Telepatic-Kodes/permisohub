// ---------------------------------------------------------------------------
// Convención gráfica de anotación sobre planos — ÚNICA fuente de verdad.
//
// Nace de la reunión 2026-07-02 con Estefanía: la app debe "rayar el plano"
// como el revisor DOM hacía a mano. Cambiar un color / grosor / etiqueta aquí
// se refleja en el endpoint, el visor y el export PNG a la vez.
// ---------------------------------------------------------------------------

export type TipoMarca = 'circulo' | 'flecha' | 'cuadro_nota' | 'linea'

export type ConvencionLinea = 'rojo_segmentado' | 'amarillo_segmentado'

export type Severidad = 'crítica' | 'media' | 'menor'

// Convención de líneas que pidió Estefanía explícitamente.
export const CONVENCION_LINEA: Record<
  ConvencionLinea,
  { color: string; label: string; dashed: boolean }
> = {
  rojo_segmentado: {
    color: '#ef4444',
    label: 'Muro que se prolonga',
    dashed: true,
  },
  amarillo_segmentado: {
    color: '#f59e0b',
    label: 'Elemento eliminado / nuevo',
    dashed: true,
  },
}

// Color de respaldo cuando la marca no usa convención de línea: por severidad.
export const SEVERIDAD_COLOR: Record<Severidad, string> = {
  'crítica': '#ef4444',
  'media': '#f59e0b',
  'menor': '#64748b',
}

export const TIPO_MARCA_LABEL: Record<TipoMarca, string> = {
  circulo: 'Círculo',
  flecha: 'Flecha',
  cuadro_nota: 'Cuadro de nota',
  linea: 'Línea',
}

// Color efectivo de una marca: la convención manda; si no hay, la severidad.
export function colorDeMarca(
  convencion: ConvencionLinea | null | undefined,
  severidad: Severidad,
): string {
  if (convencion && CONVENCION_LINEA[convencion]) return CONVENCION_LINEA[convencion].color
  return SEVERIDAD_COLOR[severidad] ?? SEVERIDAD_COLOR.menor
}

// bbox normalizado 0..1 respecto a la lámina (robusto a resize/escala).
export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Anotacion {
  id: string
  bbox: BBox
  tipoMarca: TipoMarca
  convencionLinea: ConvencionLinea | null
  severidad: Severidad
  textoCorto: string
  observacion: string
  articulo: string
  fundamento: string
  sugerencia: string
  confianza: number // 0..1 — bajo = ubicación incierta, se avisa en UI
  // Ancla visual: descripción textual de DÓNDE está la marca en el dibujo
  // (ej. "planta 2° piso, muro poniente entre ejes 2-3"). Obliga al modelo a
  // comprometerse con una ubicación y permite verificarla. Opcional en filas
  // antiguas guardadas antes de jul 2026.
  ancla?: string
  // Estado de resolución de la marca en el visor (Markups List, patrón
  // Bluebeam): el arquitecto la alterna pendiente ⇄ resuelta a medida que
  // corrige el plano. Opcional para no romper filas antiguas ni otros
  // consumidores (informe-pdf); ausente se trata como "pendiente".
  estado?: 'pendiente' | 'resuelta'
}

export interface LaminaAnotada {
  id: string
  nombre: string
  anotaciones: Anotacion[]
}
