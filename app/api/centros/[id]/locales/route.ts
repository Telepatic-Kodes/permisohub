import { createClient } from '@/lib/supabase/server'
import { MOCK_LOCALES } from '@/lib/mock-data'

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
      .from('locales')
      .select('*, proyectos(id, nombre, estado, tipo, fecha_inicio, numero_expediente)')
      .eq('centro_id', id)
      .order('numero')

    if (error) throw error
    return Response.json({ data: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ data: MOCK_LOCALES.filter(l => l.centro_id === id), source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

interface LocalBody {
  numero: string
  nombre_negocio?: string
  tenant_email?: string
  tenant_nombre?: string
  area_m2?: number
  uso?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as LocalBody

  if (!body.numero) return Response.json({ error: 'numero requerido' }, { status: 400 })

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase.from('locales').insert({
      centro_id: id,
      numero: body.numero,
      nombre_negocio: body.nombre_negocio ?? null,
      tenant_email: body.tenant_email ?? null,
      tenant_nombre: body.tenant_nombre ?? null,
      area_m2: body.area_m2 ?? null,
      uso: body.uso ?? 'otro',
    }).select().single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        return Response.json({ ok: true, id: `loc${Date.now()}`, simulated: true })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: data.id, local: data })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `loc${Date.now()}`, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
