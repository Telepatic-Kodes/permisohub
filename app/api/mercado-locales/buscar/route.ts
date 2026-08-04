export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { buscarOportunidadesPorComuna } from '@/lib/mercado-locales-server'

// Picker del comparador terreno-vs-local (04-08) — mercado_locales_listings
// no tiene workspace_id (dataset global), así que solo se exige sesión
// válida, sin scoping adicional — mismo criterio que /oportunidades.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const comuna = searchParams.get('comuna')
  if (!comuna) {
    return Response.json({ error: 'Parámetro "comuna" requerido' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`mercado-locales-buscar:${user.id}`)
    if (rateLimit) return rateLimit

    const data = await buscarOportunidadesPorComuna(comuna)
    return Response.json({ data })
  } catch (err) {
    return apiError('Error al buscar locales de mercado', 500, err)
  }
}
