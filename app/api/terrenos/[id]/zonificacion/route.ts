export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// Variante terreno-scoped de app/api/proyectos/[id]/zonificacion/route.ts —
// sirve el polígono/lat/lng de zona por separado del payload liviano de
// GET /api/terrenos/[id], para alimentar ZonificacionMapa (mismo componente
// que ya usa Proyecto, reusado tal cual — no reimplementar Leaflet/GeoJSON).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data: terreno } = await supabase
      .from('terrenos')
      .select('lat, lng, zona_cache_id')
      .eq('id', id)
      .maybeSingle()

    if (!terreno) {
      return Response.json({ error: 'Terreno no encontrado' }, { status: 404 })
    }

    if (!terreno.zona_cache_id) {
      return Response.json({ ok: true, lat: terreno.lat ?? null, lng: terreno.lng ?? null, geometria: null })
    }

    const { data: cacheRow } = await supabase
      .from('zonificacion_cache')
      .select('geometria, lat_r, lng_r')
      .eq('id', terreno.zona_cache_id)
      .maybeSingle()

    return Response.json({
      ok: true,
      lat: cacheRow?.lat_r ?? terreno.lat ?? null,
      lng: cacheRow?.lng_r ?? terreno.lng ?? null,
      geometria: cacheRow?.geometria ?? null,
    })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
