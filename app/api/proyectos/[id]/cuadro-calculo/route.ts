export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import type { CuadroInput } from '@/lib/cuadros-calculo'

// ---------------------------------------------------------------------------
// Persistencia del Cuadro de cálculo normativo de un proyecto.
//
// El `data` guardado es el CuadroInput (superficies + límites PRC que ingresa
// el arquitecto). El cálculo/veredicto NO se persiste: se recomputa de forma
// determinista en el cliente/servidor con calcularCuadro(). RLS por owner del
// proyecto (proyectos.user_id = auth.uid()).
// ---------------------------------------------------------------------------

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
    const { data: row } = await supabase
      .from('cuadros_calculo')
      .select('data')
      .eq('proyecto_id', id)
      .maybeSingle<{ data: CuadroInput | null }>()

    return Response.json({ data: row?.data ?? null })
  } catch (err) {
    return apiError('Error al cargar el cuadro de cálculo', 500, err)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const ctx = await ownedProject(id)
  if ('error' in ctx) return ctx.error
  const { supabase } = ctx

  const body = (await request.json()) as { data?: unknown }
  const data = body.data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return Response.json({ error: 'Body inválido: se espera { data: CuadroInput }' }, { status: 400 })
  }

  try {
    const { error } = await supabase.from('cuadros_calculo').upsert(
      {
        proyecto_id: id,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'proyecto_id' },
    )
    if (error) throw error
    return Response.json({ ok: true })
  } catch (err) {
    return apiError('Error al guardar el cuadro de cálculo', 500, err)
  }
}
