export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// ---------------------------------------------------------------------------
// Actualiza etapas del proyecto (estado y/o orden) en lote. Se usa para editar
// el avance y reordenar (drag) las etapas de la PMO. RLS via proyecto owner.
// ---------------------------------------------------------------------------

interface EtapaUpdate {
  id: string
  estado?: string
  orden?: number
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  // RLS de `proyectos` ya es workspace-scoped — ver via-tramitacion/route.ts.
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!proyecto) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const body = (await request.json()) as { etapas?: EtapaUpdate[] }
  const etapas = body.etapas ?? []

  try {
    for (const e of etapas) {
      const upd: Record<string, unknown> = {}
      if (e.estado !== undefined) upd.estado = e.estado
      if (typeof e.orden === 'number') upd.orden = e.orden
      if (Object.keys(upd).length === 0) continue
      await supabase.from('etapas').update(upd).eq('id', e.id).eq('proyecto_id', id)
    }
    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error al actualizar etapas', 500, err)
  }
}
