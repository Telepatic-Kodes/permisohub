import { createClient } from '@/lib/supabase/server'
import { MOCK_CENTROS } from '@/lib/mock-data'

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

    const { data, error } = await supabase
      .from('centros_comerciales')
      .select('*, locales(id, numero, nombre_negocio, uso, area_m2)')
      .eq('cadena_id', id)
      .order('nombre')

    if (error) throw error
    return Response.json({ data: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ data: MOCK_CENTROS.filter(cc => cc.cadena_id === id), source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

interface CentroBody {
  nombre: string
  municipio: string
  direccion?: string
  region?: string
  area_m2?: number
  gerente_nombre?: string
  gerente_email?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as CentroBody

  if (!body.nombre || !body.municipio) {
    return Response.json({ error: 'nombre y municipio requeridos' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase.from('centros_comerciales').insert({
      cadena_id: id,
      nombre: body.nombre,
      municipio: body.municipio,
      direccion: body.direccion ?? null,
      region: body.region ?? null,
      area_m2: body.area_m2 ?? null,
      gerente_nombre: body.gerente_nombre ?? null,
      gerente_email: body.gerente_email ?? null,
    }).select().single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        return Response.json({ ok: true, id: `cc${Date.now()}`, simulated: true })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: data.id, centro: data })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `cc${Date.now()}`, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
