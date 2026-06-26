export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { aiAuthGuard } from '@/lib/ai-guard'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

interface ToggleBody {
  estado: 'pendiente' | 'ok'
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`general:${auth.userId}`)
  if (rateLimit) return rateLimit

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
    return apiError('Error interno', 500, error)
  }

  return Response.json({ ok: true, item: data })
}
