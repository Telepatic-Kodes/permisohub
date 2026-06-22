import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ObservacionBody {
  numero: string
  texto: string
  fecha?: string
  estado?: 'pendiente' | 'respondida'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('observaciones_dom')
      .select('*')
      .eq('proyecto_id', id)
      .order('fecha', { ascending: false })

    if (error) throw error
    return Response.json({ observaciones: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ observaciones: [], source: 'mock' })
    }
    return Response.json({ error: 'Error al obtener observaciones' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json() as ObservacionBody

  if (!body.numero?.trim() || !body.texto?.trim()) {
    return Response.json({ error: 'numero y texto son requeridos' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase.from('observaciones_dom').insert({
      proyecto_id: id,
      user_id: user.id,
      numero: body.numero.trim(),
      texto: body.texto.trim(),
      estado: body.estado ?? 'pendiente',
      fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
    }).select('id').single()

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: data?.id ?? `obs-${Date.now()}` })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `obs-${Date.now()}`, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(request.url)
  const obsId = url.searchParams.get('obsId')
  if (!obsId) return Response.json({ error: 'obsId required' }, { status: 400 })

  const body = await request.json() as { estado?: string; respuesta?: string }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const updates: Record<string, unknown> = {}
    if (body.estado) updates.estado = body.estado
    if (body.respuesta !== undefined) updates.respuesta = body.respuesta

    const { error } = await supabase
      .from('observaciones_dom')
      .update(updates)
      .eq('id', obsId)
      .eq('proyecto_id', id)
      .eq('user_id', user.id)

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
