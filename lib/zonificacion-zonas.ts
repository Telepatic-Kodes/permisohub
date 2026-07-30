// Consultas ArcGIS complementarias al lookup por punto (app/api/zonificacion/lookup/route.ts):
// aquí NO hay geometría de consulta — se listan valores distintos de zona dentro
// de una comuna, y se trae el detalle de una zona elegida a mano. Fallback manual
// de ZONE-05: reutiliza el mismo registro de lib/zonificacion-comunas.ts, sin
// curación estática que pueda quedar desactualizada.
import { resolveComunaZonificacion } from './zonificacion-comunas'

export interface ZonaListItem {
  zona: string
  nombre: string
}

export interface ZonaDetalle {
  zona: string
  nombre: string
  sector: string | null
  uperm: string | null
  uproh: string | null
  usosDisponibles: boolean
  fuenteUrl: string | null
}

function attrString(attrs: Record<string, unknown>, key: string | undefined): string | null {
  if (!key) return null
  const v = attrs[key]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

export async function fetchZonasDisponibles(comunaId: string): Promise<ZonaListItem[] | null> {
  const config = resolveComunaZonificacion(comunaId)
  if (!config) return null

  const url = new URL(`${config.featureServerUrl}/${config.layerIndex}/query`)
  url.searchParams.set('f', 'json')
  url.searchParams.set('where', '1=1')
  url.searchParams.set('outFields', `${config.fieldMap.zona},${config.fieldMap.nombre}`)
  url.searchParams.set('returnDistinctValues', 'true')
  url.searchParams.set('returnGeometry', 'false')
  url.searchParams.set('orderByFields', config.fieldMap.zona)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return null

  const json = (await res.json()) as { features?: { attributes: Record<string, unknown> }[] }
  const seen = new Set<string>()
  const out: ZonaListItem[] = []
  for (const row of json.features ?? []) {
    const zona = attrString(row.attributes, config.fieldMap.zona)
    if (!zona || seen.has(zona)) continue
    seen.add(zona)
    out.push({ zona, nombre: attrString(row.attributes, config.fieldMap.nombre) ?? zona })
  }
  return out
}

export async function fetchZonaDetalle(comunaId: string, zona: string): Promise<ZonaDetalle | null> {
  const config = resolveComunaZonificacion(comunaId)
  if (!config) return null

  const outFields = Object.values(config.fieldMap).join(',')
  const url = new URL(`${config.featureServerUrl}/${config.layerIndex}/query`)
  url.searchParams.set('f', 'json')
  url.searchParams.set('where', `${config.fieldMap.zona}='${zona.replace(/'/g, "''")}'`) // escape de comilla simple — el único caracter de riesgo en un WHERE ArcGIS de texto
  url.searchParams.set('outFields', outFields)
  url.searchParams.set('returnGeometry', 'false')
  url.searchParams.set('resultRecordCount', '1')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return null

  const json = (await res.json()) as { features?: { attributes: Record<string, unknown> }[] }
  const attrs = json.features?.[0]?.attributes
  if (!attrs) return null

  const nombre = attrString(attrs, config.fieldMap.nombre)
  if (!nombre) return null

  return {
    zona,
    nombre,
    sector: attrString(attrs, config.fieldMap.sector),
    uperm: attrString(attrs, config.fieldMap.uperm),
    uproh: attrString(attrs, config.fieldMap.uproh),
    usosDisponibles: config.usosDisponibles, // registry-level flag, igual que el lookup route — nunca derivado de que uperm/uproh vengan vacíos (Pitfall 8)
    fuenteUrl: attrString(attrs, config.fieldMap.url),
  }
}
