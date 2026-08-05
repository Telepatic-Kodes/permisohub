import * as turf from '@turf/turf'
import { fetchWithTimeout } from '@/lib/scraper'
import { reportError, reportWarning } from '@/lib/observability'
import type { IsocronaResultado, IsocronaProveedor } from '@/lib/cabida-comercial'

// ---------------------------------------------------------------------------
// Fase 16 (isócronas) — implementada 04-08 tras confirmar que la cuenta de
// OpenRouteService está deshabilitada a nivel de cuenta, no de endpoint:
// isochrones, directions y geocode devuelven los tres 403 "Access to this API
// has been disallowed" con la misma key de 119 chars ya presente en el
// entorno. O sea NO era un bug de configuración local (a diferencia del
// NEXT_PUBLIC_APP_URL con puerto 7891 de esta misma mañana) y no se arregla
// re-pidiendo la key.
//
// Se reemplaza por Valhalla, verificado en vivo contra Chile antes de escribir
// este archivo: peatonal 15 min en Plaza Ñuñoa devuelve un Polygon de 34
// vértices (~2,4 km de ancho) y auto 10 min uno de 169 vértices (~5,2 km), en
// ~1 s y sin API key.
//
// El módulo es agnóstico de proveedor a propósito: la instancia pública de
// OSM.de es de uso comunitario razonable, NO apta para batch masivo — para eso
// hay que pasar a Mapbox con token propio (ISOCRONA_PROVEEDOR=mapbox +
// MAPBOX_ACCESS_TOKEN). Agregar un proveedor es implementar una función que
// devuelva geometría; nada más del pipeline cambia.
//
// REGLA CENTRAL: si ningún proveedor responde, se cae a un círculo de radio
// equivalente pero SIEMPRE marcado `metodo: 'circulo_equivalente'` y
// `proveedor: null`. Nunca se presenta un círculo como si fuera una isócrona
// de red vial — es el mismo principio que zona_precision='centroide_comuna'.
// Además calcularVeredictoCabida() depende de esa distinción: degrada la
// confianza a 'baja' y se niega a emitir veredicto ante un círculo.
// ---------------------------------------------------------------------------

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/isochrone'
const MAPBOX_URL = 'https://api.mapbox.com/isochrone/v1/mapbox'
const TIMEOUT_MS = 15000

export type ModoIsocrona = 'caminando' | 'auto'

/**
 * Velocidades para el círculo de respaldo. Deliberadamente conservadoras
 * (menores que la velocidad real de desplazamiento) porque un círculo en línea
 * recta SIEMPRE sobreestima el área alcanzable: ninguna red vial real permite
 * ir en línea recta en todas las direcciones. Preferimos subestimar el alcance
 * antes que inflar la población cubierta.
 */
const KMH_RESPALDO: Record<ModoIsocrona, number> = {
  caminando: 4.2,
  auto: 22, // urbano con semáforos, no velocidad de crucero
}

const COSTING_VALHALLA: Record<ModoIsocrona, string> = {
  caminando: 'pedestrian',
  auto: 'auto',
}

const PERFIL_MAPBOX: Record<ModoIsocrona, string> = {
  caminando: 'walking',
  auto: 'driving',
}

export interface OpcionesIsocrona {
  lat: number
  lng: number
  minutos: number
  modo: ModoIsocrona
}

type Geometria = GeoJSON.Polygon | GeoJSON.MultiPolygon

/** Extrae la geometría del primer feature de un FeatureCollection GeoJSON. */
function primeraGeometria(payload: unknown): Geometria | null {
  if (typeof payload !== 'object' || payload === null) return null
  const features = (payload as { features?: unknown }).features
  if (!Array.isArray(features) || features.length === 0) return null

  // Valhalla devuelve los contornos de mayor a menor; con un solo contorno
  // pedido da igual, pero tomamos explícitamente el primero para no depender
  // del orden si algún día se piden varios.
  const geometria = (features[0] as { geometry?: unknown }).geometry
  if (typeof geometria !== 'object' || geometria === null) return null

  const tipo = (geometria as { type?: unknown }).type
  const coords = (geometria as { coordinates?: unknown }).coordinates
  if ((tipo !== 'Polygon' && tipo !== 'MultiPolygon') || !Array.isArray(coords) || coords.length === 0) {
    return null
  }
  return geometria as Geometria
}

async function isocronaValhalla({ lat, lng, minutos, modo }: OpcionesIsocrona): Promise<Geometria | null> {
  const json = JSON.stringify({
    locations: [{ lat, lon: lng }],
    costing: COSTING_VALHALLA[modo],
    contours: [{ time: minutos }],
    polygons: true,
  })
  const res = await fetchWithTimeout(`${VALHALLA_URL}?json=${encodeURIComponent(json)}`, {}, TIMEOUT_MS)
  if (!res.ok) {
    reportWarning(`Valhalla respondió ${res.status}`, {
      scope: 'isocrona.valhalla',
      extra: { lat, lng, minutos, modo, status: res.status },
    })
    return null
  }
  return primeraGeometria(await res.json())
}

async function isocronaMapbox({ lat, lng, minutos, modo }: OpcionesIsocrona): Promise<Geometria | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    reportWarning('ISOCRONA_PROVEEDOR=mapbox pero falta MAPBOX_ACCESS_TOKEN', { scope: 'isocrona.mapbox' })
    return null
  }
  const url =
    `${MAPBOX_URL}/${PERFIL_MAPBOX[modo]}/${lng},${lat}` +
    `?contours_minutes=${minutos}&polygons=true&access_token=${token}`
  const res = await fetchWithTimeout(url, {}, TIMEOUT_MS)
  if (!res.ok) {
    reportWarning(`Mapbox respondió ${res.status}`, {
      scope: 'isocrona.mapbox',
      extra: { lat, lng, minutos, modo, status: res.status },
    })
    return null
  }
  return primeraGeometria(await res.json())
}

/** Radio en km que cubriría `minutos` a la velocidad conservadora del modo. */
export function radioEquivalenteKm(minutos: number, modo: ModoIsocrona): number {
  return (KMH_RESPALDO[modo] * minutos) / 60
}

/**
 * Isócrona de red vial con respaldo honesto a círculo.
 *
 * NUNCA lanza: cualquier fallo del proveedor cae al círculo, que queda
 * explícitamente marcado `metodo: 'circulo_equivalente'` / `proveedor: null`
 * para que la UI y calcularVeredictoCabida() puedan distinguirlo.
 */
export async function obtenerIsocrona(opciones: OpcionesIsocrona): Promise<IsocronaResultado> {
  const { lat, lng, minutos, modo } = opciones
  const consultadoEl = new Date().toISOString()
  const proveedor = (process.env.ISOCRONA_PROVEEDOR ?? 'valhalla') as IsocronaProveedor

  try {
    const geometria =
      proveedor === 'mapbox' ? await isocronaMapbox(opciones) : await isocronaValhalla(opciones)

    if (geometria) {
      return { metodo: 'red_vial', geometria, modo, minutos, proveedor, consultadoEl, cacheHit: false }
    }
  } catch (err) {
    reportError(err, { scope: 'isocrona', extra: { lat, lng, minutos, modo, proveedor } })
  }

  return {
    metodo: 'circulo_equivalente',
    geometria: turf.circle([lng, lat], radioEquivalenteKm(minutos, modo), { units: 'kilometers' }).geometry,
    modo,
    minutos,
    proveedor: null,
    consultadoEl,
    cacheHit: false,
  }
}
