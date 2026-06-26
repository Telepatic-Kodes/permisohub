import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase
      .from('profiles')
      .select('nombre, especialidad, municipio_principal, email_notificaciones')
      .eq('id', user.id)
      .single()

    if (error) throw error

    return Response.json({ perfil: data ?? {}, email: user.email, is_admin: user.email === process.env.ADMIN_EMAIL })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ perfil: null, email: null, source: 'mock' })
    }
    return Response.json({ error: 'Error al obtener perfil' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const body = await request.json() as {
    nombre?: string
    especialidad?: string
    municipio_principal?: string
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const updates: Record<string, unknown> = {}
    if (body.nombre !== undefined) updates.nombre = body.nombre
    if (body.especialidad !== undefined) updates.especialidad = body.especialidad
    if (body.municipio_principal !== undefined) updates.municipio_principal = body.municipio_principal

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates }, { onConflict: 'id' })

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
