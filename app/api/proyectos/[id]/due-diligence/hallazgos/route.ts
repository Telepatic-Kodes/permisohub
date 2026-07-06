export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import type { DueDiligenceResult, EstadoRevision } from '@/lib/due-diligence'

// ---------------------------------------------------------------------------
// Checkpoint de verificación humana del Due Diligence.
// PATCH: confirma/edita/descarta hallazgos del último informe. La fuente de
// verdad de las ediciones vive en el jsonb `result.hallazgos` (no en
// observaciones_dom). Recalcula `revisionEstado` ('verificado' cuando ningún
// hallazgo queda 'propuesto'). No dispara IA.
// ---------------------------------------------------------------------------

interface CambioHallazgo {
  codigo: string
  estadoRevision?: EstadoRevision
  tituloEditado?: string
  descripcionEditada?: string
}

const ESTADOS: EstadoRevision[] = ['propuesto', 'confirmado', 'descartado']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body: { reportId?: string; cambios?: CambioHallazgo[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const reportId = body.reportId
  const cambios = Array.isArray(body.cambios) ? body.cambios : []
  if (!reportId || cambios.length === 0) {
    return Response.json({ error: 'Faltan reportId o cambios' }, { status: 400 })
  }

  // Pertenencia del proyecto.
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!proyecto || proyecto.user_id !== user.id) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  // Lee fresco el reporte (read-modify-write del jsonb).
  const { data: reporte } = await supabase
    .from('due_diligence_reports')
    .select('id, proyecto_id, result')
    .eq('id', reportId)
    .maybeSingle()
  if (!reporte || reporte.proyecto_id !== id) {
    return Response.json({ error: 'Informe no encontrado' }, { status: 404 })
  }
  const result = reporte.result as DueDiligenceResult | null
  if (!result || !Array.isArray(result.hallazgos)) {
    return Response.json({ error: 'Informe sin hallazgos' }, { status: 400 })
  }

  try {
    const cambiosPorCodigo = new Map(cambios.map((c) => [c.codigo, c]))
    const ahora = new Date().toISOString()

    result.hallazgos = result.hallazgos.map((h) => {
      const c = cambiosPorCodigo.get(h.codigo)
      if (!c) return h
      const next = { ...h }
      if (c.estadoRevision && ESTADOS.includes(c.estadoRevision)) next.estadoRevision = c.estadoRevision
      let editado = false
      if (typeof c.tituloEditado === 'string') {
        next.tituloEditado = c.tituloEditado.trim() || undefined
        editado = true
      }
      if (typeof c.descripcionEditada === 'string') {
        next.descripcionEditada = c.descripcionEditada.trim() || undefined
        editado = true
      }
      if (editado) next.editadoEl = ahora
      return next
    })

    // revisionEstado derivado: 'verificado' cuando ningún hallazgo queda 'propuesto'.
    const quedanPropuestos = result.hallazgos.some(
      (h) => (h.estadoRevision ?? 'propuesto') === 'propuesto',
    )
    result.revisionEstado = quedanPropuestos ? 'pendiente' : 'verificado'
    result.verificadoEl = quedanPropuestos ? undefined : ahora

    const { error } = await supabase
      .from('due_diligence_reports')
      .update({ result })
      .eq('id', reportId)
    if (error) return apiError('No se pudo guardar la revisión', 500, error)

    return Response.json({ ok: true, revisionEstado: result.revisionEstado })
  } catch (err) {
    return apiError('Error al actualizar hallazgos', 500, err)
  }
}
