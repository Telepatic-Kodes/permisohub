import { createClient } from '@/lib/supabase/server'
import { InviteBodySchema } from '@/lib/schemas'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { asegurarWorkspace } from '@/lib/workspace'
import { getUserPlan } from '@/lib/subscription'
import { getLimits } from '@/lib/plan-limits'

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

    const { data: perfil } = await supabase
      .from('profiles')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle()

    // Antes insertaba `workspace_id: user.id` — el id del usuario como si
    // fuera el del workspace.
    const ws = await asegurarWorkspace(supabase, user.id, perfil?.nombre)
    if (ws.rol !== 'admin') {
      return Response.json({ error: 'Solo un administrador puede invitar' }, { status: 403 })
    }

    // `seats` en PLAN_LIMITS nunca se revisaba en ningún lado (confirmado
    // por grep en todo el repo) — un workspace free (seats:1) podía invitar
    // y aceptar miembros sin límite. Cuenta miembros activos + invitaciones
    // pendientes sin vencer, para que no se pueda esquivar el tope mandando
    // varias invitaciones antes de que la primera se acepte.
    const plan = await getUserPlan(user.id)
    const seatLimit = getLimits(plan).seats
    const [{ count: miembrosActuales }, { count: invitesPendientes }] = await Promise.all([
      supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
      supabase
        .from('workspace_invites')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString()),
    ])
    const ocupados = (miembrosActuales ?? 0) + (invitesPendientes ?? 0)
    if (ocupados >= seatLimit) {
      return Response.json(
        { error: `Tu plan (${plan}) permite ${seatLimit} usuario${seatLimit === 1 ? '' : 's'} por workspace. Actualiza tu plan para invitar a más.` },
        { status: 402 },
      )
    }

    const rol = body.role ?? 'viewer'
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString()

    const { data, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: ws.id,
        email: body.email.toLowerCase().trim(),
        rol,
        token,
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) return apiError('No se pudo crear la invitación', 500, error)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'

    return Response.json({
      ok: true,
      token,
      // Antes apuntaba a /portal/[token], que es el portal del MANDANTE para
      // seguir un expediente: no tiene nada que ver con unirse al equipo.
      url: `${baseUrl}/invitacion/${token}`,
      // La columna es `rol`; el tipo del cliente espera `role`.
      invite: data ? { ...data, role: data.rol } : null,
    })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
