import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json() as { proyectoId?: string; clienteId?: string }

  if (!body.proyectoId && !body.clienteId) {
    return Response.json({ error: 'proyectoId o clienteId requerido' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
  const token = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Upsert invite in workspace_invites with the generated token
    const { error } = await supabase.from('workspace_invites').insert({
      token,
      workspace_id: user.id,
      email: null,
      rol: 'viewer',
      metadata: body.proyectoId
        ? { proyecto_id: body.proyectoId }
        : { cliente_id: body.clienteId },
    })

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }
  } catch {
    // Dev without DB: fall through to return mock token
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'Error al generar token' }, { status: 500 })
    }
  }

  const url = body.proyectoId
    ? `${baseUrl}/portal/${token}`
    : `${baseUrl}/portal/${token}`

  return Response.json({ ok: true, token, url })
}
