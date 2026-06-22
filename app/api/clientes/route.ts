import { createClient } from '@/lib/supabase/server'
import { MOCK_CLIENTES } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ data: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ data: MOCK_CLIENTES, source: 'mock' })
    }
    return Response.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

interface NuevoClienteBody {
  nombre: string
  rut?: string
  contacto_nombre?: string
  email?: string
  telefono?: string
  notas?: string
}

export async function POST(request: Request) {
  const body = await request.json() as NuevoClienteBody

  if (!body.nombre?.trim()) {
    return Response.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert({
        user_id: user.id,
        nombre: body.nombre.trim(),
        rut: body.rut ?? null,
        contacto_nombre: body.contacto_nombre ?? null,
        email: body.email ?? null,
        telefono: body.telefono ?? null,
        notas: body.notas ?? null,
      })
      .select('*')
      .single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        return Response.json({
          ok: true,
          id: `c${Date.now()}`,
          simulated: true,
          warning: error.message,
        })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: cliente.id, cliente })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `c${Date.now()}`, simulated: true })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
