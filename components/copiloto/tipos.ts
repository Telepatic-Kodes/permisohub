// Tipos del copiloto. Viven aparte del componente porque las pestañas los
// importan y antes colgaban del drawer, que ya no existe: el copiloto es una
// página propia (app/(dashboard)/proyectos/[id]/copiloto).

export type TabId = "oguc" | "observaciones" | "checklist" | "estimacion"

export interface OgucArticulo {
  numero: string
  titulo: string
  formula: string
  valor_normativo: string
  valor_proyecto: string
  cumple: boolean | null
  observacion?: string
}

export interface OgucResult {
  articulos: OgucArticulo[]
  resumen: string
}

export interface ObservacionPrediccion {
  categoria: string
  frecuencia: "alta" | "media" | "baja"
  triggerEspecifico: string
  accionPreventiva: string
}

export interface ObservacionesResult {
  riesgoGlobal: "BAJO" | "MEDIO" | "ALTO"
  predicciones: ObservacionPrediccion[]
  resumen: string
}

export interface ChecklistItem {
  id?: string
  item_key: string
  nombre: string
  articulo_normativo: string
  descripcion: string
  obligatorio: boolean
  estado: "pendiente" | "ok"
}

export interface ChecklistResult {
  items: ChecklistItem[]
  // true cuando la zonificación del proyecto se resolvió después de que
  // este checklist se generó — el prompt no tuvo ese contexto todavía.
  desactualizadoPorZonificacion: boolean
}

export interface EstimacionResult {
  plazoMinDias: number
  plazoMaxDias: number
  factores: string[]
  recomendacion: string
  derechosCLP: number
  derechosUF: number
  derechosDetalle: string[]
  derechosAdvertencias: string[]
  ufFallback?: boolean
}

export interface CopilotoResult {
  oguc: OgucResult
  observaciones: ObservacionesResult
  checklist: ChecklistResult
  estimacion: EstimacionResult
}
