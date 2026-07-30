import { createServiceClient } from '@/lib/supabase/service'
import { resolveComunaZonificacion } from '@/lib/zonificacion-comunas'
import { geocodeDireccion } from '@/lib/geocoding'
import { ArcGISQueryResponseSchema, type ZonaData, type ZonaLookupResponse } from '@/lib/zonificacion'
import { checkRateLimit } from '@/lib/rate-limit'

// Single adapter isolating all ArcGIS-specific knowledge (Pitfall 2) — never
// call ArcGIS or Nominatim from anywhere else in the codebase.
//
// Auth design decision (no locked user decision exists for this — documented
// here so it isn't re-litigated): this route must be callable both with no
// user session (the after() background trigger in Plan 10-05 self-fetches it
// with no cookies) and, in a future phase, from an authenticated client.
// Every other route in this codebase requires createClient() + getUser(), but
// the one existing precedent for a server-side-proxy route callable without a
// session is app/api/utils/uf/route.ts (no auth check at all, called both
// server-side and potentially client-side). Follow that precedent: no
// createClient()/getUser() auth check on this route. It never exposes tenant
// data — only public zoning info for a queried address — and the "never call
// ArcGIS from the browser" security requirement (PITFALLS.md) is satisfied
// because the browser only ever reaches this internal route, never ArcGIS
// directly. Rate-limited by IP instead of by user since there is no session.

