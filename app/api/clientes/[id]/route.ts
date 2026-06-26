import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface PatchBody {
  nombre?: string
  email?: string
  telefono?: string
  rut?: string
  direccion?: string
  notas?: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clientes')
      .select('*, proyectos(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return Response.json({ cliente: data, source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ cliente: null, source: 'mock' })
    }
    return Response.json({ error: 'No encontrado' }, { status: 404 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json() as PatchBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const updates: Record<string, unknown> = {}
    const fields = ['nombre', 'email', 'telefono', 'rut', 'direccion', 'notas'] as const
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f]
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true })
    }

    const { error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error && process.env.NODE_ENV === 'production') {
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error && process.env.NODE_ENV === 'production') {
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
