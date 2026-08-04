export const dynamic = 'force-dynamic'
export const maxDuration = 280

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { enriquecerTerreno } from '@/lib/terrenos-server'

// Reintento masivo de ubicacion_status='pendiente' (427 de 703 terrenos con
// zona_status='encontrado', 04-08) — equivalente user-facing del cron
// temporal app/api/terrenos/backfill-ubicacion/route.ts, pero autenticado
// por sesión (RLS-scoped al workspace) en vez de gateado por cron secret, y
// disparado desde /terrenos con progreso visible en vez de trickle manual.
//
// Lotes chicos a propósito: cada ítem pasa por obtenerSenalesUbicacion()
// (Overpass), con throttle interno de 5s+ y posible backoff de 20s en 429
// (lib/terrenos-ubicacion.ts) — a diferencia de reintentar-pendientes, acá
// NO hay skipUbicacion posible, es justamente lo que se está resolviendo.
// Verificado en vivo: un lote de 5 con Overpass completo tardó ~80s.
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`reintentar-ubicacion:${user.id}`)
    if (rateLimit) return rateLimit

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

    // select vía cliente autenticado (RLS/es_miembro) — el reintento nunca
    // toca terrenos de otro workspace, solo el de quien lo dispara.
    const { data: pendientes, error } = await supabase
      .from('terrenos')
      .select('id')
      .eq('zona_status', 'encontrado')
      .eq('ubicacion_status', 'pendiente')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) return apiError('Error al buscar terrenos pendientes de ubicación', 500, error)

    let resueltos = 0
    let diferidos = 0
    let errores = 0
    for (const row of pendientes ?? []) {
      try {
        await enriquecerTerreno(row.id)
        const { data: check } = await supabase.from('terrenos').select('ubicacion_status').eq('id', row.id).single()
        // 'pendiente' acá significa que enriquecerTerreno lo dejó a propósito
        // sin tocar (rate-limit de Overpass) — se recoge en el próximo lote,
        // no es un error real del terreno (mismo criterio que backfill-ubicacion).
        if (check?.ubicacion_status === 'resuelto') resueltos++
        else if (check?.ubicacion_status === 'pendiente') diferidos++
        else errores++
      } catch {
        errores++
      }
    }

    const { count: restantes } = await supabase
      .from('terrenos')
      .select('id', { count: 'exact', head: true })
      .eq('zona_status', 'encontrado')
      .eq('ubicacion_status', 'pendiente')

    return Response.json({
      ok: true,
      procesados: pendientes?.length ?? 0,
      resueltos,
      diferidos,
      errores,
      restantes: restantes ?? 0,
    })
  } catch (err) {
    return apiError('Error al reintentar ubicación', 500, err)
  }
}
