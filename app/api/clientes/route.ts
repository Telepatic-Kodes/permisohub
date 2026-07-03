import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

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
  } catch (err) {
    return apiError('Error al obtener clientes', 500, err)
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

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

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
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true, id: cliente.id, cliente })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
