export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Devuelve el ÚLTIMO informe de due diligence del proyecto (para rehidratar la
// UI al recargar sin re-correr el análisis). RLS garantiza la pertenencia.
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: row } = await supabase
    .from('due_diligence_reports')
    .select('id, proyecto_id, status, progress, result, error, created_at')
    .eq('proyecto_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return Response.json({ report: row ?? null })
}
