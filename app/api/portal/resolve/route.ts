import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return Response.json({ error: 'token requerido' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Look up the invite by token
    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .select('workspace_id, email, metadata')
      .eq('token', token)
      .single()

    if (inviteError || !invite) throw inviteError ?? new Error('Token inválido')

    const meta = invite.metadata as { proyecto_id?: string; cliente_id?: string } | null

    if (meta?.proyecto_id) {
      // Single project view
      const { data: proyecto, error: proyError } = await supabase
        .from('proyectos')
        .select('*, cliente:clientes(nombre)')
        .eq('id', meta.proyecto_id)
        .single()

      if (proyError || !proyecto) throw proyError ?? new Error('Proyecto no encontrado')

      return Response.json({
        nombre: (proyecto.cliente as { nombre?: string } | null)?.nombre ?? proyecto.nombre,
        proyectos: [proyecto],
        source: 'db',
      })
    }

    if (meta?.cliente_id) {
      // All projects for a client
      const [clienteRes, proyectosRes] = await Promise.all([
        supabase.from('clientes').select('nombre').eq('id', meta.cliente_id).single(),
        supabase.from('proyectos').select('*').eq('cliente_id', meta.cliente_id),
      ])

      return Response.json({
        nombre: clienteRes.data?.nombre ?? null,
        proyectos: proyectosRes.data ?? [],
        source: 'db',
      })
    }

    throw new Error('Metadata inválida')
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ proyectos: null, source: 'mock' })
    }
    return Response.json({ error: 'Token no encontrado' }, { status: 404 })
  }
}
