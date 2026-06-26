import { createClient } from '@/lib/supabase/server'
import { MOCK_CENTROS, MOCK_LOCALES } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as {
    nombre?: string
    municipio?: string
    direccion?: string
    area_m2?: number
    num_locales?: number
    gerente_nombre?: string
    gerente_email?: string
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('centros_comerciales')
      .update({
        ...(body.nombre && { nombre: body.nombre }),
        ...(body.municipio && { municipio: body.municipio }),
        direccion: body.direccion ?? null,
        area_m2: body.area_m2 ?? null,
        num_locales: body.num_locales ?? null,
        gerente_nombre: body.gerente_nombre ?? null,
        gerente_email: body.gerente_email ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return Response.json({ ok: true, centro: data })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error al actualizar centro' }, { status: 500 })
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

    const { data, error } = await supabase
      .from('centros_comerciales')
      .select('*, cadena:cadenas(id, nombre), locales(*, proyectos(id, nombre, estado, tipo, fecha_inicio))')
      .eq('id', id)
      .single()

    if (error) throw error
    return Response.json({ centro: data, source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const centro = MOCK_CENTROS.find(cc => cc.id === id)
      if (!centro) return Response.json({ error: 'No encontrado' }, { status: 404 })
      const locales = MOCK_LOCALES.filter(l => l.centro_id === id)
      return Response.json({ centro: { ...centro, locales }, source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
