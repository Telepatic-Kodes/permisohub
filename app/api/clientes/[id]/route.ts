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

    // Sin `.eq('user_id', ...)`: la RLS de `clientes` ya es
    // `es_miembro(workspace_id) OR user_id = auth.uid()` — agregar ese
    // filtro acá encima hacía que un compañero de workspace (que SÍ puede
    // ver al cliente en el listado) editara el registro, recibiera
    // `{ok:true}`, y nada se escribiera de verdad (0 filas afectadas,
    // Supabase no marca error en un update sin match). El punto entero de
    // compartir workspace quedaba roto en silencio para cualquiera que no
    // fuera quien creó el registro. `.select('id')` + chequeo de longitud
    // para devolver 404 real en vez de un 200 falso.
    const { data: actualizados, error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('id', id)
      .select('id')

    if (error) {
      return apiError('Error interno', 500, error)
    }
    if (!actualizados || actualizados.length === 0) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error interno', 500, err)
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

    const { data: eliminados, error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      return apiError('Error interno', 500, error)
    }
    if (!eliminados || eliminados.length === 0) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
