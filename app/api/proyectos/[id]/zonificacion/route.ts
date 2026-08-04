export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { persistZonificacionParaProyecto } from '@/lib/zonificacion-server'
import { fetchZonaDetalle } from '@/lib/zonificacion-zonas'
import { resolveComunaZonificacion } from '@/lib/zonificacion-comunas'

// ---------------------------------------------------------------------------
// Ruta proyecto-scoped de zonificación (Fase 11, Plan 06):
// - GET sirve el polígono/lat/lng de zona de forma perezosa y separada del
//   payload liviano de GET /api/proyectos/[id] (ZONE-02).
// - POST cubre dos acciones distintas del arquitecto tras la misma
//   autenticación+ownership: "Actualizar" forzado (ZONE-04, reusa
//   persistZonificacionParaProyecto con force:true — misma orquestación que
//   el after() de Fase 10, nunca duplicada) y selección manual de comuna/zona
//   (ZONE-05, nunca pasa por zonificacion_cache porque no hay punto
//   geocodificado real detrás — zona_origen queda 'manual' explícitamente).
// ---------------------------------------------------------------------------

async function ownedProject(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: Response.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const { data: proyecto } = await supabase
    .from('proyectos')
    // proyectos.lat/lng were missing live in Supabase until the orchestrator
    // applied 20260705_proyectos_sii.sql during this phase (pre-existing
    // drift, unrelated to Phase 11 — see .planning/phases/11-vista-de-
    // zonificacion-en-el-proyecto/deferred-items.md for the discovery).
    // Now live — selecting them again restores the intended fallback below.
    .select('id, user_id, direccion, municipio, zona_cache_id, zona_status, zona_origen, lat, lng')
    .eq('id', id)
    .maybeSingle()
  if (!proyecto || proyecto.user_id !== user.id) {
    return { error: Response.json({ error: 'Proyecto no encontrado' }, { status: 404 }) }
  }
  return { supabase, proyecto }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await ownedProject(id)
  if ('error' in ctx) return ctx.error
  const { supabase, proyecto } = ctx

  // Registry-level provenance (Auditoría de Fidelidad de Datos 2026-07-30,
  // C4/A1) — independent of whether a cache row exists yet, so it's resolved
  // once here and included in every response branch below.
  const comunaConfig = proyecto.municipio ? resolveComunaZonificacion(proyecto.municipio) : null
  const fuenteNombre = comunaConfig?.fuenteNombre ?? null
  const contenidoDeclaradoHasta = comunaConfig?.contenidoDeclaradoHasta ?? null

  if (!proyecto.zona_cache_id) {
    return Response.json({
      ok: true,
      zonaStatus: proyecto.zona_status,
      zonaOrigen: proyecto.zona_origen ?? null,
      lat: proyecto.lat ?? null,
      lng: proyecto.lng ?? null,
      geometria: null,
      fuenteActualizadaEl: null,
      fuenteNombre,
      contenidoDeclaradoHasta,
      comunaFuente: null,
    })
  }

  const { data: cacheRow } = await supabase
    .from('zonificacion_cache')
    .select('geometria, lat_r, lng_r, fuente_actualizada_el, raw')
    .eq('id', proyecto.zona_cache_id)
    .maybeSingle()

  // A9: the ArcGIS COMUNA field is already persisted inside the cache row's
  // `raw` jsonb of feature attributes — no migration needed to surface it.
  // Ñuñoa's fieldMap uses UPPERCASE keys, so this must go through the
  // registry's fieldMap rather than a hardcoded 'comuna'/'COMUNA' guess.
  const rawAttrs = cacheRow?.raw
  const comunaFuenteRaw = comunaConfig && rawAttrs && typeof rawAttrs === 'object'
    ? (rawAttrs as Record<string, unknown>)[comunaConfig.fieldMap.comuna]
    : null
  const comunaFuente = typeof comunaFuenteRaw === 'string' && comunaFuenteRaw.trim() !== '' ? comunaFuenteRaw.trim() : null

  return Response.json({
    ok: true,
    zonaStatus: proyecto.zona_status,
    zonaOrigen: proyecto.zona_origen ?? null,
    lat: cacheRow?.lat_r ?? proyecto.lat ?? null,
    lng: cacheRow?.lng_r ?? proyecto.lng ?? null,
    geometria: cacheRow?.geometria ?? null,
    fuenteActualizadaEl: cacheRow?.fuente_actualizada_el ?? null,
    fuenteNombre,
    contenidoDeclaradoHasta,
    comunaFuente,
  })
}

interface PostBody {
  manual?: { comunaId: string; zona: string }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await ownedProject(id)
  if ('error' in ctx) return ctx.error
  const { supabase, proyecto } = ctx

  const rateLimit = await checkRateLimit(`zonificacion-actualizar:${id}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as PostBody

  // ZONE-05: selección manual — nunca pasa por geocoding/zonificacion_cache
  // (no hay punto real que haya caído en un polígono), así que zona_cache_id
  // se limpia explícitamente y zona_origen queda 'manual' para que la UI
  // nunca implique un match geocodificado que no ocurrió.
  if (body.manual) {
    const detalle = await fetchZonaDetalle(body.manual.comunaId, body.manual.zona)
    if (!detalle) {
      return Response.json({ error: 'No se pudo obtener el detalle de la zona seleccionada' }, { status: 502 })
    }
    const { error } = await supabase
      .from('proyectos')
      .update({
        zona_status: 'encontrado',
        zona_origen: 'manual',
        zona_cache_id: null,
        zona_codigo: detalle.zona,
        zona_sector: detalle.sector,
        zona_nombre: detalle.nombre,
        zona_uperm: detalle.uperm,
        zona_uproh: detalle.uproh,
        zona_usos_disponibles: detalle.usosDisponibles,
        zona_fuente_url: detalle.fuenteUrl,
        zona_consultada_el: new Date().toISOString(),
        // Backlog 11-08: la comuna real elegida acá, no proyecto.municipio —
        // ver via-decision.tsx, cita "Fuente: capa oficial {comuna}".
        zona_comuna_manual: body.manual.comunaId,
      })
      .eq('id', id)
      .eq('user_id', proyecto.user_id)
    if (error) return apiError('Error al guardar la selección manual', 500, error)
    return Response.json({ ok: true })
  }

  // ZONE-04: "Actualizar" explícito — fuerza un refresco real, nunca un
  // refresco silencioso en background (ese ya existe, y solo, en el after()
  // de creación/edición de Fase 10; esto es la ÚNICA otra vía de refresco,
  // y siempre a pedido explícito del arquitecto).
  if (!proyecto.direccion || !proyecto.municipio) {
    return Response.json({ error: 'El proyecto no tiene dirección/municipio configurados' }, { status: 400 })
  }

  try {
    await persistZonificacionParaProyecto(id, proyecto.direccion, proyecto.municipio, { force: true })
    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error al actualizar la zonificación', 500, err)
  }
}
