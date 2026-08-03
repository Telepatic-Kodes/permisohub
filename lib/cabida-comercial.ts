// Client-safe types + fetch helper para el motor de Cabida Comercial.
// Mirrors lib/zonificacion.ts's shape — toda la lógica server-only (ORS,
// Supabase, geocoding) vive en lib/cabida-comercial-server.ts e
// lib/isocrona-server.ts, no acá.

export type UbicacionPrecision = 'aproximada' | 'centroide_comuna'
// Deliberadamente NO incluye 'exacta' en v1.7 — mercado_locales_listings no
// tiene columna direccion, solo locationText sector-level (ver
// 16-RESEARCH.md). La unión se deja abierta (no un boolean, no un 2-value
// enum hardcodeado en cada consumidor) para que un futuro modo standalone
// por dirección de usuario (CABI-03, milestone futuro) pueda agregar
// 'exacta' sin breaking change.

export interface UbicacionCabida {
  lat: number
  lng: number
  comuna: string
  precision: UbicacionPrecision
  direccionLabel: string // string de display, no necesariamente re-geocodificable
  fuenteTexto: string // el texto de entrada QUE FUE geocodificado — para disclosure en UI, nunca oculto
}

export type IsocronaMetodo = 'red_vial' | 'circulo_equivalente'

export interface IsocronaResultado {
  metodo: IsocronaMetodo // NUNCA opcional — ver Pitfall 1, 16-RESEARCH.md
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon
  modo: 'caminando' | 'auto'
  minutos: number
  proveedor: 'openrouteservice' | null // null cuando metodo === 'circulo_equivalente'
  consultadoEl: string
  cacheHit: boolean
}

// Los 4 formatos objetivo de Fase 18 (COMPE-01) — Fase 16 acepta el parámetro
// para fijar la firma (lat,lng,formato)→resultado desde el día 1 (CABI-01)
// aunque todavía no lo use para ramificar ningún cálculo.
export type FormatoComercial = 'supermercado' | 'minimarket' | 'strip_center' | 'power_center'

export interface AnalisisCabidaComercial {
  formato: FormatoComercial
  isocrona: IsocronaResultado
  generadoEl: string
}

export interface CabidaComercialAnalisisResponse {
  ok: boolean
  error?: string
  ubicacion?: UbicacionCabida
  analisis?: AnalisisCabidaComercial
}

/**
 * Fetch helper client-safe hacia la ruta genérica (Plan 16-05). Acepta
 * oportunidadId O direccion+comuna — nunca ambos requeridos a la vez, mismo
 * criterio que lookupZonificacion().
 *
 * Nombrada `consultarCabidaComercial` (NO `obtenerAnalisisCabidaComercial`)
 * a propósito — este repo ya distingue nombres entre el helper client-safe y
 * la función pura server-only equivalente (ver lookupZonificacion() en
 * lib/zonificacion.ts vs persistZonificacionParaProyecto() en
 * lib/zonificacion-server.ts). `obtenerAnalisisCabidaComercial` es el nombre
 * reservado para la función pura `(lat, lng, formato)` de
 * lib/cabida-comercial-server.ts (Plan 16-04, CABI-01) — mismo nombre en
 * ambos archivos habría sido ambiguo.
 */
export async function consultarCabidaComercial(params: {
  oportunidadId?: string
  direccion?: string
  comuna?: string
  formato?: FormatoComercial
  force?: boolean
}): Promise<CabidaComercialAnalisisResponse> {
  const search = new URLSearchParams()
  if (params.oportunidadId) search.set('oportunidadId', params.oportunidadId)
  if (params.direccion) search.set('direccion', params.direccion)
  if (params.comuna) search.set('comuna', params.comuna)
  if (params.formato) search.set('formato', params.formato)
  if (params.force) search.set('force', 'true')

  const res = await fetch(`/api/cabida-comercial/analisis?${search.toString()}`)
  return res.json() as Promise<CabidaComercialAnalisisResponse>
}
