// Client-safe types + Zod boundary validation + fetch helper for zonificación (PRC) lookup.
// Mirrors lib/sii-lookup.ts's shape — must be safe to import from a client component
// (Phase 11), so it must NEVER import the server-only Supabase admin client or anything
// server-only. All service-role/DB logic and ArcGIS URL construction live in
// app/api/zonificacion/lookup/route.ts, not here.

import { z } from 'zod'

export type ZonaStatus = 'encontrado' | 'sin_cobertura' | 'error'

export interface ZonaData {
  comunaId: string
  tier: 'dedicada' | 'agregada'
  cacheId: string // id de la fila en zonificacion_cache; permite a proyectos.zona_cache_id apuntar a un registro real. '' cuando la escritura de caché falló (sin fila real que referenciar) — tratar como falsy.
  region: string | null
  sector: string | null
  zona: string
  nombreZona: string
  uperm: string | null
  uproh: string | null
  usosDisponibles: boolean // false for Ñuñoa — see lib/zonificacion-comunas.ts. Never infer this from uperm/uproh being empty.
  fuenteUrl: string | null
  fuenteActualizadaEl: string | null
  lat: number
  lng: number
  cacheHit: boolean
  consultadoEl: string
}

export interface ZonaLookupResponse {
  ok: boolean
  status: ZonaStatus
  data?: ZonaData
  error?: string
}

// ArcGIS field names/order aren't contractually guaranteed stable across comuna
// layers, which is exactly why field NAMES are validated generically via
// z.record rather than hardcoded per-comuna keys — the per-comuna key names
// live in lib/zonificacion-comunas.ts's fieldMap, not here.
export const ArcGISFeatureSchema = z.object({
  attributes: z.record(z.string(), z.unknown()),
  geometry: z.unknown().optional(),
})

export const ArcGISQueryResponseSchema = z.object({
  features: z.array(ArcGISFeatureSchema),
})

export type ArcGISQueryResponse = z.infer<typeof ArcGISQueryResponseSchema>

export async function lookupZonificacion(direccion: string, comuna: string): Promise<ZonaLookupResponse> {
  const params = new URLSearchParams({ direccion, comuna })
  const res = await fetch(`/api/zonificacion/lookup?${params.toString()}`)
  return res.json() as Promise<ZonaLookupResponse>
}
