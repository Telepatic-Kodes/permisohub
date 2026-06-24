import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface InviteBody {
  email: string
  role?: string
}

export async function POST(request: Request) {
  const body = await request.json() as InviteBody

  if (!body.email) {
    return Response.json({ error: 'email requerido' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString()

    const { data, error } = await supabase.from('workspace_invites').insert({
      workspace_id: user.id,
      email: body.email,
      rol: body.role ?? 'viewer',
      token,
      expires_at: expiresAt,
    }).select().single()

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'

    return Response.json({
      ok: true,
      token,
      url: `${baseUrl}/portal/${token}`,
      invite: data ?? null,
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
