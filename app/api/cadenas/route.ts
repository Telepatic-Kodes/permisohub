import { createClient } from '@/lib/supabase/server'
import { MOCK_CADENAS } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase
      .from('cadenas')
      .select('*, centros:centros_comerciales(id, nombre, municipio, num_locales)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return Response.json({ data: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ data: MOCK_CADENAS, source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

interface CadenaBody {
  nombre: string
  rut?: string
  contacto_nombre?: string
  email?: string
  municipios?: string[]
}

export async function POST(request: Request) {
  const body = await request.json() as CadenaBody
  if (!body.nombre) return Response.json({ error: 'nombre requerido' }, { status: 400 })

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const { data, error } = await supabase.from('cadenas').insert({
      workspace_id: user.id,
      nombre: body.nombre,
      rut: body.rut ?? null,
      contacto_nombre: body.contacto_nombre ?? null,
      email: body.email ?? null,
      municipios: body.municipios ?? [],
    }).select().single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        return Response.json({ ok: true, id: `cad${Date.now()}`, simulated: true })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: data.id, cadena: data })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `cad${Date.now()}`, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
