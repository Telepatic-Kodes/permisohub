import { createClient } from '@/lib/supabase/server'
import { InviteBodySchema } from '@/lib/schemas'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const raw = await request.json()
  const parsed = InviteBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const rol = body.role ?? 'viewer'

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString()

    const { data, error } = await supabase.from('workspace_invites').insert({
      workspace_id: user.id,
      email: body.email,
      rol,
      token,
      expires_at: expiresAt,
    }).select().single()

    if (error && process.env.NODE_ENV === 'production') {
      return apiError('Error interno', 500, error)
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
