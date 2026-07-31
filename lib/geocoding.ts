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

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastRequestAt = Date.now()
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
