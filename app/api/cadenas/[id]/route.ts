import { createClient } from '@/lib/supabase/server'
import { MOCK_CADENAS, MOCK_CENTROS } from '@/lib/mock-data'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as {
    nombre?: string
    rut?: string
    contacto_nombre?: string
    email?: string
    municipios?: string[]
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error } = await supabase
      .from('cadenas')
      .update({
        ...(body.nombre && { nombre: body.nombre }),
        rut: body.rut ?? null,
        contacto_nombre: body.contacto_nombre ?? null,
        email: body.email ?? null,
        municipios: body.municipios ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return Response.json({ ok: true, cadena: data })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error al actualizar cadena' }, { status: 500 })
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
      .from('cadenas')
      .select('*, centros:centros_comerciales(*, locales(id, numero, nombre_negocio, uso))')
      .eq('id', id)
      .single()

    if (error) throw error
    return Response.json({ cadena: data, source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const cadena = MOCK_CADENAS.find(c => c.id === id)
      if (!cadena) return Response.json({ error: 'No encontrada' }, { status: 404 })
      const centros = MOCK_CENTROS.filter(cc => cc.cadena_id === id)
      return Response.json({ cadena: { ...cadena, centros }, source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
