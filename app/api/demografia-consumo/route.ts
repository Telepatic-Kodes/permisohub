export const dynamic = 'force-dynamic'

import * as turf from '@turf/turf'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { obtenerPoblacionEnPoligono } from '@/lib/censo-manzana-server'
import { obtenerConsumoEstimado } from '@/lib/consumo-macro-zona'

// Radio fijo en vez de la isócrona real de caminata/manejo (Fase 16,
// bloqueada por el 403 persistente de ORS/HeiGIT — decisión del usuario de
// dejarlo pausado, 03-08). obtenerPoblacionEnPoligono() y
// obtenerConsumoEstimado() (Fase 17, DEMO-01/02/03) ya estaban terminadas y
// probadas pero sin ningún caller en toda la app — conectadas acá (04-08)
// con un círculo de 1km en vez de esperar la isócrona. SIEMPRE declarado
// como radio fijo en la respuesta — nunca presentado con la precisión de
// una ruta real, mismo principio que zona_precision='centroide_comuna' en
// zonificación.
const RADIO_METROS = 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const comuna = searchParams.get('comuna')
  const latParam = searchParams.get('lat')
  const lngParam = searchParams.get('lng')

  if (!comuna) {
    return Response.json({ error: 'Parámetro "comuna" requerido' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`demografia-consumo:${user.id}`)
    if (rateLimit) return rateLimit

    const consumo = obtenerConsumoEstimado(comuna)

    const lat = latParam !== null ? Number(latParam) : null
    const lng = lngParam !== null ? Number(lngParam) : null
    const tieneCoordenadas = lat !== null && Number.isFinite(lat) && lng !== null && Number.isFinite(lng)

    const poblacion = tieneCoordenadas
      ? await obtenerPoblacionEnPoligono(
          turf.circle([lng as number, lat as number], RADIO_METROS / 1000, { units: 'kilometers' }).geometry,
        )
      : null

    return Response.json({ ok: true, consumo, poblacion, radioMetros: tieneCoordenadas ? RADIO_METROS : null })
  } catch (err) {
    return apiError('Error al obtener demografía/consumo', 500, err)
  }
}
