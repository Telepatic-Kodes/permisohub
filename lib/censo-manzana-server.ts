// Población/viviendas dentro de un polígono arbitrario, vía intersección
// espacial en vivo contra el Censo 2017 (manzana). Fase 17 — DEMO-01.
//
// CORRECCIÓN CRÍTICA (17-RESEARCH.md, 2026-08-03): el FeatureServer citado a
// nivel de milestone en STACK.md/ARCHITECTURE.md
// (services3.arcgis.com/cTnMkBRk4HWkUCRo/.../SHAPES_CENSO_2017/FeatureServer/8)
// responde HTTP 200 con schema correcto, pero cubre SOLO 8 comunas de la
// Región de Atacama (3.928 manzanas) — CERO cobertura en la Región
// Metropolitana, donde vive el 100% de mercado_locales_listings. Ese
// servicio NUNCA lanza error para una consulta RM — retorna
// silenciosamente {features: []}, el failure mode más peligroso posible
// (un "0 personas" que parece un dato válido). NO REVERTIR a ese URL sin
// releer 17-RESEARCH.md primero.
//
// El servicio CORRECTO, verificado en vivo con una consulta real de
// polígono contra Providencia (10+ manzanas reales retornadas,
// NOM_COMUNA='PROVIDENCIA'), es:
const CENSO_2017_MANZANA_FEATURESERVER =
  'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/Manzanas_censo_2017/FeatureServer/0/query'
// 158.927 manzanas nacionales, 49.974 en "REGIÓN METROPOLITANA DE SANTIAGO"
// (verificado vía groupByFieldsForStatistics, ver 17-RESEARCH.md Sources).

import { z } from 'zod'
import { fetchWithTimeout } from '@/lib/scraper'

const ManzanaFeatureSchema = z.object({
  attributes: z.object({
    TOTAL_PERS: z.number().int().nullable().optional(),
    TOTAL_VIVI: z.number().int().nullable().optional(),
    MANZENT_I: z.string().nullable().optional(),
    NOM_COMUNA: z.string().nullable().optional(),
  }),
})
const ArcGisCensoResponseSchema = z.object({
  features: z.array(ManzanaFeatureSchema).default([]),
  exceededTransferLimit: z.boolean().optional(),
  error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
})

export interface PoblacionCensoResultado {
  ok: boolean
  totalPersonas: number
  totalViviendas: number
  manzanasIntersectadas: number
  comunasTocadas: string[]
  censoAno: 2017 // NUNCA opcional — DEMO-03
  fuente: 'INE Censo 2017 — manzana censal'
  consultadoEl: string
  paginado: boolean // true si exceededTransferLimit — ver Pitfall 3, 17-RESEARCH.md
  error?: string
}

// GeoJSON Polygon: coordinates ES YA un array de linear rings de [lng,lat] —
// misma forma que Esri rings. MultiPolygon: un array de Polygons, cada uno
// con sus propios rings — Esri acepta múltiples rings en un solo array
// (partes independientes), así que aplanamos. Conversión escrita en UN solo
// lugar (ver lib/zonificacion-geo.ts para la dirección inversa) — no
// reimplementar esto en ningún otro archivo.
export function geometriaGeoJsonARings(
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon
): number[][][] {
  if (geometria.type === 'Polygon') return geometria.coordinates
  return geometria.coordinates.flat(1)
}

/**
 * Pura por geometría — nunca acepta oportunidadId ni lat/lng directo (mismo
 * criterio que obtenerCompetenciaPorFormato() de Fase 18). Convierte GeoJSON
 * → Esri rings, consulta el FeatureServer CORRECTO vía POST (nunca GET — un
 * polígono de isócrona real puede exceder límites de longitud de URL),
 * agrega TOTAL_PERS/TOTAL_VIVI. Nunca lanza — retorna { ok:false, ... 0s }
 * ante cualquier fallo de red/parseo, mismo contrato "non-success explícito"
 * que geocodeDireccion().
 */
export async function obtenerPoblacionEnPoligono(
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon
): Promise<PoblacionCensoResultado> {
  const consultadoEl = new Date().toISOString()
  const vacio = (error?: string): PoblacionCensoResultado => ({
    ok: !error,
    totalPersonas: 0,
    totalViviendas: 0,
    manzanasIntersectadas: 0,
    comunasTocadas: [],
    censoAno: 2017,
    fuente: 'INE Censo 2017 — manzana censal',
    consultadoEl,
    paginado: false,
    ...(error ? { error } : {}),
  })

  try {
    const rings = geometriaGeoJsonARings(geometria)
    const body = new URLSearchParams({
      geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPolygon',
      spatialRel: 'esriSpatialRelIntersects',
      inSR: '4326',
      outSR: '4326',
      outFields: 'TOTAL_PERS,TOTAL_VIVI,MANZENT_I,NOM_COMUNA',
      returnGeometry: 'false',
      f: 'json',
    })

    const res = await fetchWithTimeout(
      CENSO_2017_MANZANA_FEATURESERVER,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
      15000
    )
    if (!res.ok) return vacio(`ArcGIS respondió HTTP ${res.status}`)

    const json = await res.json()
    const parsed = ArcGisCensoResponseSchema.safeParse(json)
    if (!parsed.success) return vacio('Respuesta de ArcGIS con schema inesperado')
    if (parsed.data.error) return vacio(parsed.data.error.message ?? 'ArcGIS retornó un error')

    const comunas = new Set<string>()
    let totalPersonas = 0
    let totalViviendas = 0
    for (const f of parsed.data.features) {
      totalPersonas += f.attributes.TOTAL_PERS ?? 0
      totalViviendas += f.attributes.TOTAL_VIVI ?? 0
      if (f.attributes.NOM_COMUNA) comunas.add(f.attributes.NOM_COMUNA)
    }

    return {
      ok: true,
      totalPersonas,
      totalViviendas,
      manzanasIntersectadas: parsed.data.features.length,
      comunasTocadas: [...comunas],
      censoAno: 2017,
      fuente: 'INE Censo 2017 — manzana censal',
      consultadoEl,
      paginado: parsed.data.exceededTransferLimit === true,
    }
  } catch (err) {
    return vacio(err instanceof Error ? err.message : 'Error desconocido consultando ArcGIS')
  }
}
