import { createClient } from '@/lib/supabase/server'
import { MOCK_PROYECTOS } from '@/lib/mock-data'
import type { Proyecto } from '@/types'

export const dynamic = 'force-dynamic'

type EstadoVigencia = 'vigente' | 'por_vencer' | 'vencida' | 'sin_datos'

export type PatenteConVigencia = Proyecto & {
  dias_para_vencer: number | null
  estado_vigencia: EstadoVigencia
}

interface ResumenPatentes {
  total: number
  vigentes: number
  por_vencer: number
  vencidas: number
  sin_datos: number
}

// Reference "today" for vigencia calculations (America/Santiago)
function hoy(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function diasEntre(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function calcularVigencia(p: Proyecto): {
  dias_para_vencer: number | null
  estado_vigencia: EstadoVigencia
} {
  const referencia = hoy()
  const currentYear = referencia.getUTCFullYear()

  // Fecha de vencimiento: 31/12/año_ejercicio si hay año, si no fecha_vencimiento_permiso
  let fechaVenc: Date | null = null
  if (typeof p.año_ejercicio === 'number') {
    fechaVenc = new Date(Date.UTC(p.año_ejercicio, 11, 31))
  } else if (p.fecha_vencimiento_permiso) {
    const [y, m, d] = p.fecha_vencimiento_permiso.split('-').map(Number)
    if (y && m && d) fechaVenc = new Date(Date.UTC(y, m - 1, d))
  }

  const dias_para_vencer = fechaVenc ? diasEntre(referencia, fechaVenc) : null

  let estado_vigencia: EstadoVigencia
  if (
    (typeof p.año_ejercicio === 'number' && p.año_ejercicio < currentYear) ||
    (dias_para_vencer !== null && dias_para_vencer < 0)
  ) {
    estado_vigencia = 'vencida'
  } else if (dias_para_vencer !== null && dias_para_vencer <= 30) {
    estado_vigencia = 'por_vencer'
  } else if (dias_para_vencer !== null && dias_para_vencer > 30) {
    estado_vigencia = 'vigente'
  } else {
    estado_vigencia = 'sin_datos'
  }

  return { dias_para_vencer, estado_vigencia }
}

function construirRespuesta(
  proyectos: Proyecto[],
  filtros: { año?: string | null; clienteId?: string | null; estadoVigencia?: string | null },
) {
  let patentes: PatenteConVigencia[] = proyectos
    .filter((p) => p.tipo === 'patente_comercial')
    .map((p) => ({ ...p, ...calcularVigencia(p) }))

  if (filtros.año) {
    const año = Number(filtros.año)
    if (!Number.isNaN(año)) {
      patentes = patentes.filter((p) => p.año_ejercicio === año)
    }
  }

  if (filtros.clienteId) {
    patentes = patentes.filter((p) => p.cliente_id === filtros.clienteId)
  }

  if (filtros.estadoVigencia) {
    patentes = patentes.filter((p) => p.estado_vigencia === filtros.estadoVigencia)
  }

  const resumen: ResumenPatentes = {
    total: patentes.length,
    vigentes: patentes.filter((p) => p.estado_vigencia === 'vigente').length,
    por_vencer: patentes.filter((p) => p.estado_vigencia === 'por_vencer').length,
    vencidas: patentes.filter((p) => p.estado_vigencia === 'vencida').length,
    sin_datos: patentes.filter((p) => p.estado_vigencia === 'sin_datos').length,
  }

  return { ok: true as const, patentes, resumen }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const año = searchParams.get('año')
  const clienteId = searchParams.get('clienteId')
  const estadoVigencia = searchParams.get('estadoVigencia')

  try {
    const supabase = await createClient()
    // Dev: forzar el fallback a mock data sin Supabase configurado
    if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')

    const { data, error } = await supabase
      .from('proyectos')
      .select('*, cliente:clientes(*)')
      .eq('tipo', 'patente_comercial')

    if (error) throw error

    const proyectos = (data ?? []) as Proyecto[]
    return Response.json(construirRespuesta(proyectos, { año, clienteId, estadoVigencia }))
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json(
        construirRespuesta(MOCK_PROYECTOS, { año, clienteId, estadoVigencia }),
      )
    }
    return Response.json({ ok: false, error: 'Error al obtener patentes' }, { status: 500 })
  }
}
