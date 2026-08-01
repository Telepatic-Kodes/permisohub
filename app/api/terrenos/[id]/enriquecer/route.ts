export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { enriquecerTerreno } from '@/lib/terrenos-server'

// Trigger síncrono (a diferencia del after() fire-and-forget al crear el
// terreno) para el botón "Verificar viabilidad" / "Actualizar" en la UI —
// aquí sí queremos esperar el resultado antes de refrescar la página.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`enriquecer-terreno:${user.id}`)
    if (rateLimit) return rateLimit

    const { data: terreno } = await supabase
      .from('terrenos')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!terreno) {
      return Response.json({ error: 'Terreno no encontrado' }, { status: 404 })
    }

    await enriquecerTerreno(id, { force })
    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error al enriquecer terreno', 500, err)
  }
}
