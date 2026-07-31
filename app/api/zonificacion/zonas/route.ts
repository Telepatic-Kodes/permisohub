import { getComunasConCobertura, resolveComunaZonificacion } from '@/lib/zonificacion-comunas'
import { fetchZonasDisponibles } from '@/lib/zonificacion-zonas'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const comuna = searchParams.get('comuna')

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const rateLimit = await checkRateLimit(`zonificacion-zonas:${ip}`)
  if (rateLimit) return rateLimit

  // Sin ?comuna= — devuelve el listado de comunas cubiertas (paso 1 del select
  // en cascada del fallback manual, evita que el cliente necesite importar el
  // registro directamente).
  if (!comuna) {
    return Response.json({
      comunas: getComunasConCobertura().map((c) => ({ comunaId: c.comunaId, tier: c.tier })),
    })
  }

  const config = resolveComunaZonificacion(comuna)
  if (!config) {
    return Response.json({ error: `Sin cobertura ArcGIS para "${comuna}"` }, { status: 404 })
  }

  const zonas = await fetchZonasDisponibles(config.comunaId)
  if (zonas === null) {
    return Response.json({ error: 'No se pudo consultar el listado de zonas' }, { status: 502 })
  }

  return Response.json({ comunaId: config.comunaId, zonas })
}
