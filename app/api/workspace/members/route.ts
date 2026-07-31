import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { asegurarWorkspace } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Antes filtraba por `workspace_id = user.id`, que solo acierta si el id
    // del usuario coincide con el del workspace. Hay que resolverlo.
    const { data: perfil } = await supabase
      .from('profiles')
      .select('nombre')
      .eq('id', user.id)
      .maybeSingle()

    const ws = await asegurarWorkspace(supabase, user.id, perfil?.nombre)

    const [membersRes, invitesRes] = await Promise.all([
      // Sin join anidado a propósito: workspace_members.user_id referencia
      // auth.users, no profiles, así que PostgREST no encuentra la relación
      // ("PGRST200"). Se resuelve con una segunda consulta.
      supabase.from('workspace_members').select('*').eq('workspace_id', ws.id),
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', ws.id)
        .is('accepted_at', null),
    ])

    if (membersRes.error) return apiError('No se pudo leer el equipo', 500, membersRes.error)

    const miembros = membersRes.data ?? []
    const ids = miembros.map((m) => m.user_id as string)

    // `profiles` no tiene columna email — pedirla hacía fallar el select
    // entero. El correo vive en auth.users y no es legible vía RLS, así que el
    // equipo se identifica por nombre y especialidad.
    const { data: perfiles } = ids.length
      ? await supabase.from('profiles').select('id, nombre, especialidad').in('id', ids)
      : { data: [] as { id: string; nombre: string | null; especialidad: string | null }[] }

    const porId = new Map((perfiles ?? []).map((p) => [p.id, p]))

    return Response.json({
      workspace: ws,
      // Se aplana a la forma que declara WorkspaceMember (nombre suelto, no
      // anidado en `profile`): si no, la lista salía con iniciales "?".
      // `email` queda fuera a propósito — vive en auth.users y no es legible
      // por RLS, así que el equipo se identifica por nombre.
      members: miembros.map((m) => {
        const p = porId.get(m.user_id as string)
        return {
          ...m,
          nombre: p?.nombre ?? null,
          especialidad: p?.especialidad ?? null,
          profile: p ?? null,
        }
      }),
      // La columna en base de datos se llama `rol` pero el tipo del cliente
      // (WorkspaceInvite) espera `role`. Sin normalizar aquí, la lista de
      // invitaciones llegaba con role=undefined y tumbaba la página al buscar
      // el icono del rol.
      invites: (invitesRes.data ?? []).map((i) => ({ ...i, role: i.rol })),
      source: 'db',
    })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
