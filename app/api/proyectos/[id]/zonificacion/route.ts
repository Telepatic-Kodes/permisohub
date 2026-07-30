export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { persistZonificacionParaProyecto } from '@/lib/zonificacion-server'
import { fetchZonaDetalle } from '@/lib/zonificacion-zonas'

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
    // NOTA: proyectos.lat/proyectos.lng NO están en la base de datos en vivo
    // — 20260705_proyectos_sii.sql las define pero nunca fue aplicada a este
    // proyecto Supabase (drift pre-existente, descubierto durante este plan,
    // fuera de alcance arreglar aquí). Seleccionarlas revienta el SELECT
    // completo (Postgres error 42703), convirtiendo cada request legítimo en
    // un falso 404 vía el guard de abajo. Por eso el fallback de lat/lng en
    // GET usa únicamente zonificacion_cache.lat_r/lng_r, nunca proyecto.lat/lng.
    .select('id, user_id, direccion, municipio, zona_cache_id, zona_status, zona_origen')
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

  if (!proyecto.zona_cache_id) {
    return Response.json({
      ok: true,
      zonaStatus: proyecto.zona_status,
      zonaOrigen: proyecto.zona_origen ?? null,
      lat: null,
      lng: null,
      geometria: null,
    })
  }

  const { data: cacheRow } = await supabase
    .from('zonificacion_cache')
    .select('geometria, lat_r, lng_r')
    .eq('id', proyecto.zona_cache_id)
    .maybeSingle()

  return Response.json({
    ok: true,
    zonaStatus: proyecto.zona_status,
    zonaOrigen: proyecto.zona_origen ?? null,
    lat: cacheRow?.lat_r ?? null,
    lng: cacheRow?.lng_r ?? null,
    geometria: cacheRow?.geometria ?? null,
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
