import { createServiceClient } from '@/lib/supabase/service'
import { obtenerBandasMercadoLocales } from '@/lib/mercado-locales-server'
import type { OperacionMercadoLocal, TipoPropiedadComercial } from '@/lib/scrapers/mercado-locales-common'

export interface PropiedadPortafolio {
  id: string
  direccion: string
  comuna: string
  tipoPropiedad: TipoPropiedadComercial
  superficieM2: number | null
  operacion: OperacionMercadoLocal
  precioActualUf: number | null
  rolSii: string | null
  notas: string | null
  fechaVencimientoContrato: string | null
  createdAt: string
}

export interface ComparacionMercado {
  medianaUfM2: number | null
  muestraN: number
  usoFallback: boolean
  variacionPct: number | null // (precioActualUfM2 - medianaUfM2) / medianaUfM2 * 100
  veredicto: 'bajo_mercado' | 'a_mercado' | 'sobre_mercado' | 'sin_dato'
}

const UMBRAL_A_MERCADO_PCT = 10 // dentro de ±10% se considera "a mercado", no un desvío real

/**
 * Compara el precio actual de una propiedad del portafolio contra la banda
 * de mercado real (mismo motor que /mercado-inmobiliario/pricing) — a
 * diferencia de Pricing, acá la pregunta no es "¿a qué precio publico?" sino
 * "¿mi arriendo/precio YA vigente está desalineado del mercado?". Requiere
 * superficie_m2 para poder comparar en UF/m² (la única unidad comparable
 * entre propiedades de tamaños distintos).
 */
export async function compararConMercado(prop: PropiedadPortafolio): Promise<ComparacionMercado> {
  if (!prop.superficieM2 || !prop.precioActualUf) {
    return { medianaUfM2: null, muestraN: 0, usoFallback: false, variacionPct: null, veredicto: 'sin_dato' }
  }

  const bandas = await obtenerBandasMercadoLocales(prop.comuna, prop.operacion, prop.tipoPropiedad)
  if (!bandas || bandas.medianaUfM2 === null) {
    return { medianaUfM2: null, muestraN: bandas?.muestraN ?? 0, usoFallback: bandas?.usoFallback ?? false, variacionPct: null, veredicto: 'sin_dato' }
  }

  const precioActualUfM2 = prop.precioActualUf / prop.superficieM2
  const variacionPct = ((precioActualUfM2 - bandas.medianaUfM2) / bandas.medianaUfM2) * 100

  let veredicto: ComparacionMercado['veredicto'] = 'a_mercado'
  if (variacionPct <= -UMBRAL_A_MERCADO_PCT) veredicto = 'bajo_mercado'
  else if (variacionPct >= UMBRAL_A_MERCADO_PCT) veredicto = 'sobre_mercado'

  return {
    medianaUfM2: bandas.medianaUfM2,
    muestraN: bandas.muestraAreaN,
    usoFallback: bandas.usoFallback,
    variacionPct,
    veredicto,
  }
}

export async function obtenerPropiedadesPortafolio(workspaceId: string): Promise<PropiedadPortafolio[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('propiedades_portafolio')
    .select('id, direccion, comuna, tipo_propiedad, superficie_m2, operacion, precio_actual_uf, rol_sii, notas, fecha_vencimiento_contrato, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((f) => ({
    id: f.id,
    direccion: f.direccion,
    comuna: f.comuna,
    tipoPropiedad: f.tipo_propiedad as TipoPropiedadComercial,
    superficieM2: f.superficie_m2,
    operacion: f.operacion as OperacionMercadoLocal,
    precioActualUf: f.precio_actual_uf,
    rolSii: f.rol_sii,
    notas: f.notas,
    fechaVencimientoContrato: f.fecha_vencimiento_contrato,
    createdAt: f.created_at,
  }))
}
