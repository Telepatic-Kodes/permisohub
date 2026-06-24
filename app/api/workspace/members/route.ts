import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('*, profile:profiles(nombre, email, especialidad)')
        .eq('workspace_id', user.id),
      supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', user.id)
        .is('accepted_at', null),
    ])

    return Response.json({
      members: membersRes.data ?? [],
      invites: invitesRes.data ?? [],
      source: 'db',
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ members: [], invites: [], source: 'mock' })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
