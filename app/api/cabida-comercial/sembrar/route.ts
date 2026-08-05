export const dynamic = 'force-dynamic'
export const maxDuration = 280

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { obtenerAnalisisCabidaComercial, calcularPercentilesGapScore } from '@/lib/cabida-comercial-server'
import type { FormatoComercial } from '@/lib/cabida-comercial'

// Siembra la muestra comparativa que calcularVeredictoCabida() necesita para
// poder concluir: sin al menos MUESTRA_MINIMA=10 análisis reales por formato
// en cabida_comercial_competencia, los terciles p33/p66 no existen y el
// veredicto devuelve 'muestra_comparativa_insuficiente' por diseño (nunca
// inventa un corte).
//
// Recorre terrenos con lat/lng ya resueltas, saltando los que YA tienen
// análisis para ese formato — así es idempotente y se puede llamar en loop
// hasta que `restantes` llegue a 0, mismo patrón que reintentar-ubicacion.
//
// Lotes chicos por el throttle real de las fuentes: cada ítem hace 1 llamada
// a Valhalla (~1s), 1 a ArcGIS (censo) y, para supermercado/minimarket, 1 a
// Overpass (~1,5s) + Nominatim. Verificado en vivo antes de construir esto.
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

const FORMATOS_VALIDOS: FormatoComercial[] = ['supermercado', 'minimarket', 'strip_center', 'power_center']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`cabida-sembrar:${user.id}`)
    if (rateLimit) return rateLimit

    const body = (await request.json().catch(() => ({}))) as { formato?: string; limit?: number }
    const formato = (body.formato ?? 'supermercado') as FormatoComercial
    if (!FORMATOS_VALIDOS.includes(formato)) {
      return Response.json({ error: `formato inválido: ${body.formato}` }, { status: 400 })
    }
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)

    const service = createServiceClient()

    // Ubicaciones ya analizadas para ESTE formato — se saltan. Se comparan por
    // lat/lng redondeadas, que es la clave real de la caché.
    const { data: yaAnalizadas } = await service
      .from('cabida_comercial_competencia')
      .select('cabida_comercial_cache(lat_r, lng_r)')
      .eq('formato', formato)

    const vistas = new Set(
      (yaAnalizadas ?? [])
        .map((f) => f.cabida_comercial_cache as unknown as { lat_r: number; lng_r: number } | null)
        .filter((c): c is { lat_r: number; lng_r: number } => c !== null)
        .map((c) => `${Number(c.lat_r).toFixed(6)},${Number(c.lng_r).toFixed(6)}`)
    )

    const { data: terrenos, error: errTerrenos } = await service
      .from('terrenos')
      .select('id, comuna, lat, lng')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .not('comuna', 'is', null)
      .order('created_at', { ascending: false })
      .limit(600)

    if (errTerrenos) return apiError('No se pudieron leer terrenos', 500, errTerrenos)

    const pendientes = (terrenos ?? []).filter(
      (t) => !vistas.has(`${Number(t.lat).toFixed(6)},${Number(t.lng).toFixed(6)}`)
    )

    const lote = pendientes.slice(0, limit)
    const resultados: { id: string; comuna: string; gapScore: number | null; competidores: number | null }[] = []
    const errores: string[] = []

    // Secuencial a propósito: en paralelo dispararíamos N llamadas simultáneas
    // a Overpass y a la instancia pública de Valhalla, que es exactamente el
    // patrón de abuso que dejó la cuenta de ORS deshabilitada.
    for (const t of lote) {
      try {
        const r = await obtenerAnalisisCabidaComercial({
          lat: Number(t.lat),
          lng: Number(t.lng),
          comuna: t.comuna as string,
          formato,
        })
        resultados.push({
          id: t.id as string,
          comuna: t.comuna as string,
          gapScore: r.gapScore,
          competidores: r.analisis.competencia?.competidores.length ?? null,
        })
      } catch (err) {
        errores.push(`${t.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const percentiles = await calcularPercentilesGapScore(formato)

    return Response.json({
      ok: true,
      formato,
      procesados: resultados.length,
      restantes: Math.max(pendientes.length - lote.length, 0),
      resultados,
      errores,
      percentiles,
    })
  } catch (err) {
    return apiError('Error al sembrar análisis de cabida', 500, err)
  }
}
