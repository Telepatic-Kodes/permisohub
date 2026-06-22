export const dynamic = 'force-dynamic'

let _cache: { valor: number; fecha: string; cachedAt: number } | null = null
const TTL_MS = 24 * 60 * 60 * 1000

export async function GET() {
  if (_cache && Date.now() - _cache.cachedAt < TTL_MS) {
    return Response.json({ ok: true, valor: _cache.valor, fecha: _cache.fecha, cached: true })
  }

  try {
    const res = await fetch('https://mindicador.cl/api/uf', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json() as { serie: { fecha: string; valor: number }[] }
    const latest = data.serie?.[0]
    if (!latest?.valor) throw new Error('Respuesta inválida de mindicador.cl')

    _cache = { valor: latest.valor, fecha: latest.fecha, cachedAt: Date.now() }
    return Response.json({ ok: true, valor: latest.valor, fecha: latest.fecha, cached: false })
  } catch (err) {
    return Response.json({
      ok: false,
      valor: 38000,
      fecha: null,
      error: err instanceof Error ? err.message : String(err),
      fallback: true,
    })
  }
}
