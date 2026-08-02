export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { getWorkspaceActual } from '@/lib/workspace'
import { OBLIGACIONES_REGULATORIAS } from '@/lib/obligaciones-regulatorias'

const SLUGS_VALIDOS = OBLIGACIONES_REGULATORIAS.map((o) => o.slug) as [string, ...string[]]

const RegistrarCumplimientoSchema = z.object({
  obligacionSlug: z.enum(SLUGS_VALIDOS),
  fechaUltimoCumplimiento: z.string().min(1),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: propiedadId } = await params
  const raw = await request.json().catch(() => ({}))
  const parsed = RegistrarCumplimientoSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const ws = await getWorkspaceActual(supabase, user.id)
    if (!ws) return Response.json({ error: 'Sin workspace activo' }, { status: 400 })

    // Verifica que la propiedad realmente pertenezca al workspace del
    // caller ANTES de escribir — la RLS de propiedad_obligaciones ya lo
    // exige (fix 20260802_fix_propiedad_obligaciones_rls.sql), pero validar
    // acá da un 404 limpio en vez de un error crudo de Postgres.
    const { data: propiedad } = await supabase
      .from('propiedades_portafolio')
      .select('id')
      .eq('id', propiedadId)
      .maybeSingle()
    if (!propiedad) return Response.json({ error: 'Propiedad no encontrada' }, { status: 404 })

    const { error } = await supabase
      .from('propiedad_obligaciones')
      .upsert(
        {
          workspace_id: ws.id,
          propiedad_id: propiedadId,
          obligacion_slug: parsed.data.obligacionSlug,
          fecha_ultimo_cumplimiento: parsed.data.fechaUltimoCumplimiento,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'propiedad_id,obligacion_slug' },
      )

    if (error) return apiError('Error al registrar la obligación', 500, error)

    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
