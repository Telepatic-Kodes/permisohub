// Address -> lat/lng geocoding via Nominatim (OpenStreetMap), server-side only.

import { fetchWithTimeout } from './scraper'

export interface GeocodeResult {
  ok: boolean
  lat?: number
  lng?: number
  comunaDetectada?: string // address.suburb, falling back to address.city — see note below
  displayName?: string
  error?: string
}

interface NominatimAddress {
  suburb?: string
  city?: string
  road?: string
  house_number?: string
  postcode?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

let lastRequestAt = 0
const MIN_INTERVAL_MS = 1100

// Encadenado sobre una promesa module-level en vez de leer/escribir
// `lastRequestAt` directamente: con llamadas concurrentes, todas leían el
// mismo `lastRequestAt` antes de que ninguna lo actualizara, dormían el
// mismo resto de intervalo, y disparaban su fetch simultáneamente — el
// throttle producía una ráfaga sincronizada en vez de espaciar las
// llamadas. Encadenar hace que cada llamada espere a que la anterior
// termine de calcular su propio turno antes de calcular el suyo.
let cola: Promise<void> = Promise.resolve()

function throttle(): Promise<void> {
  const turno = cola.then(async () => {
    const espera = MIN_INTERVAL_MS - (Date.now() - lastRequestAt)
    if (espera > 0) {
      await new Promise((resolve) => setTimeout(resolve, espera))
    }
    lastRequestAt = Date.now()
  })
  cola = turno.catch(() => {})
  return turno
}

/**
 * Geocodes a Chilean address via Nominatim (OpenStreetMap), server-side only.
 *
 * CRITICAL: reads address.suburb (falling back to address.city only when
 * suburb is absent) for the comuna cross-check. Nominatim's address.city
 * field is NOT reliably the comuna in the Santiago context — live testing
 * (see .planning/phases/10-motor-de-zonificacion/10-RESEARCH.md) showed
 * address.city = "Santiago" for 3 of 4 target comunas (Las Condes, Vitacura,
 * Ñuñoa) even though the real comuna was correctly present in address.suburb.
 * Reading address.city alone would make the mandatory comuna cross-check
 * silently and systematically fail for exactly the comunas this phase targets.
 */
export async function geocodeDireccion(direccion: string, comuna: string): Promise<GeocodeResult> {
  await throttle()

  const query = `${direccion}, ${comuna}, Santiago, Chile`
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '1',
    countrycodes: 'cl',
  })

  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'PermisoHub/1.0 (+https://permisohub.cl; contacto@permisohub.cl)',
          'Accept': 'application/json',
        },
      },
      10_000,
    )

    if (!res.ok) {
      return { ok: false, error: `Nominatim HTTP ${res.status}` }
    }

    const results = (await res.json()) as NominatimResult[]
    if (!Array.isArray(results) || results.length === 0) {
      return { ok: false, error: 'Dirección no encontrada' }
    }

    // Multiple results for the same house number are common and near-identical
    // in lat/lng (different POIs at the same building) — results[0] is safe
    // for this address style, no disambiguation logic needed for MVP.
    const best = results[0]
    const lat = parseFloat(best.lat) // Nominatim returns lat/lon as STRINGS
    const lng = parseFloat(best.lon)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return { ok: false, error: 'Coordenadas inválidas en la respuesta de Nominatim' }
    }

    return {
      ok: true,
      lat,
      lng,
      comunaDetectada: best.address?.suburb ?? best.address?.city,
      displayName: best.display_name,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de geocoding' }
  }
}

/**
 * Resuelve el centroide (punto representativo) de una comuna completa, vía
 * Nominatim con parámetros ESTRUCTURADOS (city=/country=), no el q= de texto
 * libre que usa geocodeDireccion(). Una query estructurada de área
 * administrativa es más confiable para resolver a un punto representativo de
 * la comuna que un texto libre pensado para direcciones tipo calle+número.
 *
 * Usado como fallback cuando geocodeDireccion(locationText, comuna) falla
 * outright (geo.ok === false) — NUNCA como heurística de "coarse vs fine"
 * (locationText de mercado_locales_listings ya es sector-level, sin
 * house_number/road que distinguir — ver 16-RESEARCH.md, Anti-Pattern 2).
 */
export async function geocodeComunaCentroide(comuna: string): Promise<GeocodeResult> {
  await throttle()

  const params = new URLSearchParams({
    city: comuna,
    country: 'Chile',
    format: 'json',
    limit: '1',
    addressdetails: '1',
    countrycodes: 'cl',
  })

  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'PermisoHub/1.0 (+https://permisohub.cl; contacto@permisohub.cl)',
          'Accept': 'application/json',
        },
      },
      10_000,
    )

    if (!res.ok) {
      return { ok: false, error: `Nominatim HTTP ${res.status}` }
    }

    const results = (await res.json()) as NominatimResult[]
    if (!Array.isArray(results) || results.length === 0) {
      return { ok: false, error: `Comuna "${comuna}" no encontrada` }
    }

    const best = results[0]
    const lat = parseFloat(best.lat)
    const lng = parseFloat(best.lon)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return { ok: false, error: 'Coordenadas inválidas en la respuesta de Nominatim' }
    }

    return {
      ok: true,
      lat,
      lng,
      comunaDetectada: best.address?.suburb ?? best.address?.city,
      displayName: best.display_name,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de geocoding de comuna' }
  }
}
