import { createClient } from '@/lib/supabase/server'
import { MOCK_PROYECTOS } from '@/lib/mock-data'
import { getInteligenciaMunicipio } from '@/lib/inteligencia-dom'
import { sumarDiasHabiles } from '@/lib/dias-habiles'
import type { EstadoDesarchivo, SolicitudDesarchivo } from '@/types'

export const dynamic = 'force-dynamic'

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

// ──────────────────────────────────────────────────
// GET — campos de archivo / desarchivo del proyecto
// ──────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('proyectos')
      .select('municipio, esta_archivado, fecha_archivado, solicitud_desarchivo')
      .eq('id', id)
      .single()

    if (error) throw error

    const intel = getInteligenciaMunicipio(data.municipio ?? '')
    const municipio_info = {
      plazo_tipico_dias: intel?.tiempoAprobacionPromedio ?? 20,
      url_prc: intel?.planRegulador?.urlPRC ?? null,
      alertas: intel?.alertas ?? [],
    }

    return Response.json({
      ok: true,
      esta_archivado: data.esta_archivado ?? false,
      fecha_archivado: data.fecha_archivado ?? null,
      solicitud_desarchivo: data.solicitud_desarchivo ?? null,
      municipio_info,
      source: 'db',
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const proyecto = MOCK_PROYECTOS.find((p) => p.id === id)
      const municipio = proyecto?.municipio ?? ''
      const intel = getInteligenciaMunicipio(municipio)
      const municipio_info = {
        plazo_tipico_dias: intel?.tiempoAprobacionPromedio ?? 20,
        url_prc: intel?.planRegulador?.urlPRC ?? null,
        alertas: intel?.alertas ?? [],
      }
      return Response.json({
        ok: true,
        esta_archivado: proyecto?.esta_archivado ?? false,
        fecha_archivado: proyecto?.fecha_archivado ?? null,
        solicitud_desarchivo: proyecto?.solicitud_desarchivo ?? null,
        municipio_info,
        source: 'mock',
      })
    }
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }
}

// ──────────────────────────────────────────────────
// POST — crea / inicia una solicitud de desarchivo
// ──────────────────────────────────────────────────
interface PostBody {
  costo_uf?: number
  numero_solicitud?: string
  observaciones?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await request.json()) as PostBody

  const solicitud: SolicitudDesarchivo = {
    fecha_solicitud: hoy(),
    estado: 'solicitado',
    costo_uf: body.costo_uf,
    numero_solicitud: body.numero_solicitud,
    observaciones: body.observaciones,
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('proyectos')
      .update({ solicitud_desarchivo: solicitud })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, solicitud })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, solicitud })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────
// PATCH — actualiza el estado de la solicitud
// ──────────────────────────────────────────────────
interface PatchBody {
  estado: EstadoDesarchivo
  fecha_pago?: string
  fecha_estimada_entrega?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await request.json()) as PatchBody

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: current, error: fetchError } = await supabase
      .from('proyectos')
      .select('solicitud_desarchivo')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const prev = (current.solicitud_desarchivo ?? {}) as Partial<SolicitudDesarchivo>
    const updated: Partial<SolicitudDesarchivo> = {
      ...prev,
      estado: body.estado,
    }
    if (body.fecha_pago !== undefined) updated.fecha_pago = body.fecha_pago
    if (body.fecha_estimada_entrega !== undefined) {
      updated.fecha_estimada_entrega = body.fecha_estimada_entrega
    }

    // Auto-calcular fecha_estimada_entrega si avanza a 'pagado' y no viene en el body
    if (body.estado === 'pagado' && !body.fecha_estimada_entrega) {
      const fechaPago = body.fecha_pago ?? new Date().toISOString().slice(0, 10)
      const resultado = sumarDiasHabiles(new Date(fechaPago), 20)
      updated.fecha_estimada_entrega = resultado.toISOString().slice(0, 10)
    }

    const { error } = await supabase
      .from('proyectos')
      .update({ solicitud_desarchivo: updated })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const mockUpdated: Partial<SolicitudDesarchivo> = { estado: body.estado }
      if (body.fecha_pago !== undefined) mockUpdated.fecha_pago = body.fecha_pago
      if (body.fecha_estimada_entrega !== undefined) {
        mockUpdated.fecha_estimada_entrega = body.fecha_estimada_entrega
      }
      // Auto-calcular fecha_estimada_entrega si avanza a 'pagado' y no viene en el body
      if (body.estado === 'pagado' && !body.fecha_estimada_entrega) {
        const fechaPago = body.fecha_pago ?? new Date().toISOString().slice(0, 10)
        const resultado = sumarDiasHabiles(new Date(fechaPago), 20)
        mockUpdated.fecha_estimada_entrega = resultado.toISOString().slice(0, 10)
      }
      return Response.json({ ok: true, solicitud_desarchivo: mockUpdated })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
