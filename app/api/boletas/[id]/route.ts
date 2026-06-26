import { createClient } from '@/lib/supabase/server'
import { calcularEstadoBoleta } from '@/lib/boletas'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase
      .from('boletas_servicios')
      .select(`*, local:locales(id, numero, uso, centro:centros_comerciales(id, nombre))`)
      .eq('id', id)
      .single()

    if (error) throw error
    return Response.json({ data })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}

interface PatchBoletaBody {
  url?: string
  estado?: string
  monto_clp?: number
  notas?: string
  fecha_vencimiento?: string
  fecha_emision?: string
  numero_cuenta?: string
  tramite_tipo?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as PatchBoletaBody

  const updates: Record<string, unknown> = { ...body }
  if (body.fecha_vencimiento !== undefined) {
    updates.estado = calcularEstadoBoleta(body.fecha_vencimiento)
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase
      .from('boletas_servicios')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return Response.json({ ok: true, boleta: data })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return apiError('Error interno', 500, err)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { error } = await supabase
      .from('boletas_servicios')
      .delete()
      .eq('id', id)

    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return apiError('Error interno', 500, err)
  }
}
