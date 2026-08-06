// Server-only. El valor de la UF del día, con caché de 24h y fallback.
//
// Se extrajo de app/api/utils/uf/route.ts el 06-08 porque apareció un SEGUNDO
// consumidor: consultarRolEnSII() necesita convertir el avalúo fiscal a UF (el
// endpoint nuevo del SII solo entrega pesos, ver lib/sii-lookup-server.ts).
// Con la lógica dentro de la ruta, ese segundo consumidor tenía dos caminos y
// ninguno bueno: un self-fetch HTTP a su propia app, o una copia del fetch a
// mindicador con su propia caché — o sea dos valores de UF que pueden diverger
// dentro del mismo request.
//
// La ruta sigue existiendo y su contrato de respuesta NO cambió: la consumen 5
// vistas del dashboard y el copiloto.

import { UF_FALLBACK_CLP } from '@/lib/uf'

export interface UfActual {
  valor: number
  /** ISO de la publicación. null cuando se está usando el fallback. */
  fecha: string | null
  /** true = mindicador.cl no respondió y el valor es la constante de respaldo. */
  fallback: boolean
  cached: boolean
  /** Motivo del fallback, para que la ruta lo siga exponiendo. */
  error?: string
}

let _cache: { valor: number; fecha: string; cachedAt: number } | null = null
const TTL_MS = 24 * 60 * 60 * 1000

export async function obtenerUfActual(): Promise<UfActual> {
  if (_cache && Date.now() - _cache.cachedAt < TTL_MS) {
    return { valor: _cache.valor, fecha: _cache.fecha, fallback: false, cached: true }
  }

  try {
    const res = await fetch('https://mindicador.cl/api/uf', { next: { revalidate: 86400 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = (await res.json()) as { serie?: { fecha: string; valor: number }[] }
    const latest = data.serie?.[0]
    if (!latest?.valor) throw new Error('Respuesta inválida de mindicador.cl')

    _cache = { valor: latest.valor, fecha: latest.fecha, cachedAt: Date.now() }
    return { valor: latest.valor, fecha: latest.fecha, fallback: false, cached: false }
  } catch (err) {
    return {
      valor: UF_FALLBACK_CLP,
      fecha: null,
      fallback: true,
      cached: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
