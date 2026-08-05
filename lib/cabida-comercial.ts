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

/**
 * Proveedores de isócronas contemplados. `openrouteservice` fue el original
 * (Fase 16) pero su cuenta quedó deshabilitada — verificado 04-08: los tres
 * endpoints (isochrones, directions, geocode) devuelven 403 "Access to this
 * API has been disallowed" con la misma key, o sea es bloqueo de cuenta y no
 * de endpoint ni de configuración local. Se mantiene en la unión porque hay
 * datos históricos que podrían tenerlo y porque la key sigue en el entorno.
 * `valhalla` es el que se usa hoy (instancia pública de OSM.de, sin API key);
 * `mapbox` queda declarado para el salto a producción con token propio.
 */
export type IsocronaProveedor = 'openrouteservice' | 'valhalla' | 'mapbox'

export interface IsocronaResultado {
  metodo: IsocronaMetodo // NUNCA opcional — ver Pitfall 1, 16-RESEARCH.md
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon
  modo: 'caminando' | 'auto'
  minutos: number
  proveedor: IsocronaProveedor | null // null cuando metodo === 'circulo_equivalente'
  consultadoEl: string
  cacheHit: boolean
}

// Los 4 formatos objetivo de Fase 18 (COMPE-01) — Fase 16 acepta el parámetro
// para fijar la firma (lat,lng,formato)→resultado desde el día 1 (CABI-01)
// aunque todavía no lo use para ramificar ningún cálculo.
export type FormatoComercial = 'supermercado' | 'minimarket' | 'strip_center' | 'power_center'

// ADVERTENCIA: lib/terrenos-comercial.ts TAMBIÉN exporta un tipo llamado
// FormatoComercial ('local' | 'strip_center' | 'power_center') para una
// feature no relacionada (potencial de desarrollo de terrenos por
// superficie). Tiene un value-set DISTINTO y PARCIALMENTE solapado con el
// FormatoComercial de este archivo ('supermercado' | 'minimarket' |
// 'strip_center' | 'power_center'). CUALQUIER archivo de Fase 18 debe
// importar FormatoComercial SOLO desde '@/lib/cabida-comercial' — nunca
// desde '@/lib/terrenos-comercial'. Ver tests/unit/cabida-comercial-tipos.test.ts.
export type FuenteCompetidor = 'osm' | 'seed_list' | 'sii_geocodificado'
export type NivelConfianza = 'alta' | 'media' | 'baja'

export interface CompetidorDetectado {
  nombre: string // nombre real de cadena (seed_list / sii_geocodificado) o tag crudo de OSM (osm)
  formato: FormatoComercial // reusa el FormatoComercial YA definido en ESTE archivo — nunca importar el de terrenos-comercial.ts
  fuente: FuenteCompetidor
  lat: number
  lng: number
  distanciaM: number
  confianza: NivelConfianza // por-competidor: ej. una fila seed_list con direccion:null nunca llega a 'alta'
  direccionLabel?: string
}

export interface ResultadoCompetenciaFormato {
  formato: FormatoComercial
  competidores: CompetidorDetectado[]
  coberturaConocida: boolean // false = la(s) fuente(s) subyacentes para ESTE formato son conocidas como incompletas
  confianzaGlobal: NivelConfianza // NUNCA derivar solo de competidores.length (COMPE-05) — ver Plan 18-05
  disclosure: string // línea human-readable, renderizada siempre junto al conteo — nunca omitida
  consultadoEl: string
}

export interface AnalisisCabidaComercial {
  formato: FormatoComercial
  isocrona: IsocronaResultado
  competencia?: ResultadoCompetenciaFormato // NUEVO (Fase 18) — opcional hasta que Plan 18-07 lo pueble
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
