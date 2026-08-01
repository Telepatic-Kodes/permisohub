export const dynamic = 'force-dynamic'

import { UF_FALLBACK_CLP } from '@/lib/uf'

// Ruta nueva, no toca /api/utils/uf (5 llamadores existentes dependen de su
// forma exacta). Mismo patrón de caché en 2 capas (TTL en memoria + Next
// revalidate) que esa ruta hermana, extendido a IPC/TPM/dólar.

interface IndicadoresCache {
  valor: number
  fecha: string | null
  ipc: number | null
  tpm: number | null
  dolar: number | null
  cachedAt: number
}

let _cache: IndicadoresCache | null = null
const TTL_MS = 24 * 60 * 60 * 1000

interface MindicadorResponse {
  serie: { valor: number; fecha: string }[]
}

async function fetchIndicador(nombre: string): Promise<{ valor: number; fecha: string } | null> {
  try {
    const res = await fetch(`https://mindicador.cl/api/${nombre}`, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = (await res.json()) as MindicadorResponse
    const latest = data.serie?.[0]
    return latest?.valor != null ? { valor: latest.valor, fecha: latest.fecha } : null
  } catch {
    return null
  }
}

function respuestaDesdeCache(cache: IndicadoresCache, cached: boolean) {
  return Response.json({
    ok: true,
    valor: cache.valor,
    fecha: cache.fecha,
    ipc: cache.ipc,
    tpm: cache.tpm,
    dolar: cache.dolar,
    cached,
  })
}

export async function GET() {
  if (_cache && Date.now() - _cache.cachedAt < TTL_MS) {
    return respuestaDesdeCache(_cache, true)
  }

  const [uf, ipc, tpm, dolar] = await Promise.all([
    fetchIndicador('uf'),
    fetchIndicador('ipc'),
    fetchIndicador('tpm'),
    fetchIndicador('dolar'),
  ])

  if (!uf) {
    return Response.json({
      ok: false,
      valor: UF_FALLBACK_CLP,
      fecha: null,
      ipc: ipc?.valor ?? null,
      tpm: tpm?.valor ?? null,
      dolar: dolar?.valor ?? null,
      fallback: true,
    })
  }

  _cache = { valor: uf.valor, fecha: uf.fecha, ipc: ipc?.valor ?? null, tpm: tpm?.valor ?? null, dolar: dolar?.valor ?? null, cachedAt: Date.now() }
  return respuestaDesdeCache(_cache, false)
}
