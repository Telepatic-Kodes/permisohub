export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { aiAuthGuard } from '@/lib/ai-guard'

// ---------------------------------------------------------------------------
// Due Diligence documental — endpoint de polling.
//
// Devuelve el estado actual de la fila `due_diligence_reports`. La RLS de la
// tabla garantiza que el reporte pertenezca al usuario autenticado.
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('due_diligence_reports')
    .select('id, proyecto_id, status, progress, result, error, created_at')
    .eq('id', reportId)
    .single()

  if (error || !row) {
    return Response.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  return Response.json(row)
}
