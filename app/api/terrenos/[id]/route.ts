export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('terrenos')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return Response.json({ error: 'Terreno no encontrado' }, { status: 404 })
    }

    return Response.json({ terreno: data })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}

interface PatchTerrenoBody {
  direccion?: string
  comuna?: string
  rol_sii?: string
  url_aviso?: string
  precio_clp?: number
  superficie_lote_m2?: number
  proyecto_id?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({})) as PatchTerrenoBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const updates: Record<string, unknown> = {}
    const fields = ['direccion', 'comuna', 'rol_sii', 'url_aviso', 'precio_clp', 'superficie_lote_m2', 'proyecto_id'] as const
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f]
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true })
    }
    updates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('terrenos')
      .update(updates)
      .eq('id', id)

    if (error) {
      return apiError('Error al actualizar terreno', 500, error)
    }

    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
