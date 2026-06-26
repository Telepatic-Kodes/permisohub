export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'

interface ToggleBody {
  estado: 'pendiente' | 'ok'
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  const body = await request.json() as ToggleBody

  if (!['pendiente', 'ok'].includes(body.estado)) {
    return Response.json({ error: 'estado debe ser pendiente o ok' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('document_checklist_items')
    .update({ estado: body.estado })
    .eq('id', itemId)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, item: data })
}
