export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

interface PatchPropiedadBody {
  direccion?: string
  comuna?: string
  tipoPropiedad?: string
  superficieM2?: number
  operacion?: string
  precioActualUf?: number
  rolSii?: string
  notas?: string
  fechaVencimientoContrato?: string
  tieneAscensor?: boolean
  tieneGas?: boolean
}

const FIELD_MAP: Record<keyof PatchPropiedadBody, string> = {
  direccion: 'direccion',
  comuna: 'comuna',
  tipoPropiedad: 'tipo_propiedad',
  superficieM2: 'superficie_m2',
  operacion: 'operacion',
  precioActualUf: 'precio_actual_uf',
  rolSii: 'rol_sii',
  notas: 'notas',
  fechaVencimientoContrato: 'fecha_vencimiento_contrato',
  tieneAscensor: 'tiene_ascensor',
  tieneGas: 'tiene_gas',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as PatchPropiedadBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const updates: Record<string, unknown> = {}
    for (const [key, column] of Object.entries(FIELD_MAP) as [keyof PatchPropiedadBody, string][]) {
      if (body[key] !== undefined) updates[column] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true })
    }
    updates.updated_at = new Date().toISOString()

    // .select('id') para distinguir "actualizó 1 fila" de "RLS filtró todo
    // en silencio" (Postgres no lanza error cuando 0 filas calzan el USING
    // de la policy — sin esto, actualizar el id de otro workspace devolvía
    // 200 ok:true sin haber tocado nada).
    const { data, error } = await supabase.from('propiedades_portafolio').update(updates).eq('id', id).select('id')
    if (error) return apiError('Error al actualizar la propiedad', 500, error)
    if (!data || data.length === 0) return Response.json({ error: 'Propiedad no encontrada' }, { status: 404 })

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
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase.from('propiedades_portafolio').delete().eq('id', id).select('id')
    if (error) return apiError('Error al eliminar la propiedad', 500, error)
    if (!data || data.length === 0) return Response.json({ error: 'Propiedad no encontrada' }, { status: 404 })

    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
