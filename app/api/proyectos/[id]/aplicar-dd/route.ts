export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { ETAPAS_PERMISO } from '@/types'
import type { DueDiligenceResult } from '@/lib/due-diligence'

// ---------------------------------------------------------------------------
// Puebla la "PMO" del proyecto a partir del último due diligence:
//   - etapas: las 7 etapas estándar con avance inferido del DD (origen='dd')
//   - observaciones_dom: desde los hallazgos (origen='dd')
//   - proyecto: estado / numero_expediente desde estadoDOM
// Idempotente: borra primero las filas origen='dd' y reinserta.
// ---------------------------------------------------------------------------

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  // Verifica pertenencia y trae el último informe done.
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, estado, numero_expediente, user_id')
    .eq('id', id)
    .maybeSingle()
  if (!proyecto || proyecto.user_id !== user.id) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const { data: reporte } = await supabase
    .from('due_diligence_reports')
    .select('result')
    .eq('proyecto_id', id)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const result = reporte?.result as DueDiligenceResult | undefined
  if (!result) {
    return Response.json({ error: 'No hay due diligence completado' }, { status: 400 })
  }

  // Gate de verificación: solo fluyen los hallazgos revisados por el humano.
  // Si queda alguno 'propuesto' (default para filas antiguas), 409 — el botón de
  // la UI solo se habilita cuando 0. Solo los 'confirmado' se proyectan.
  const hallazgos = result.hallazgos ?? []
  const pendientes = hallazgos.filter((h) => (h.estadoRevision ?? 'propuesto') === 'propuesto').length
  if (pendientes > 0) {
    return Response.json({ error: 'DD_NO_VERIFICADO', pendientes }, { status: 409 })
  }

  try {
    // 1a) Preserva el estado humano ('respondida') de las observaciones origen='dd'
    // antes de borrarlas — se restaura por `numero` (=codigo del hallazgo).
    const { data: prev } = await supabase
      .from('observaciones_dom')
      .select('numero, estado')
      .eq('proyecto_id', id)
      .eq('origen', 'dd')
    const estadoPrev = new Map((prev ?? []).map((o) => [o.numero as string, o.estado as string]))

    // 1b) Limpia lo previamente generado por el DD.
    await supabase.from('etapas').delete().eq('proyecto_id', id).eq('origen', 'dd')
    await supabase.from('observaciones_dom').delete().eq('proyecto_id', id).eq('origen', 'dd')

    // 2) Etapas estándar con avance inferido.
    const rechazado = result.estadoDOM?.rechazado === true
    const completadas = rechazado
      ? new Set(['Pre-revisión normativa', 'Preparación expediente', 'Ingreso DOM', 'Revisión DOM'])
      : new Set(['Pre-revisión normativa'])
    const enCurso = rechazado ? 'Respuesta observaciones' : 'Preparación expediente'
    const etapasRows = ETAPAS_PERMISO.map((nombre, orden) => ({
      proyecto_id: id,
      nombre,
      estado: completadas.has(nombre) ? 'completada' : nombre === enCurso ? 'en_curso' : 'pendiente',
      orden,
      origen: 'dd',
    }))
    await supabase.from('etapas').insert(etapasRows)

    // 3) Observaciones desde los hallazgos CONFIRMADOS (con edición humana + cita).
    const hoy = new Date().toISOString().slice(0, 10)
    const obsRows = hallazgos
      .filter((h) => (h.estadoRevision ?? 'propuesto') === 'confirmado')
      .map((h) => {
        const titulo = h.tituloEditado ?? h.titulo
        const descripcion = h.descripcionEditada ?? h.descripcion
        const cita = h.refNormativa?.find((r) => r.verificado)?.etiqueta ?? h.refNormativa?.[0]?.etiqueta
        return {
          proyecto_id: id,
          user_id: user.id,
          numero: h.codigo,
          texto: `${titulo} — ${descripcion}${cita ? ` [${cita}]` : ''}${h.refDOM ? ` (${h.refDOM})` : ''}`,
          estado: estadoPrev.get(h.codigo) ?? 'pendiente',
          origen: 'dd',
          fecha: hoy,
        }
      })
    if (obsRows.length > 0) await supabase.from('observaciones_dom').insert(obsRows)

    // 4) Actualiza estado / expediente del proyecto.
    const update: Record<string, string> = {}
    if (rechazado && proyecto.estado === 'borrador') update.estado = 'con_observaciones'
    if (result.estadoDOM?.expediente && !proyecto.numero_expediente) {
      update.numero_expediente = result.estadoDOM.expediente
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('proyectos').update(update).eq('id', id)
    }

    return Response.json({ ok: true, etapas: etapasRows.length, observaciones: obsRows.length })
  } catch (err) {
    return apiError('Error al aplicar el due diligence', 500, err)
  }
}
