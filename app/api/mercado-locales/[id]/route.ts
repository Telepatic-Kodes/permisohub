export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { obtenerOportunidadPorId } from '@/lib/mercado-locales-server'

// Ficha completa (con bandas + reasonCodes) de una oportunidad para el
// comparador terreno-vs-local (04-08) — mismo dato que ya usa
// /oportunidades/[id], expuesto acá como API route porque el comparador
// vive bajo /terrenos y es un client component (mismo patrón que el resto
// de páginas de terrenos), a diferencia de la ficha de oportunidad que es
// Server Component.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`mercado-locales-detalle:${user.id}`)
    if (rateLimit) return rateLimit

    const oportunidad = await obtenerOportunidadPorId(id)
    if (!oportunidad) {
      return Response.json({ error: 'Oportunidad no encontrada' }, { status: 404 })
    }

    return Response.json({ oportunidad })
  } catch (err) {
    return apiError('Error al obtener la oportunidad', 500, err)
  }
}
