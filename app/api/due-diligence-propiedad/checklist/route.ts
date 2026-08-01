import { createClient } from '@/lib/supabase/server'
import { buildDocList, buildChecklistHTML, type DueDiligenceChecklistInput } from '@/lib/due-diligence-propiedad'

export const dynamic = 'force-dynamic'

// Ruta determinista, sin IA — solo requiere sesión normal (no aiAuthGuard,
// no consume cuota de IA, no hay llamada a OpenAI acá).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const body = (await request.json()) as DueDiligenceChecklistInput
  const docs = buildDocList(body)
  const html = buildChecklistHTML(body, docs)

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
