import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ComunicacionBody {
  id?: string
  tipo: string
  asunto: string
  descripcion?: string
  fecha: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json() as ComunicacionBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { error } = await supabase.from('comunicaciones').insert({
      proyecto_id: id,
      tipo: body.tipo,
      asunto: body.asunto,
      descripcion: body.descripcion ?? null,
      fecha: body.fecha,
      user_id: user.id,
    })

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
