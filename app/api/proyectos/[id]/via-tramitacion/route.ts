export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import type { RespuestasVia, ViaRecomendada } from '@/lib/via-tramitacion'

// ---------------------------------------------------------------------------
// Persistencia del flujo guiado de vía de tramitación (PlanX-lite) por proyecto.
//
// `respuestas` = el árbol de decisión contestado (Partial<RespuestasVia>);
// `resultado` = la ViaRecomendada elegida al terminar. El ruteo es determinista
// (recomendarVia); aquí solo se guarda lo que el usuario recorrió. RLS por owner.
//
// Degrada limpio si la tabla `via_tramitacion` aún no existe en la base
// (la migración la corre el humano): GET devuelve null en vez de fallar.
// ---------------------------------------------------------------------------

interface ViaTramitacionData {
  respuestas: Partial<RespuestasVia>
  resultado: ViaRecomendada | null
}

async function ownedProject(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: Response.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!proyecto || proyecto.user_id !== user.id) {
    return { error: Response.json({ error: 'Proyecto no encontrado' }, { status: 404 }) }
  }

  return { supabase }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await ownedProject(id)
  if ('error' in ctx) return ctx.error
  const { supabase } = ctx

  try {
    const { data: row, error } = await supabase
      .from('via_tramitacion')
      .select('respuestas, resultado')
      .eq('proyecto_id', id)
      .maybeSingle<ViaTramitacionData>()

    // Tabla ausente (migración pendiente) → degradar a null, no romper la UI.
    if (error) return Response.json({ data: null })

    return Response.json({ data: row ?? null })
  } catch (err) {
    return apiError('Error al cargar la vía de tramitación', 500, err)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await ownedProject(id)
  if ('error' in ctx) return ctx.error
  const { supabase } = ctx

  const body = (await request.json()) as {
    respuestas?: unknown
    resultado?: unknown
  }
  const respuestas = body.respuestas
  if (typeof respuestas !== 'object' || respuestas === null || Array.isArray(respuestas)) {
    return Response.json({ error: 'Body inválido: se espera { respuestas, resultado }' }, { status: 400 })
  }

  try {
    const { error } = await supabase.from('via_tramitacion').upsert(
      {
        proyecto_id: id,
        respuestas,
        resultado: body.resultado ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'proyecto_id' },
    )
    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error al guardar la vía de tramitación', 500, err)
  }
}
