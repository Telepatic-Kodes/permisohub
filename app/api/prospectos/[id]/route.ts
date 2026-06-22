import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
        return Response.json({ error: actError.message }, { status: 500 })
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
        return Response.json({ error: updateError.message }, { status: 500 })
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
