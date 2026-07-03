import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ localId: string }> }
) {
  const { localId } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data: localData, error: localError } = await supabase
      .from('locales')
      .select('id, numero, nombre_negocio, uso, area_m2, centro:centros_comerciales(nombre, municipio, direccion, cadena:cadenas(nombre))')
      .eq('id', localId)
      .single()

    if (localError) throw localError

    const { data: checklistData, error: checklistError } = await supabase
      .from('checklist_items')
      .select('id, categoria, item, obligatorio')
      .order('categoria')

    if (checklistError) throw checklistError

    const { data: ultimaInspeccion } = await supabase
      .from('inspecciones')
      .select('fecha, inspector_nombre, resultado')
      .eq('local_id', localId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Supabase returns joins as arrays even for single relations
    type CentroArr = Array<{ nombre: string; municipio: string; direccion?: string; cadena: Array<{ nombre: string }> }>
    const centroArr = localData.centro as unknown as CentroArr
    const centroItem = centroArr?.[0]
    const cadenaItem = centroItem?.cadena?.[0]

    return Response.json({
      ok: true,
      local: {
        id: localData.id as string,
        numero: localData.numero as string,
        nombre_negocio: (localData.nombre_negocio ?? null) as string | null,
        uso: (localData.uso ?? null) as string | null,
        area_m2: (localData.area_m2 ?? null) as number | null,
      },
      centro: {
        nombre: centroItem?.nombre ?? '',
        municipio: centroItem?.municipio ?? '',
        direccion: centroItem?.direccion,
      },
      cadena: {
        nombre: cadenaItem?.nombre ?? '',
      },
      checklist: checklistData ?? [],
      ultima_inspeccion: ultimaInspeccion
        ? {
            fecha: ultimaInspeccion.fecha,
            inspector: ultimaInspeccion.inspector_nombre,
            resultado: ultimaInspeccion.resultado as 'conforme' | 'no_conforme' | 'con_observaciones',
          }
        : null,
    })
  } catch {
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

type PostBody = {
  items: Array<{ id: string; estado: 'conforme' | 'no_conforme' | 'no_aplica'; nota?: string }>
  inspector_nombre: string
  observaciones_generales?: string
}

function calcularResultado(
  items: Array<{ estado: 'conforme' | 'no_conforme' | 'no_aplica'; nota?: string }>
): 'conforme' | 'no_conforme' | 'con_observaciones' {
  if (items.some(i => i.estado === 'no_conforme')) return 'no_conforme'
  if (items.some(i => i.nota && i.nota.trim().length > 0)) return 'con_observaciones'
  return 'conforme'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ localId: string }> }
) {
  const { localId } = await params
  const body = await request.json() as PostBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const resultado = calcularResultado(body.items)

    const { data, error } = await supabase
      .from('inspecciones')
      .insert({
        local_id: localId,
        inspector_nombre: body.inspector_nombre,
        observaciones_generales: body.observaciones_generales ?? null,
        resultado,
        items: body.items,
        fecha: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    return Response.json({ ok: true, inspeccion_id: data.id, resultado })
  } catch {
    return Response.json({ error: 'Error al registrar inspección' }, { status: 500 })
  }
}
