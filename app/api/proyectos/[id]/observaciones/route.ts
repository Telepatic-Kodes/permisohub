import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

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

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase.from('observaciones_dom').insert({
      proyecto_id: id,
      user_id: user.id,
      numero: body.numero.trim(),
      texto: body.texto.trim(),
      estado: body.estado ?? 'pendiente',
      fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
    }).select('id').single()

    if (error && process.env.NODE_ENV === 'production') {
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true, id: data?.id ?? `obs-${Date.now()}` })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `obs-${Date.now()}`, simulated: true })
    }
    return apiError('Error interno', 500, err)
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

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

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
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return apiError('Error interno', 500, err)
  }
}
