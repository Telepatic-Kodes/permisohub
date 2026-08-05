export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { obtenerPoblacionEnPoligono } from '@/lib/censo-manzana-server'
import { obtenerConsumoEstimado } from '@/lib/consumo-macro-zona'
import { obtenerIsocrona, type ModoIsocrona } from '@/lib/isocrona'

// Conecta obtenerPoblacionEnPoligono() y obtenerConsumoEstimado() (Fase 17)
// a la UI. Originalmente (04-08, primera versión) usaba un círculo fijo de 1km
// porque la Fase 16 estaba bloqueada por el 403 de ORS; ahora usa la isócrona
// real de red vial vía lib/isocrona.ts, que igual cae a círculo si el
// proveedor falla — y en ese caso lo declara, nunca lo disfraza.
const MINUTOS_DEFECTO = 15
const MODO_DEFECTO: ModoIsocrona = 'caminando'
const MINUTOS_MAX = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const comuna = searchParams.get('comuna')
  const latParam = searchParams.get('lat')
  const lngParam = searchParams.get('lng')
  const minutosParam = searchParams.get('minutos')
  const modoParam = searchParams.get('modo')

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

    if (!tieneCoordenadas) {
      return Response.json({ ok: true, consumo, poblacion: null, isocrona: null })
    }

    const minutosCrudo = minutosParam !== null ? Number(minutosParam) : MINUTOS_DEFECTO
    const minutos =
      Number.isFinite(minutosCrudo) && minutosCrudo > 0 ? Math.min(minutosCrudo, MINUTOS_MAX) : MINUTOS_DEFECTO
    const modo: ModoIsocrona = modoParam === 'auto' ? 'auto' : MODO_DEFECTO

    const isocrona = await obtenerIsocrona({ lat: lat as number, lng: lng as number, minutos, modo })
    const poblacion = await obtenerPoblacionEnPoligono(isocrona.geometria)

    // Se omite `geometria` a propósito: la tarjeta solo necesita los metadatos
    // para el disclosure, y el polígono puede traer cientos de vértices
    // (auto/10 min dio 169 en la verificación). Cuando se conecte el mapa
    // (components/.../cabida-comercial-mapa.tsx, hoy huérfano) se agrega acá.
    const { geometria: _geometria, ...isocronaMeta } = isocrona

    return Response.json({ ok: true, consumo, poblacion, isocrona: isocronaMeta })
  } catch (err) {
    return apiError('Error al obtener demografía/consumo', 500, err)
  }
}
