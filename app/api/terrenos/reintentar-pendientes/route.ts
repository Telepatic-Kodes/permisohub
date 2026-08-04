export const dynamic = 'force-dynamic'
export const maxDuration = 280

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { enriquecerTerreno } from '@/lib/terrenos-server'

// Reintento masivo de zona_status='pendiente' (backlog acumulado porque
// correrDescubrimientoTerrenos solo enriquece hasta MAX_ENRIQUECER_POR_CORRIDA
// por corrida — ver lib/terrenos-server.ts). Deliberadamente NO toca
// zona_status='error': un sondeo manual (2026-08-04) mostró que la mayoría
// de esos son "Dirección no encontrada" porque el scraper guardó el título
// del aviso en vez de una dirección real — reintentar eso no cambia el
// resultado, solo gasta cuota de geocoding. Ver PROJECT.md.
//
// Mismo patrón en lotes que backfill-ubicacion: nunca todo de una vez
// (Nominatim/ArcGIS son recursos compartidos), acotado a MAX_LIMIT por
// invocación pase lo que pida el caller. skipUbicacion:true evita el piso de
// ~5s/ítem de Overpass (ver enriquecerTerreno) — las señales de ubicación
// quedan pendientes para backfill-ubicacion, que ya existe para eso — así
// que 20 (mismo tope que MAX_ENRIQUECER_POR_CORRIDA del cron) es seguro
// dentro de maxDuration sin el cuello de botella verificado en vivo antes
// de este cambio (un lote de 20 CON Overpass tardó varios minutos).
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 20

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`reintentar-pendientes:${user.id}`)
    if (rateLimit) return rateLimit

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT)

    // select vía cliente autenticado (RLS/es_miembro) — el reintento nunca
    // toca terrenos de otro workspace, solo el de quien lo dispara.
    const { data: pendientes, error } = await supabase
      .from('terrenos')
      .select('id')
      .eq('zona_status', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) return apiError('Error al buscar terrenos pendientes', 500, error)

    let resueltos = 0
    let sinCobertura = 0
    let errores = 0
    for (const row of pendientes ?? []) {
      try {
        await enriquecerTerreno(row.id, { skipUbicacion: true })
        const { data: check } = await supabase.from('terrenos').select('zona_status').eq('id', row.id).single()
        if (check?.zona_status === 'encontrado') resueltos++
        else if (check?.zona_status === 'sin_cobertura') sinCobertura++
        else errores++
      } catch {
        errores++
      }
    }

    const { count: restantes } = await supabase
      .from('terrenos')
      .select('id', { count: 'exact', head: true })
      .eq('zona_status', 'pendiente')

    return Response.json({
      ok: true,
      procesados: pendientes?.length ?? 0,
      resueltos,
      sinCobertura,
      errores,
      restantes: restantes ?? 0,
    })
  } catch (err) {
    return apiError('Error al reintentar pendientes', 500, err)
  }
}
