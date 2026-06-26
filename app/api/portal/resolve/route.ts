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

    const meta = invite.metadata as { proyecto_id?: string; cliente_id?: string; local_id?: string } | null

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

    if (meta?.local_id) {
      // Tenant portal: all projects for a local
      const { data: local, error: localError } = await supabase
        .from('locales')
        .select('numero, nombre_negocio, proyectos(*), centro:centros_comerciales(nombre, cadena:cadenas(nombre))')
        .eq('id', meta.local_id)
        .single()

      if (localError || !local) throw localError ?? new Error('Local no encontrado')

      type LocalRow = {
        numero: string
        nombre_negocio?: string | null
        proyectos?: unknown[]
        centro?: { nombre?: string; cadena?: { nombre?: string } } | null
      }
      const row = local as LocalRow
      const centroNombre = row.centro?.nombre ?? ''
      const cadenaNombre = row.centro?.cadena?.nombre ?? ''

      return Response.json({
        nombre: `${row.nombre_negocio ?? row.numero} — ${centroNombre}${cadenaNombre ? ` (${cadenaNombre})` : ''}`,
        proyectos: row.proyectos ?? [],
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
