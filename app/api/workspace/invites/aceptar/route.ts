import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Canje de una invitación por su token.
//
// Va con service role a propósito: la RLS ya no deja que un usuario lea
// invitaciones que no son suyas (antes cualquiera podía listar todas las
// pendientes y colarse en otro workspace). El token ES la credencial, así que
// la validación tiene que ocurrir en el servidor.
//
// Quien acepta debe estar autenticado: la invitación se canjea POR una cuenta,
// no crea una.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string }
    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Falta el token de invitación' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Inicia sesión para aceptar la invitación' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const admin = createServiceClient()

    const { data: invite, error: errInvite } = await admin
      .from('workspace_invites')
      .select('id, workspace_id, email, rol, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle()

    if (errInvite) return apiError('No se pudo validar la invitación', 500, errInvite)
    if (!invite) {
      return Response.json({ error: 'La invitación no existe o el enlace es incorrecto' }, { status: 404 })
    }
    if (invite.accepted_at) {
      return Response.json({ error: 'Esta invitación ya fue aceptada' }, { status: 409 })
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: 'La invitación expiró. Pide una nueva.' }, { status: 410 })
    }

    // El correo de la invitación tiene que ser el de quien la canjea: si no,
    // reenviar el enlace daría acceso a cualquiera que lo reciba.
    const emailUsuario = user.email?.toLowerCase().trim()
    const emailInvitado = (invite.email ?? '').toLowerCase().trim()
    if (emailInvitado && emailUsuario !== emailInvitado) {
      return Response.json(
        { error: `Esta invitación es para ${invite.email}. Inicia sesión con ese correo.` },
        { status: 403 },
      )
    }

    // El upsert de acá abajo pisaba el `role` de una membresía YA existente
    // sin condición — un segundo admin podía crear una invitación 'viewer'
    // para el email del dueño del workspace, y aceptarla (o reaceptar una
    // invitación vieja que quedó dando vueltas) lo degradaba de 'admin' a
    // 'viewer' en su propio workspace, sin forma de revertirlo (solo un
    // admin puede invitar). Ahora: si ya existe membresía, se conserva su
    // rol actual — aceptar una invitación nunca DEGRADA a nadie, solo puede
    // sumar a alguien nuevo o (en el mejor caso) subir de rol explícitamente
    // vía la gestión de equipo, no vía un link de invitación reciclado.
    const { data: miembroExistente } = await admin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const rolFinal = miembroExistente ? miembroExistente.role : (invite.rol ?? 'viewer')

    const { error: errMiembro } = await admin
      .from('workspace_members')
      .upsert(
        {
          workspace_id: invite.workspace_id,
          user_id: user.id,
          role: rolFinal,
        },
        { onConflict: 'workspace_id,user_id' },
      )
    if (errMiembro) return apiError('No se pudo agregar al equipo', 500, errMiembro)

    await admin
      .from('workspace_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    const { data: ws } = await admin
      .from('workspaces')
      .select('nombre')
      .eq('id', invite.workspace_id)
      .maybeSingle()

    return Response.json({
      ok: true,
      workspace_id: invite.workspace_id,
      workspace: ws?.nombre ?? null,
      rol: rolFinal,
    })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
