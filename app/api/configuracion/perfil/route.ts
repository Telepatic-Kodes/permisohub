import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { esAdminPlataforma } from '@/lib/admin-plataforma'

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

    // Antes comparaba contra ADMIN_EMAIL (singular, case-sensitive) — un
    // gate distinto del que usa el resto de la app (esAdminPlataforma,
    // que unifica ADMIN_EMAIL/ADMIN_EMAILS y normaliza mayúsculas). Si en
    // producción solo está seteado ADMIN_EMAILS, esto devolvía is_admin:false
    // para un admin real.
    return Response.json({ perfil: data ?? {}, email: user.email, is_admin: esAdminPlataforma(user.email) })
  } catch {
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

    if (error) {
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
