// Registro de cobertura de zonificación (PRC) por comuna — pequeño, profundo y curado
// a mano, siguiendo el patrón de lib/municipios-stats.ts (no se agrega a lib/comunas-chile.ts).
//
// Cada entrada mapea una comuna cubierta a su FeatureServer ArcGIS ya verificado en vivo
// (URL, índice de capa y casing exacto de los campos), según
// .planning/phases/10-motor-de-zonificacion/10-RESEARCH.md ("Verified Per-Comuna Registry").
//
// Este archivo es la fuente de verdad que consulta la ruta de lookup (Plan 10-04) antes de
// hacer cualquier llamada de red, para decidir si una comuna es 'dedicada', 'agregada' o no
// tiene cobertura (null) — nunca un objeto con campos vacíos indistinguible de cobertura real.

import { COMUNAS_CHILE } from './comunas-chile'

export type TierCobertura = 'dedicada' | 'agregada'

export interface ZonificacionFieldMap {
  region: string
  comuna: string
  sector: string
  zona: string
  nombre: string
  uperm: string
  uproh: string
  // Solo declarar si el servicio expone un link POR-ZONA real y vivo. No
  // fabricar ni reusar un link genérico — ver el caso Las Condes más abajo.
  url?: string
}

export interface ComunaZonificacionConfig {
  comunaId: string // matches ComunaChile.id in lib/comunas-chile.ts
  tier: TierCobertura
  featureServerUrl: string
  layerIndex: number
  fieldMap: ZonificacionFieldMap
  usosDisponibles: boolean // false for Ñuñoa — UPERM/UPROH are structurally empty in the source, must be disclosed, never inferred from nullability alone
}

export const ZONIFICACION_COMUNAS: Record<string, ComunaZonificacionConfig> = {
  'las-condes': {
    comunaId: 'las-condes',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Las_Condes/FeatureServer',
    layerIndex: 0,
    // Sin `url`: el campo ArcGIS "url" existía antes, pero apuntaba a
    // http://www.observatoriourbano.cl/Ipt/cehu_resultado_decreto.asp?r=0&c=193&i=25
    // para las 67 zonas de Las Condes por igual (no es un link por-zona pese
    // a presentarse como "decreto de la zona") y hoy devuelve HTTP 410 Gone.
    // Removido en el fix C5 de la Auditoría de Fidelidad de Datos (2026-07-30);
    // sin `url`, la UI cae al mismo tratamiento "sin link directo disponible —
    // consulta el CIP oficial" que ya usan Providencia y Vitacura.
    fieldMap: {
      region: 'region',
      comuna: 'comuna',
      sector: 'sector',
      zona: 'zona',
      nombre: 'nombre',
      uperm: 'uperm',
      uproh: 'uproh',
    },
    usosDisponibles: true,
  },
  providencia: {
    comunaId: 'providencia',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Providencia/FeatureServer',
    layerIndex: 0,
    fieldMap: {
      region: 'region',
      comuna: 'comuna',
      sector: 'sector',
      zona: 'zona',
      nombre: 'nombre',
      uperm: 'uperm',
      uproh: 'uproh',
    },
    usosDisponibles: true,
  },
  vitacura: {
    comunaId: 'vitacura',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Vitacura/FeatureServer',
    layerIndex: 0,
    fieldMap: {
      region: 'region',
      comuna: 'comuna',
      sector: 'sector',
      zona: 'zona',
      nombre: 'nombre',
      uperm: 'uperm',
      uproh: 'uproh',
    },
    usosDisponibles: true,
  },
  nunoa: {
    comunaId: 'nunoa',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: {
      region: 'REGION',
      comuna: 'COMUNA',
      sector: 'SECTOR',
      zona: 'ZONA',
      nombre: 'NOMBRE',
      uperm: 'UPERM',
      uproh: 'UPROH',
    },
    // Pitfall 8: UPERM/UPROH confirmados 0/200 llenos para Ñuñoa en esta capa agregada,
    // aunque la capa sí resuelve correctamente el código/nombre de zona. Debe declararse
    // explícitamente como no disponible — nunca inferirse solo de que el campo venga vacío.
    usosDisponibles: false,
  },
}

/**
 * Resolves whatever string is stored in proyectos.municipio (a display name
 * like "Las Condes", not a slug) to a zonificación registry entry.
 * Returns null when the comuna has no ArcGIS coverage — this is the
 * sin_cobertura signal, never an empty-but-truthy object (Pitfall 3).
 */
export function resolveComunaZonificacion(nombreOMunicipio: string): ComunaZonificacionConfig | null {
  const normalizado = nombreOMunicipio.trim().toLowerCase()
  const comuna = COMUNAS_CHILE.find(
    (c) => c.nombre.toLowerCase() === normalizado || c.id.toLowerCase() === normalizado,
  )
  const slug = comuna?.id ?? normalizado
  return ZONIFICACION_COMUNAS[slug] ?? null
}

/**
 * Lista de comunas con cobertura ArcGIS, para consumidores como el fallback
 * manual de Phase 11 (ZONE-05) sin tener que re-derivarla.
 */
export function getComunasConCobertura(): ComunaZonificacionConfig[] {
  return Object.values(ZONIFICACION_COMUNAS)
}
