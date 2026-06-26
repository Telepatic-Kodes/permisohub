import { createClient } from '@/lib/supabase/server'
import { MOCK_LOCALES, MOCK_CENTROS, MOCK_PROYECTOS } from '@/lib/mock-data'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as {
    numero?: string
    nombre_negocio?: string
    uso?: string
    area_m2?: number
    tenant_nombre?: string
    tenant_email?: string
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase
      .from('locales')
      .update({
        ...(body.numero && { numero: body.numero }),
        nombre_negocio: body.nombre_negocio ?? null,
        uso: body.uso ?? null,
        area_m2: body.area_m2 ?? null,
        tenant_nombre: body.tenant_nombre ?? null,
        tenant_email: body.tenant_email ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return Response.json({ ok: true, local: data })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error al actualizar local' }, { status: 500 })
  }
}

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
      .from('locales')
      .select('*, centro:centros_comerciales(id, nombre, municipio, cadena:cadenas(id, nombre)), proyectos(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    return Response.json({ local: data, source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const local = MOCK_LOCALES.find(l => l.id === id)
      if (!local) return Response.json({ error: 'No encontrado' }, { status: 404 })
      const centro = MOCK_CENTROS.find(cc => cc.id === local.centro_id)
      const proyectos = MOCK_PROYECTOS.filter(p => p.local_id === id)
      return Response.json({ local: { ...local, centro, proyectos }, source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