export const dynamic = 'force-dynamic'

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents for a loose comparison
    .trim()
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const direccion = searchParams.get('direccion')
  const comuna = searchParams.get('comuna')

  if (!direccion || !comuna) {
    return Response.json(
      { ok: false, status: 'error', error: 'Parámetros "direccion" y "comuna" requeridos' } satisfies ZonaLookupResponse,
      { status: 400 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const rateLimit = await checkRateLimit(`zonificacion:${ip}`)
  if (rateLimit) return rateLimit

  // 1. Coverage registry first — sin_cobertura short-circuits before any network call (Pitfall 3).
  const comunaConfig = resolveComunaZonificacion(comuna)
  if (!comunaConfig) {
    return Response.json(
      { ok: true, status: 'sin_cobertura', error: `Sin cobertura ArcGIS para "${comuna}"` } satisfies ZonaLookupResponse,
      { status: 200 },
    )
  }

  const supabase = createServiceClient()

  try {
    // 2. Geocode.
    const geo = await geocodeDireccion(direccion, comuna)
    if (!geo.ok || geo.lat === undefined || geo.lng === undefined) {
      return Response.json(
        { ok: false, status: 'error', error: geo.error ?? 'No se pudo geocodificar la dirección' } satisfies ZonaLookupResponse,
        { status: 502 },
      )
    }
    const { lat, lng } = geo

    // Pitfall 1 cheap sanity check: log (don't hard-block — accent/casing
    // variance between Nominatim's tags and comunas-chile.ts is expected).
    if (geo.comunaDetectada && normalizarTexto(geo.comunaDetectada) !== normalizarTexto(comuna)) {
      console.warn(`[zonificacion] comuna geocodificada ("${geo.comunaDetectada}") difiere de la solicitada ("${comuna}") para "${direccion}"`)
    }

    const latR = round6(lat)
    const lngR = round6(lng)

    // 3. Cache read-through.
    const { data: cached } = await supabase
      .from('zonificacion_cache')
      .select('*')
      .eq('comuna_id', comunaConfig.comunaId)
      .eq('lat_r', latR)
      .eq('lng_r', lngR)
      .maybeSingle()

    if (cached) {
      const data: ZonaData = {
        comunaId: cached.comuna_id, tier: cached.capa, region: cached.region, sector: cached.sector,
        zona: cached.zona, nombreZona: cached.nombre_zona, uperm: cached.uperm, uproh: cached.uproh,
        usosDisponibles: cached.usos_disponibles, fuenteUrl: cached.fuente_url,
        fuenteActualizadaEl: cached.fuente_actualizada_el, lat, lng, cacheHit: true,
        consultadoEl: cached.consultado_el,
      }
      return Response.json({ ok: true, status: 'encontrado', data } satisfies ZonaLookupResponse, { status: 200 })
    }

    // 4. Cache miss — query ArcGIS. Axis order is x,y = lng,lat; inSR MUST be
    // explicit or ArcGIS silently reinterprets WGS84 degrees as the layer's
    // native Web Mercator meters (Pitfall 1) — this is the single highest-risk
    // line in this file.
    const outFields = Object.values(comunaConfig.fieldMap).join(',')
    const arcgisUrl = new URL(`${comunaConfig.featureServerUrl}/${comunaConfig.layerIndex}/query`)
    arcgisUrl.searchParams.set('f', 'json')
    arcgisUrl.searchParams.set('geometry', `${lng},${lat}`)
    arcgisUrl.searchParams.set('geometryType', 'esriGeometryPoint')
    arcgisUrl.searchParams.set('inSR', '4326')
    arcgisUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
    arcgisUrl.searchParams.set('outFields', outFields)
    arcgisUrl.searchParams.set('returnGeometry', 'false')

    const arcgisRes = await fetch(arcgisUrl.toString(), { signal: AbortSignal.timeout(10_000) })
    if (!arcgisRes.ok) {
      return Response.json(
        { ok: false, status: 'error', error: `ArcGIS HTTP ${arcgisRes.status}` } satisfies ZonaLookupResponse,
        { status: 502 },
      )
    }

    const rawJson: unknown = await arcgisRes.json()
    const parsed = ArcGISQueryResponseSchema.safeParse(rawJson)
    if (!parsed.success) {
      console.error('[zonificacion] ArcGIS response shape inesperado:', parsed.error.message)
      return Response.json(
        { ok: false, status: 'error', error: 'Respuesta de ArcGIS con formato inesperado' } satisfies ZonaLookupResponse,
        { status: 502 },
      )
    }

    if (parsed.data.features.length === 0) {
      // A comuna WITH coverage but no polygon matched at this exact point
      // (boundary gap / rural pocket) is NOT the same as sin_cobertura
      // (comuna outside the registry) and must never read as "sin restricciones"
      // (Pitfall 3/7). Surface as 'error' — distinct from both other states —
      // so the architect is prompted to verify manually, never told "no restrictions".
      return Response.json(
        { ok: false, status: 'error', error: 'No se determinó una zona PRC en este punto exacto — verifica la dirección o consulta manualmente' } satisfies ZonaLookupResponse,
        { status: 200 },
      )
    }

    const attrs = parsed.data.features[0].attributes
    const get = (key: string | undefined): string | null => {
      if (!key) return null
      const v = attrs[key]
      return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
    }

    const comunaArcgis = get(comunaConfig.fieldMap.comuna)
    if (comunaArcgis && normalizarTexto(comunaArcgis) !== normalizarTexto(comuna)) {
      console.warn(`[zonificacion] COMUNA de ArcGIS ("${comunaArcgis}") difiere de la solicitada ("${comuna}") — posible bug de eje de coordenadas`)
    }

    const zona = get(comunaConfig.fieldMap.zona)
    const nombreZona = get(comunaConfig.fieldMap.nombre)
    if (!zona || !nombreZona) {
      return Response.json(
        { ok: false, status: 'error', error: 'ArcGIS retornó una feature sin código/nombre de zona' } satisfies ZonaLookupResponse,
        { status: 502 },
      )
    }

    const nowIso = new Date().toISOString()
    const { data: inserted, error: insertErr } = await supabase
      .from('zonificacion_cache')
      .insert({
        comuna_id: comunaConfig.comunaId,
        lat_r: latR,
        lng_r: lngR,
        capa: comunaConfig.tier,
        region: get(comunaConfig.fieldMap.region),
        sector: get(comunaConfig.fieldMap.sector),
        zona,
        nombre_zona: nombreZona,
        uperm: get(comunaConfig.fieldMap.uperm),
        uproh: get(comunaConfig.fieldMap.uproh),
        usos_disponibles: comunaConfig.usosDisponibles, // registry-level flag, NEVER derived from uperm/uproh being empty (Pitfall 8)
        fuente_url: get(comunaConfig.fieldMap.url),
        fuente_actualizada_el: null, // populate from FeatureServer metadata in a later pass if needed; not required for this phase's success criteria
        raw: attrs,
        consultado_el: nowIso,
      })
      .select('*')
      .single()

    if (insertErr || !inserted) {
      console.error('[zonificacion] No se pudo cachear el resultado:', insertErr?.message)
      // Still return the result even if caching failed — the lookup itself succeeded.
      const data: ZonaData = {
        comunaId: comunaConfig.comunaId, tier: comunaConfig.tier, region: get(comunaConfig.fieldMap.region),
        sector: get(comunaConfig.fieldMap.sector), zona, nombreZona,
        uperm: get(comunaConfig.fieldMap.uperm), uproh: get(comunaConfig.fieldMap.uproh),
        usosDisponibles: comunaConfig.usosDisponibles, fuenteUrl: get(comunaConfig.fieldMap.url),
        fuenteActualizadaEl: null, lat, lng, cacheHit: false, consultadoEl: nowIso,
      }
      return Response.json({ ok: true, status: 'encontrado', data } satisfies ZonaLookupResponse, { status: 200 })
    }

    const data: ZonaData = {
      comunaId: inserted.comuna_id, tier: inserted.capa, region: inserted.region, sector: inserted.sector,
      zona: inserted.zona, nombreZona: inserted.nombre_zona, uperm: inserted.uperm, uproh: inserted.uproh,
      usosDisponibles: inserted.usos_disponibles, fuenteUrl: inserted.fuente_url,
      fuenteActualizadaEl: inserted.fuente_actualizada_el, lat, lng, cacheHit: false,
      consultadoEl: inserted.consultado_el,
    }
    return Response.json({ ok: true, status: 'encontrado', data } satisfies ZonaLookupResponse, { status: 200 })
  } catch (err) {
    console.error('[zonificacion] Error inesperado:', err instanceof Error ? err.message : err)
    return Response.json(
      { ok: false, status: 'error', error: 'Error interno al consultar zonificación' } satisfies ZonaLookupResponse,
      { status: 500 },
    )
  }
}
