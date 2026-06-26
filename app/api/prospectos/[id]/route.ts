import { createClient } from '@/lib/supabase/server'
import { MOCK_PROSPECTOS } from '@/lib/mock-data'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('prospectos')
      .select('*, actividades:actividades_crm(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return Response.json({ prospecto: data, source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const prospecto = MOCK_PROSPECTOS.find((p) => p.id === id) ?? null
      return Response.json({ prospecto, source: 'mock' })
    }
    return Response.json({ error: 'No encontrado' }, { status: 404 })
  }
}

interface PatchBody {
  etapa?: string
  notas?: string
  proximo_contacto?: string
  actividad?: {
    tipo: string
    descripcion: string
    fecha: string
    resultado?: string
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

    // Insert activity log if provided
    if (body.actividad) {
      const { error: actError } = await supabase.from('actividades_crm').insert({
        prospecto_id: id,
        tipo: body.actividad.tipo,
        descripcion: body.actividad.descripcion,
        fecha: body.actividad.fecha,
        resultado: body.actividad.resultado ?? null,
        user_id: user.id,
      })
      if (actError && process.env.NODE_ENV === 'production') {
        return apiError('Error interno', 500, actError)
      }
    }

    // Update prospecto fields
    const updates: Record<string, unknown> = {}
    if (body.etapa !== undefined) updates.etapa = body.etapa
    if (body.notas !== undefined) updates.notas = body.notas
    if (body.proximo_contacto !== undefined) updates.proximo_contacto = body.proximo_contacto

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('prospectos')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)

      if (updateError && process.env.NODE_ENV === 'production') {
        return apiError('Error interno', 500, updateError)
      }
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
